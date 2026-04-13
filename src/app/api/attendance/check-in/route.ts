import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfDay, differenceInMinutes, set } from "date-fns";
import { attendanceLogger } from "@/lib/logger";
import { validateGeoFence } from "@/lib/attendance-engine";

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
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                employee: {
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
                },
                organization: {
                    select: { settings: true },
                },
            },
        });

        if (!user?.employee) {
            return new NextResponse("Employee profile not found", { status: 400 });
        }

        const { location, source } = await req.json(); // { lat, lng }

        const now = new Date();
        const today = startOfDay(now);

        // Check if already checked in
        const existing = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: user.employee.id,
                    date: today,
                }
            }
        });

        if (existing) {
            return new NextResponse("Already checked in today", { status: 400 });
        }

        // ── GPS Geo-Fence Validation ──────────────────────────────
        const geoSettings = getGeoFenceSettings(user.organization?.settings);
        let geoFenceStatus: "inside" | "outside" | "unchecked" = "unchecked";
        let geoFenceDistance: number | null = null;

        if (geoSettings.enabled && location?.lat && location?.lng) {
            const branch = user.employee.branch;

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
                        employeeId: user.employee.id,
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
                        employeeId: user.employee.id,
                        distance: geoResult.distanceMeters,
                        branchName: branch.name,
                    }, "GEO_FENCE_SOFT_WARNING");
                }
            }
        }

        // ── Calculate Late Status ─────────────────────────────────
        let lateMinutes = 0;
        let status = "present";

        if (user.employee.shift) {
            const [hours, minutes] = user.employee.shift.startTime.split(':').map(Number);
            const shiftStart = set(now, { hours, minutes, seconds: 0, milliseconds: 0 });

            // Add grace period
            const lateThreshold = new Date(shiftStart.getTime() + (user.employee.shift.graceMinutes || 15) * 60000);

            if (now > lateThreshold) {
                lateMinutes = differenceInMinutes(now, shiftStart);
                status = "late";
            }
        }

        // ── Build notes with geo-fence info ──────────────────────
        const notes = geoFenceStatus === "outside"
            ? `⚠️ Checked in from outside geo-fence (${geoFenceDistance}m away)`
            : geoFenceStatus === "inside"
            ? `✅ Checked in within geo-fence (${geoFenceDistance}m)`
            : undefined;

        const attendance = await prisma.attendance.create({
            data: {
                employeeId: user.employee.id,
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
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                employee: {
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
                },
                organization: {
                    select: { settings: true },
                },
            },
        });

        if (!user?.employee) {
            return new NextResponse("Employee profile not found", { status: 400 });
        }

        const { location } = await req.json();

        const now = new Date();
        const today = startOfDay(now);

        const attendance = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: user.employee.id,
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

        if (user.employee.shift) {
            const [hours, minutes] = user.employee.shift.endTime.split(':').map(Number);
            const shiftEnd = set(now, { hours, minutes, seconds: 0, milliseconds: 0 });

            if (now < shiftEnd) {
                earlyLeaveMinutes = differenceInMinutes(shiftEnd, now);
            } else {
                overtimeMinutes = differenceInMinutes(now, shiftEnd);
            }
        }

        // ── Checkout Geo-Fence Validation (log only, never blocks) ──
        const geoSettings = getGeoFenceSettings(user.organization?.settings);
        let checkoutGeoNote = "";

        if (geoSettings.enabled && location?.lat && location?.lng) {
            const branch = user.employee.branch;
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
                        employeeId: user.employee.id,
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
