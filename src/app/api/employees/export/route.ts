/**
 * Employee Export API
 * 
 * Exports employee data in CSV or Excel format
 * Supports filtering by department, status, etc.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse, ErrorCodes } from "@/lib/api-response";
import { apiLogger } from "@/lib/logger";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return errorResponse(ErrorCodes.UNAUTHORIZED, "Authentication required");
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user?.organizationId) {
            return errorResponse(ErrorCodes.NOT_FOUND, "Organization not found");
        }

        const { searchParams } = new URL(req.url);
        const format = searchParams.get("format") || "csv";
        const departmentId = searchParams.get("departmentId");
        const status = searchParams.get("status");

        // Build query
        const where: Record<string, unknown> = {
            organizationId: user.organizationId,
            deletedAt: null,
        };

        if (departmentId) where.departmentId = departmentId;
        if (status) where.employmentStatus = status;

        // Fetch employees
        const employees = await prisma.employee.findMany({
            where,
            include: {
                department: { select: { name: true } },
                designation: { select: { name: true } },
            },
            orderBy: { employeeCode: "asc" },
        });

        // Format data for export
        const exportData = employees.map(emp => ({
            "Employee Code": emp.employeeCode,
            "First Name": emp.firstName,
            "Last Name": emp.lastName,
            "Email": emp.email,
            "Phone": emp.phone || "",
            "Department": emp.department?.name || "",
            "Designation": emp.designation?.name || "",
            "Join Date": emp.joiningDate ? new Date(emp.joiningDate).toISOString().split("T")[0] : "",
            "Employment Type": emp.employmentType,
            "Status": emp.employmentStatus,
            "Gender": emp.gender || "",
            "Date of Birth": emp.dateOfBirth ? new Date(emp.dateOfBirth).toISOString().split("T")[0] : "",
            "Bank Name": emp.bankName || "",
            "Account Number": emp.accountNumber || "",
        }));

        if (format === "csv") {
            // Generate CSV
            const headers = Object.keys(exportData[0] || {});
            const BOM = "\uFEFF"; // For Excel UTF-8

            const csvContent = BOM + [
                headers.join(","),
                ...exportData.map(row =>
                    headers.map(h => {
                        const val = String(row[h as keyof typeof row] ?? "");
                        return val.includes(",") || val.includes('"')
                            ? `"${val.replace(/"/g, '""')}"`
                            : val;
                    }).join(",")
                ),
            ].join("\r\n");

            const filename = `employees-export-${new Date().toISOString().split("T")[0]}.csv`;

            return new Response(csvContent, {
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="${filename}"`,
                },
            });
        }

        // Return JSON if format is not recognized
        return new Response(JSON.stringify(exportData), {
            headers: {
                "Content-Type": "application/json",
            },
        });

    } catch (error) {
        apiLogger.error({ err: error }, "EXPORT_ERROR:");
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Export failed");
    }
}
