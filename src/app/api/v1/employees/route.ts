/**
 * External API v1: Employees
 *
 * GET /api/v1/employees — List employees (paginated, filterable)
 * GET /api/v1/employees?id=xxx — Get single employee
 *
 * Authenticated via API key. Scoped to the key's organization.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey, hasPermission } from "@/lib/api-key-auth";

export async function GET(request: NextRequest) {
    const auth = await authenticateApiKey(request);
    if (!auth.valid) return auth.response;

    if (!hasPermission(auth, "employees:read")) {
        return NextResponse.json(
            { error: "Insufficient permissions", required: "employees:read" },
            { status: 403 }
        );
    }

    try {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "25")));
        const search = url.searchParams.get("search")?.trim();
        const department = url.searchParams.get("department");

        // Single employee lookup
        if (id) {
            const employee = await prisma.employee.findFirst({
                where: {
                    id,
                    organizationId: auth.organizationId,
                },
                include: {
                    department: { select: { id: true, name: true } },
                    branch: { select: { id: true, name: true } },
                    designation: { select: { id: true, name: true } },
                },
            });

            if (!employee) {
                return NextResponse.json(
                    { error: "Employee not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                data: sanitizeEmployee(employee),
            });
        }

        // Build where clause (always scoped to org)
        const where: Record<string, unknown> = {
            organizationId: auth.organizationId,
        };

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { employeeCode: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }

        if (department) {
            where.departmentId = department;
        }

        const [employees, total] = await prisma.$transaction([
            prisma.employee.findMany({
                where,
                include: {
                    department: { select: { id: true, name: true } },
                    branch: { select: { id: true, name: true } },
                    designation: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.employee.count({ where }),
        ]);

        return NextResponse.json({
            data: employees.map(sanitizeEmployee),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            _links: {
                self: `/api/v1/employees?page=${page}&limit=${limit}`,
                next:
                    page * limit < total
                        ? `/api/v1/employees?page=${page + 1}&limit=${limit}`
                        : null,
                prev:
                    page > 1
                        ? `/api/v1/employees?page=${page - 1}&limit=${limit}`
                        : null,
            },
        });
    } catch (error) {
        console.error("[API_V1_EMPLOYEES] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// Strip sensitive fields from employee data
function sanitizeEmployee(emp: Record<string, unknown>): Record<string, unknown> {
    const {
        organizationId: _orgId,
        ...safe
    } = emp as Record<string, unknown>;
    return safe;
}
