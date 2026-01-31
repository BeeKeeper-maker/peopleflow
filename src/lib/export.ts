import * as XLSX from "xlsx"
import { saveAs } from "file-saver"

interface ExportOptions {
    filename: string
    sheetName?: string
}

/**
 * Export data to Excel (.xlsx) format
 */
export function exportToExcel<T extends Record<string, any>>(
    data: T[],
    options: ExportOptions
): void {
    const { filename, sheetName = "Sheet1" } = options

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map((key) => {
        const maxLength = Math.max(
            key.length,
            ...data.map((row) => String(row[key] || "").length)
        )
        return { wch: Math.min(maxLength + 2, 50) }
    })
    worksheet["!cols"] = colWidths

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
    })

    // Create blob and save
    const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    saveAs(blob, `${filename}.xlsx`)
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
        console.warn("No data to export")
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
                    const stringValue = String(value ?? "")
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
