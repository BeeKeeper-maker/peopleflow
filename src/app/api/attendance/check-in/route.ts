import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee, isAuthenticated } from "@/lib/api-auth";
import { differenceInMinutes } from "date-fns";
import { attendanceLogger } from "@/lib/logger";
import { validateGeoFence } from "@/lib/attendance-engine";
import { buildBusinessDateTime, startOfBusinessDay, addBusinessDays } from "@/lib/biometric/attendance-ingest";

// ── Helper: Get org geo-fence settings from Organization.settings JSON ──
function getGeoFenceSettings(settings: unknown): {
    enabled: boolean;
    enforcement: "strict" | "soft"; // strict = block, soft = warn (flag in notes)
} {
    const s = (settings && typeof settings === "object" ? settings : {}) as Record<string, unknown>;
    return {
        enabled: s.geoFenceEnabled === true,
        enforcement: s.geoFenceEnforcement === "strict" ? "strict" : "soft",
    };
}

export async function POST(req: Request) {
    try {
        const auth = await requireEmployee();
        if (!isAuthenticated(auth)) return auth;

        const employee = await prisma.employee.findFirst({
            where: { id: auth.employeeId, organizationId: auth.organizationId },
            include: {
                shift: true,
                branch: {
                    select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        geoFenceRadius: true,
                    },
                },
            },
        });
        const organization = await prisma.organization.findUnique({
            where: { id: auth.organizationId },
            select: { settings: true },
        });

        if (!employee) {
            return new NextResponse("Employee profile not found", { status: 400 });
        }

        const body = await req.json();
        const { location, source, photoUrl, deviceFingerprint } = body;

        const now = new Date();
        const today = startOfBusinessDay(now);

        // ── Buddy Punching Prevention ────────────────────────────
        // 1. Check if already checked in
        const existing = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: employee.id,
                    date: today,
                }
            }
        });

        if (existing) {
            return new NextResponse("Already checked in today", { status: 400 });
        }

        // 2. IP-based duplicate check — prevent same IP checking in for different employees
        // within a short time window (buddy punching pattern)
        const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        let buddyPunchWarning: string | null = null;
        if (clientIp !== "unknown" && source !== "biometric") {
            const recentCheckInsFromSameIp = await prisma.attendance.findFirst({
                where: {
                    checkIn: { gte: new Date(now.getTime() - 2 * 60 * 1000) }, // Last 2 minutes
                    notes: { contains: `ip:${clientIp}` },
                    employeeId: { not: employee.id }, // Different employee
                },
                select: { employeeId: true, checkIn: true },
            });

            if (recentCheckInsFromSameIp) {
                attendanceLogger.warn({
                    employeeId: employee.id,
                    otherEmployeeId: recentCheckInsFromSameIp.employeeId,
                    ip: clientIp,
                }, "BUDDY_PUNCHING_SUSPECTED");

                // Don't block (could be same office WiFi) but flag it
                const buddyWarning = `⚠️ SUSPECTED BUDDY PUNCHING: Another employee checked in from same IP (${clientIp}) 2 min ago`;
                // Will be appended to notes below
                buddyPunchWarning = buddyWarning;
            }
        }

        // 3. Device fingerprint check (if provided by client)
        if (deviceFingerprint) {
            const sameDeviceRecent = await prisma.attendance.findFirst({
                where: {
                    checkIn: { gte: new Date(now.getTime() - 5 * 60 * 1000) }, // Last 5 minutes
                    notes: { contains: `device:${deviceFingerprint}` },
                    employeeId: { not: employee.id },
                },
                select: { employeeId: true },
            });

            if (sameDeviceRecent) {
                attendanceLogger.warn({
                    employeeId: employee.id,
                    otherEmployeeId: sameDeviceRecent.employeeId,
                    deviceFingerprint,
                }, "BUDDY_PUNCHING_DEVICE_MATCH");

                buddyPunchWarning = `⚠️ BUDDY PUNCHING: Same device used by another employee 5 min ago`;
            }
        }

        // ── GPS Geo-Fence Validation ──────────────────────────────
        const geoSettings = getGeoFenceSettings(organization?.settings);
        let geoFenceStatus: "inside" | "outside" | "unchecked" = "unchecked";
        let geoFenceDistance: number | null = null;

        if (geoSettings.enabled && location?.lat && location?.lng) {
            const branch = employee.branch;

            if (branch?.latitude && branch?.longitude) {
                const geoResult = validateGeoFence(
                    { latitude: location.lat, longitude: location.lng },
                    { latitude: branch.latitude, longitude: branch.longitude },
                    branch.geoFenceRadius || 200
                );

                geoFenceStatus = geoResult.isWithinFence ? "inside" : "outside";
                geoFenceDistance = geoResult.distanceMeters;

                // Strict mode: block check-in if outside geo-fence
                if (!geoResult.isWithinFence && geoSettings.enforcement === "strict") {
                    attendanceLogger.warn({
                        employeeId: employee.id,
                        distance: geoResult.distanceMeters,
                        maxAllowed: geoResult.maxAllowedMeters,
                        branchName: branch.name,
                    }, "GEO_FENCE_BLOCKED");

                    return NextResponse.json({
                        error: `You are ${geoResult.distanceMeters}m away from ${branch.name}. Maximum allowed: ${geoResult.maxAllowedMeters}m. Please check in from the office premises.`,
                        code: "GEO_FENCE_VIOLATION",
                        distance: geoResult.distanceMeters,
                        maxAllowed: geoResult.maxAllowedMeters,
                    }, { status: 403 });
                }

                // Soft mode: allow but log a warning
                if (!geoResult.isWithinFence && geoSettings.enforcement === "soft") {
                    attendanceLogger.info({
                        employeeId: employee.id,
                        distance: geoResult.distanceMeters,
                        branchName: branch.name,
                    }, "GEO_FENCE_SOFT_WARNING");
                }
            }
        }

        // ── Calculate Late Status ─────────────────────────────────
        // IMPORTANT: Attendance.status enum is { present, absent, half_day,
        // on_leave, holiday, weekend }. "late" is NOT a valid status.
        // Late employees are stored as status="present" with lateMinutes > 0.
        // Reports that need to identify late employees must filter on
        // lateMinutes > 0, not status = "late".
        let lateMinutes = 0;
        const status = "present";

        if (employee.shift) {
            const shiftStart = buildBusinessDateTime(today, employee.shift.startTime);

            // Late = arrived after shiftStart + graceMinutes
            const lateThreshold = new Date(shiftStart.getTime() + (employee.shift.graceMinutes || 15) * 60000);

            if (now > lateThreshold) {
                lateMinutes = differenceInMinutes(now, shiftStart);
            }
        }

        // ── Build notes with geo-fence + anti-buddy-punch info ──
        const notesParts: string[] = [];

        if (geoFenceStatus === "outside") {
            notesParts.push(`⚠️ Geo-fence: outside (${geoFenceDistance}m away)`);
        } else if (geoFenceStatus === "inside") {
            notesParts.push(`✅ Geo-fence: inside (${geoFenceDistance}m)`);
        }

        // IP and device fingerprint stored in notes for audit trail
        if (clientIp !== "unknown") {
            notesParts.push(`ip:${clientIp}`);
        }
        if (deviceFingerprint) {
            notesParts.push(`device:${deviceFingerprint}`);
        }
        if (buddyPunchWarning) {
            notesParts.push(buddyPunchWarning);
        }
        if (photoUrl) {
            notesParts.push(`photo:${photoUrl}`);
        }

        const notes = notesParts.length > 0 ? notesParts.join(" | ") : undefined;

        const attendance = await prisma.attendance.create({
            data: {
                employeeId: employee.id,
                date: today,
                checkIn: now,
                checkInLocation: location ? JSON.stringify(location) : null,
                source: source || "web",
                status,
                lateMinutes,
                notes,
            }
        });

        return NextResponse.json({
            ...attendance,
            geoFence: {
                status: geoFenceStatus,
                distance: geoFenceDistance,
            },
        });

    } catch (error) {
        attendanceLogger.error({ err: error }, "CHECK_IN_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const auth = await requireEmployee();
        if (!isAuthenticated(auth)) return auth;

        const employee = await prisma.employee.findFirst({
            where: { id: auth.employeeId, organizationId: auth.organizationId },
            include: {
                shift: true,
                branch: {
                    select: {
                        id: true,
                        name: true,
                        latitude: true,
                        longitude: true,
                        geoFenceRadius: true,
                    },
                },
            },
        });
        const organization = await prisma.organization.findUnique({
            where: { id: auth.organizationId },
            select: { settings: true },
        });

        if (!employee) {
            return new NextResponse("Employee profile not found", { status: 400 });
        }

        const { location } = await req.json();

        const now = new Date();
        const today = startOfBusinessDay(now);

        const attendance = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: employee.id,
                    date: today,
                }
            }
        });

        if (!attendance) {
            return new NextResponse("No check-in record found for today", { status: 404 });
        }

        if (attendance.checkOut) {
            return new NextResponse("Already checked out", { status: 400 });
        }

        // Calculate Early Leave / Overtime
        let earlyLeaveMinutes = 0;
        let overtimeMinutes = 0;

        if (employee.shift) {
            const shiftEnd = buildBusinessDateTime(employee.shift.crossesMidnight ? addBusinessDays(today, 1) : today, employee.shift.endTime);

            if (now < shiftEnd) {
                earlyLeaveMinutes = differenceInMinutes(shiftEnd, now);
            } else {
                overtimeMinutes = differenceInMinutes(now, shiftEnd);
            }
        }

        // ── Checkout Geo-Fence Validation (log only, never blocks) ──
        const geoSettings = getGeoFenceSettings(organization?.settings);
        let checkoutGeoNote = "";

        if (geoSettings.enabled && location?.lat && location?.lng) {
            const branch = employee.branch;
            if (branch?.latitude && branch?.longitude) {
                const geoResult = validateGeoFence(
                    { latitude: location.lat, longitude: location.lng },
                    { latitude: branch.latitude, longitude: branch.longitude },
                    branch.geoFenceRadius || 200
                );

                checkoutGeoNote = geoResult.isWithinFence
                    ? ` | ✅ Checked out within geo-fence (${geoResult.distanceMeters}m)`
                    : ` | ⚠️ Checked out from outside geo-fence (${geoResult.distanceMeters}m away)`;

                if (!geoResult.isWithinFence) {
                    attendanceLogger.info({
                        employeeId: employee.id,
                        distance: geoResult.distanceMeters,
                        branchName: branch.name,
                    }, "GEO_FENCE_CHECKOUT_OUTSIDE");
                }
            }
        }

        // Append checkout geo note to existing notes
        const updatedNotes = attendance.notes
            ? `${attendance.notes}${checkoutGeoNote}`
            : checkoutGeoNote ? checkoutGeoNote.replace(" | ", "") : undefined;

        const updated = await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
                checkOut: now,
                checkOutLocation: location ? JSON.stringify(location) : null,
                earlyLeaveMinutes,
                overtimeMinutes,
                ...(updatedNotes && { notes: updatedNotes }),
            }
        });

        return NextResponse.json(updated);

    } catch (error) {
        attendanceLogger.error({ err: error }, "CHECK_OUT_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
