import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { biometricLogger } from "@/lib/logger";

/**
 * POST /api/biometric-devices/auto-map
 *
 * Intelligent Auto-Mapping Engine:
 * Takes a list of device users and attempts to match them to HRMS employees.
 *
 * Matching Strategy (Priority Order):
 *   1. Exact biometricUserId match (already mapped)
 *   2. Exact employeeCode ↔ device userId match
 *   3. Fuzzy name match (device user name ↔ employee firstName + lastName)
 *
 * Body: { deviceUsers: [{ userId, name }], mappings: [{ userId, employeeId }] }
 *   - If `mappings` is provided → apply manual/confirmed mappings
 *   - If only `deviceUsers` → return suggestions without applying
 */
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const body = await req.json();
        const { deviceUsers, mappings } = body;

        // ── Mode 1: Apply confirmed mappings ──────────────────────
        if (mappings && Array.isArray(mappings) && mappings.length > 0) {
            const results = [];

            for (const mapping of mappings) {
                const { deviceUserId, employeeId } = mapping;

                if (!deviceUserId || !employeeId) continue;

                try {
                    // Verify employee belongs to this org
                    const employee = await auth.withDB((db) => db.employee.findFirst({
                        where: { id: employeeId, organizationId: auth.organizationId },
                        select: { id: true, firstName: true, lastName: true, employeeCode: true },
                    }));

                    if (!employee) {
                        results.push({ deviceUserId, success: false, error: "Employee not found" });
                        continue;
                    }

                    // Check if this biometric ID is already taken by another employee
                    const existing = await auth.withDB((db) => db.employee.findFirst({
                        where: {
                            organizationId: auth.organizationId,
                            biometricUserId: String(deviceUserId),
                            id: { not: employeeId },
                        },
                    }));

                    if (existing) {
                        results.push({
                            deviceUserId,
                            success: false,
                            error: `Biometric ID already assigned to ${existing.firstName} ${existing.lastName}`,
                        });
                        continue;
                    }

                    // Apply mapping
                    await auth.withDB((db) => db.employee.update({
                        where: { id: employeeId },
                        data: { biometricUserId: String(deviceUserId) },
                    }));

                    results.push({
                        deviceUserId,
                        employeeId,
                        employeeName: `${employee.firstName} ${employee.lastName}`,
                        success: true,
                    });
                } catch (err) {
                    results.push({
                        deviceUserId,
                        success: false,
                        error: err instanceof Error ? err.message : "Unknown error",
                    });
                }
            }

            const successCount = results.filter((r) => r.success).length;
            return NextResponse.json({
                success: true,
                applied: successCount,
                total: mappings.length,
                results,
            });
        }

        // ── Mode 2: Suggest auto-mappings ─────────────────────────
        if (!deviceUsers || !Array.isArray(deviceUsers)) {
            return NextResponse.json(
                { error: "deviceUsers array is required" },
                { status: 400 }
            );
        }

        // Get all employees in this org (active, not soft-deleted)
        const employees = await auth.withDB((db) => db.employee.findMany({
            where: {
                organizationId: auth.organizationId,
                deletedAt: null,
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                biometricUserId: true,
                department: { select: { name: true } },
                designation: { select: { name: true } },
            },
        }));

        const suggestions = [];

        for (const deviceUser of deviceUsers) {
            const { userId, name } = deviceUser;
            const userIdStr = String(userId);

            // Strategy 1: Already mapped by biometricUserId
            const alreadyMapped = employees.find(
                (e) => e.biometricUserId === userIdStr
            );

            if (alreadyMapped) {
                suggestions.push({
                    deviceUserId: userIdStr,
                    deviceUserName: name || `User ${userId}`,
                    matchType: "exact" as const,
                    confidence: 100,
                    employee: {
                        id: alreadyMapped.id,
                        name: `${alreadyMapped.firstName} ${alreadyMapped.lastName}`,
                        code: alreadyMapped.employeeCode,
                        department: alreadyMapped.department?.name,
                        designation: alreadyMapped.designation?.name,
                    },
                });
                continue;
            }

            // Strategy 2: Match by employeeCode ↔ deviceUserId
            const codeMatch = employees.find(
                (e) =>
                    !e.biometricUserId && // Don't overwrite existing mappings
                    (e.employeeCode === userIdStr ||
                        e.employeeCode.replace(/\D/g, "") === userIdStr) // Strip non-digits from code
            );

            if (codeMatch) {
                suggestions.push({
                    deviceUserId: userIdStr,
                    deviceUserName: name || `User ${userId}`,
                    matchType: "code" as const,
                    confidence: 90,
                    employee: {
                        id: codeMatch.id,
                        name: `${codeMatch.firstName} ${codeMatch.lastName}`,
                        code: codeMatch.employeeCode,
                        department: codeMatch.department?.name,
                        designation: codeMatch.designation?.name,
                    },
                });
                continue;
            }

            // Strategy 3: Fuzzy name match
            if (name) {
                const normalizedDeviceName = name.toLowerCase().trim();
                let bestMatch: (typeof employees)[0] | null = null;
                let bestScore = 0;

                for (const emp of employees) {
                    if (emp.biometricUserId) continue; // Skip already-mapped

                    const empFullName = `${emp.firstName} ${emp.lastName}`.toLowerCase().trim();

                    // Calculate similarity score
                    let score = 0;

                    // Exact full name match
                    if (normalizedDeviceName === empFullName) {
                        score = 85;
                    }
                    // First name match
                    else if (
                        normalizedDeviceName.includes(emp.firstName.toLowerCase()) ||
                        emp.firstName.toLowerCase().includes(normalizedDeviceName)
                    ) {
                        score = 60;
                        // Bonus if last name also partially matches
                        if (normalizedDeviceName.includes(emp.lastName.toLowerCase())) {
                            score = 80;
                        }
                    }
                    // Split comparison
                    else {
                        const deviceParts = normalizedDeviceName.split(/[\s._-]+/);
                        const empParts = empFullName.split(/\s+/);
                        const matchingParts = deviceParts.filter((dp: string) =>
                            empParts.some((ep) => ep.includes(dp) || dp.includes(ep))
                        );
                        if (matchingParts.length > 0) {
                            score = Math.round(
                                (matchingParts.length / Math.max(deviceParts.length, empParts.length)) * 70
                            );
                        }
                    }

                    if (score > bestScore && score >= 50) {
                        bestScore = score;
                        bestMatch = emp;
                    }
                }

                if (bestMatch) {
                    suggestions.push({
                        deviceUserId: userIdStr,
                        deviceUserName: name,
                        matchType: "name" as const,
                        confidence: bestScore,
                        employee: {
                            id: bestMatch.id,
                            name: `${bestMatch.firstName} ${bestMatch.lastName}`,
                            code: bestMatch.employeeCode,
                            department: bestMatch.department?.name,
                            designation: bestMatch.designation?.name,
                        },
                    });
                    continue;
                }
            }

            // No match found
            suggestions.push({
                deviceUserId: userIdStr,
                deviceUserName: name || `User ${userId}`,
                matchType: "none" as const,
                confidence: 0,
                employee: null,
            });
        }

        // Summary stats
        const mapped = suggestions.filter((s) => s.matchType === "exact").length;
        const suggested = suggestions.filter((s) => s.matchType === "code" || s.matchType === "name").length;
        const unmapped = suggestions.filter((s) => s.matchType === "none").length;

        return NextResponse.json({
            success: true,
            suggestions,
            summary: { total: suggestions.length, mapped, suggested, unmapped },
            // Return all unmapped employees for manual dropdown
            availableEmployees: employees
                .filter((e) => !e.biometricUserId)
                .map((e) => ({
                    id: e.id,
                    name: `${e.firstName} ${e.lastName}`,
                    code: e.employeeCode,
                    department: e.department?.name,
                })),
        });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        biometricLogger.error({ err: error, errorId }, "AUTO_MAP_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
