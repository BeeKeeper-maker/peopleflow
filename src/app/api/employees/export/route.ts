/**
 * Employee Export API
 * 
 * Exports employee data in CSV or Excel format
 * Supports filtering by department, status, etc.
 */

import { NextRequest } from "next/server";

import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { errorResponse, ErrorCodes } from "@/lib/api-response";
import { apiLogger } from "@/lib/logger";

const EMPLOYEE_EXPORT_HEADERS = [
    "Employee Code",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Department",
    "Designation",
    "Join Date",
    "Employment Type",
    "Status",
    "Gender",
    "Date of Birth",
    "Bank Name",
    "Account Number",
] as const;

type EmployeeExportRow = Record<(typeof EMPLOYEE_EXPORT_HEADERS)[number], string>;

function sanitizeSpreadsheetValue(value: unknown): string {
    const stringValue = String(value ?? "");
    return /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue;
}

function escapeCsvValue(value: unknown): string {
    const stringValue = sanitizeSpreadsheetValue(value);
    if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function escapeHtml(value: unknown): string {
    return sanitizeSpreadsheetValue(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const { searchParams } = new URL(req.url);
        const format = searchParams.get("format") || "csv";
        const departmentId = searchParams.get("departmentId");
        const status = searchParams.get("status");

        // Build query
        const where: Record<string, unknown> = {
            organizationId: auth.organizationId,
            deletedAt: null,
        };

        if (departmentId) where.departmentId = departmentId;
        if (status) where.employmentStatus = status;

        // Fetch employees
        const employees = await auth.withDB((db) => db.employee.findMany({
            where,
            include: {
                department: { select: { name: true } },
                designation: { select: { name: true } },
            },
            orderBy: { employeeCode: "asc" },
        }));

        // Format data for export
        const exportData: EmployeeExportRow[] = employees.map(emp => ({
            "Employee Code": emp.employeeCode,
            "First Name": emp.firstName,
            "Last Name": emp.lastName,
            "Email": emp.email || "",
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
            const BOM = "\uFEFF"; // For Excel UTF-8

            const csvContent = BOM + [
                EMPLOYEE_EXPORT_HEADERS.join(","),
                ...exportData.map(row =>
                    EMPLOYEE_EXPORT_HEADERS.map(h => escapeCsvValue(row[h])).join(",")
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

        if (format === "excel" || format === "xls") {
            const headerRow = EMPLOYEE_EXPORT_HEADERS
                .map((header) => `<th>${escapeHtml(header)}</th>`)
                .join("");
            const bodyRows = exportData
                .map((row) => `<tr>${EMPLOYEE_EXPORT_HEADERS.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`)
                .join("");
            const workbookHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Employees</title></head>
<body><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body>
</html>`;
            const filename = `employees-export-${new Date().toISOString().split("T")[0]}.xls`;

            return new Response(workbookHtml, {
                headers: {
                    "Content-Type": "application/vnd.ms-excel; charset=utf-8",
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
