import { saveAs } from "file-saver"
import { exportLogger } from "@/lib/logger"

interface ExportOptions {
    filename: string
    sheetName?: string
}

function sanitizeSpreadsheetValue(value: unknown): string {
    const stringValue = String(value ?? "")
    return /^[=+\-@]/.test(stringValue) ? `'${stringValue}` : stringValue
}

function escapeHtml(value: unknown): string {
    return sanitizeSpreadsheetValue(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

/**
 * Export data to an Excel-compatible HTML workbook without the vulnerable xlsx dependency.
 */
export function exportToExcel<T extends Record<string, any>>(
    data: T[],
    options: ExportOptions
): void {
    const { filename, sheetName = "Sheet1" } = options

    if (data.length === 0) {
        exportLogger.warn("No data to export")
        return
    }

    const headers = Object.keys(data[0])
    const headerRow = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")
    const bodyRows = data
        .map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`)
        .join("")

    const workbookHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(sheetName)}</title></head>
<body><table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table></body>
</html>`

    const blob = new Blob([workbookHtml], {
        type: "application/vnd.ms-excel;charset=utf-8;",
    })

    saveAs(blob, `${filename}.xls`)
}

/**
 * Export data to CSV format
 */
export function exportToCSV<T extends Record<string, any>>(
    data: T[],
    options: ExportOptions
): void {
    const { filename } = options

    if (data.length === 0) {
        exportLogger.warn("No data to export")
        return
    }

    const headers = Object.keys(data[0])
    const csvContent = [
        headers.join(","),
        ...data.map((row) =>
            headers
                .map((header) => {
                    const value = row[header]
                    // Escape quotes and wrap in quotes if contains comma
                    const stringValue = sanitizeSpreadsheetValue(value)
                    if (stringValue.includes(",") || stringValue.includes('"')) {
                        return `"${stringValue.replace(/"/g, '""')}"`
                    }
                    return stringValue
                })
                .join(",")
        ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    saveAs(blob, `${filename}.csv`)
}

/**
 * Format employee data for export
 */
export function formatEmployeeExport(employees: any[]) {
    return employees.map((emp) => ({
        "Employee Code": emp.employeeCode,
        "First Name": emp.firstName,
        "Last Name": emp.lastName,
        "Email": emp.workEmail || emp.personalEmail,
        "Phone": emp.phone,
        "Department": emp.department?.name || "-",
        "Designation": emp.designation?.name || "-",
        "Gender": emp.gender,
        "Date of Birth": emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : "-",
        "Join Date": emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : "-",
        "Status": emp.employmentStatus,
    }))
}

/**
 * Format attendance data for export
 */
export function formatAttendanceExport(attendances: any[]) {
    return attendances.map((att) => ({
        "Employee Code": att.employee?.employeeCode || "-",
        "Employee Name": att.employee ? `${att.employee.firstName} ${att.employee.lastName}` : "-",
        "Date": new Date(att.date).toLocaleDateString(),
        "Check In": att.checkIn ? new Date(att.checkIn).toLocaleTimeString() : "-",
        "Check Out": att.checkOut ? new Date(att.checkOut).toLocaleTimeString() : "-",
        "Status": att.status,
        "Working Hours": att.totalHours ? att.totalHours.toFixed(2) : "-",
        "Overtime": att.overtime ? att.overtime.toFixed(2) : "0",
    }))
}

/**
 * Format leave report for export
 */
export function formatLeaveExport(leaves: any[]) {
    return leaves.map((leave) => ({
        "Employee Code": leave.employee?.employeeCode || "-",
        "Employee Name": leave.employee ? `${leave.employee.firstName} ${leave.employee.lastName}` : "-",
        "Leave Type": leave.leaveType?.name || "-",
        "From Date": new Date(leave.fromDate).toLocaleDateString(),
        "To Date": new Date(leave.toDate).toLocaleDateString(),
        "Total Days": leave.totalDays,
        "Status": leave.status,
        "Reason": leave.reason || "-",
    }))
}

/**
 * Format payroll data for export
 */
export function formatPayrollExport(slips: any[]) {
    return slips.map((slip) => ({
        "Employee Code": slip.employee?.employeeCode || "-",
        "Employee Name": slip.employee ? `${slip.employee.firstName} ${slip.employee.lastName}` : "-",
        "Department": slip.employee?.department?.name || "-",
        "Month": slip.month,
        "Year": slip.year,
        "Basic Salary": slip.basicSalary,
        "House Rent": slip.houseRent,
        "Medical": slip.medicalAllowance,
        "Conveyance": slip.conveyance,
        "Gross Salary": slip.grossSalary,
        "PF Deduction": slip.pfEmployee,
        "Other Deductions": slip.totalDeductions - slip.pfEmployee,
        "Total Deductions": slip.totalDeductions,
        "Net Salary": slip.netSalary,
        "Status": slip.status,
    }))
}

/**
 * Export data to PDF format using print dialog
 */
export function exportToPDF<T extends Record<string, any>>(
    data: T[],
    options: ExportOptions & { title?: string }
): void {
    const { filename, title = "Report" } = options

    if (data.length === 0) {
        exportLogger.warn("No data to export")
        return
    }

    const headers = Object.keys(data[0])

    // Create a new window for printing
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
        alert("Please allow popups to export PDF")
        return
    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title} - ${filename}</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    margin: 20px;
                    color: #333;
                }
                h1 {
                    text-align: center;
                    color: #1a1a2e;
                    margin-bottom: 10px;
                }
                .subtitle {
                    text-align: center;
                    color: #666;
                    margin-bottom: 20px;
                    font-size: 12px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    font-size: 11px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #1a1a2e;
                    color: white;
                    font-weight: 600;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                tr:hover {
                    background-color: #f1f1f1;
                }
                .footer {
                    margin-top: 20px;
                    text-align: center;
                    font-size: 10px;
                    color: #999;
                }
                @media print {
                    body { margin: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
            <table>
                <thead>
                    <tr>
                        ${headers.map(h => `<th>${h}</th>`).join("")}
                    </tr>
                </thead>
                <tbody>
                    ${data.map(row => `
                        <tr>
                            ${headers.map(h => `<td>${row[h] ?? "-"}</td>`).join("")}
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            <p class="footer">PeopleFlow HRMS - ${filename}</p>
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    };
                };
            </script>
        </body>
        </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
}
