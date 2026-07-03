/**
 * PeopleFlow Custom Report Engine
 *
 * Executes saved report configurations against the database and returns
 * structured data for table/chart rendering.
 *
 * Data sources:
 *   - employees: Employee directory with department/designation/branch
 *   - attendance: Attendance records with late/early/OT metrics
 *   - payroll: Salary slips with earnings/deductions
 *   - leave: Leave applications with status/balance
 *   - expenses: Expense claims with status/amount
 *   - loans: Loan records with balance/EMI
 *
 * Each data source defines:
 *   - availableFields: the columns that can be selected
 *   - availableFilters: the filters that can be applied
 *   - execute(): builds and runs the Prisma query
 */

import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";

export interface ReportField {
    key: string;
    label: string;
    type: "string" | "number" | "date" | "boolean" | "currency";
    groupable?: boolean;
}

export interface ReportFilter {
    key: string;
    label: string;
    type: "text" | "select" | "date" | "dateRange" | "number";
    options?: Array<{ value: string; label: string }>;
}

export interface ReportResult {
    columns: Array<{ key: string; label: string; type: string }>;
    rows: Record<string, unknown>[];
    summary?: Record<string, number>;
    total: number;
}

// ── Data Source Definitions ──────────────────────────────────────────

const EMPLOYEE_FIELDS: ReportField[] = [
    { key: "employeeCode", label: "Employee Code", type: "string" },
    { key: "firstName", label: "First Name", type: "string", groupable: true },
    { key: "lastName", label: "Last Name", type: "string" },
    { key: "email", label: "Email", type: "string" },
    { key: "phone", label: "Phone", type: "string" },
    { key: "department.name", label: "Department", type: "string", groupable: true },
    { key: "designation.name", label: "Designation", type: "string", groupable: true },
    { key: "branch.name", label: "Branch", type: "string", groupable: true },
    { key: "employmentType", label: "Employment Type", type: "string", groupable: true },
    { key: "employmentStatus", label: "Status", type: "string", groupable: true },
    { key: "joiningDate", label: "Joining Date", type: "date" },
    { key: "gender", label: "Gender", type: "string", groupable: true },
    { key: "reportingManager.firstName", label: "Reporting Manager", type: "string" },
];

const EMPLOYEE_FILTERS: ReportFilter[] = [
    { key: "departmentId", label: "Department", type: "select" },
    { key: "designationId", label: "Designation", type: "select" },
    { key: "branchId", label: "Branch", type: "select" },
    { key: "employmentStatus", label: "Status", type: "select", options: [
        { value: "active", label: "Active" },
        { value: "resigned", label: "Resigned" },
        { value: "terminated", label: "Terminated" },
        { value: "retired", label: "Retired" },
    ]},
    { key: "employmentType", label: "Employment Type", type: "select", options: [
        { value: "permanent", label: "Permanent" },
        { value: "contractual", label: "Contractual" },
        { value: "intern", label: "Intern" },
        { value: "probation", label: "Probation" },
    ]},
    { key: "gender", label: "Gender", type: "select", options: [
        { value: "male", label: "Male" },
        { value: "female", label: "Female" },
        { value: "other", label: "Other" },
    ]},
    { key: "joiningDateFrom", label: "Joined From", type: "date" },
    { key: "joiningDateTo", label: "Joined To", type: "date" },
];

const ATTENDANCE_FIELDS: ReportField[] = [
    { key: "employee.firstName", label: "First Name", type: "string" },
    { key: "employee.lastName", label: "Last Name", type: "string" },
    { key: "employee.employeeCode", label: "Employee Code", type: "string" },
    { key: "employee.department.name", label: "Department", type: "string", groupable: true },
    { key: "date", label: "Date", type: "date", groupable: true },
    { key: "checkIn", label: "Check In", type: "date" },
    { key: "checkOut", label: "Check Out", type: "date" },
    { key: "status", label: "Status", type: "string", groupable: true },
    { key: "lateMinutes", label: "Late (min)", type: "number" },
    { key: "earlyLeaveMinutes", label: "Early Leave (min)", type: "number" },
    { key: "overtimeMinutes", label: "Overtime (min)", type: "number" },
    { key: "source", label: "Source", type: "string", groupable: true },
];

const PAYROLL_FIELDS: ReportField[] = [
    { key: "employee.firstName", label: "First Name", type: "string" },
    { key: "employee.lastName", label: "Last Name", type: "string" },
    { key: "employee.employeeCode", label: "Employee Code", type: "string" },
    { key: "employee.department.name", label: "Department", type: "string", groupable: true },
    { key: "month", label: "Month", type: "number", groupable: true },
    { key: "year", label: "Year", type: "number", groupable: true },
    { key: "basicSalary", label: "Basic", type: "currency" },
    { key: "grossSalary", label: "Gross", type: "currency" },
    { key: "totalDeductions", label: "Deductions", type: "currency" },
    { key: "netSalary", label: "Net Salary", type: "currency" },
    { key: "festivalBonus", label: "Festival Bonus", type: "currency" },
    { key: "lateDeduction", label: "Late Deduction", type: "currency" },
    { key: "loanDeduction", label: "Loan Deduction", type: "currency" },
    { key: "status", label: "Status", type: "string", groupable: true },
];

const LEAVE_FIELDS: ReportField[] = [
    { key: "employee.firstName", label: "First Name", type: "string" },
    { key: "employee.lastName", label: "Last Name", type: "string" },
    { key: "employee.employeeCode", label: "Employee Code", type: "string" },
    { key: "employee.department.name", label: "Department", type: "string", groupable: true },
    { key: "leaveType.name", label: "Leave Type", type: "string", groupable: true },
    { key: "fromDate", label: "From", type: "date" },
    { key: "toDate", label: "To", type: "date" },
    { key: "totalDays", label: "Days", type: "number" },
    { key: "status", label: "Status", type: "string", groupable: true },
    { key: "halfDay", label: "Half Day", type: "boolean" },
];

const EXPENSE_FIELDS: ReportField[] = [
    { key: "employee.firstName", label: "First Name", type: "string" },
    { key: "employee.lastName", label: "Last Name", type: "string" },
    { key: "employee.employeeCode", label: "Employee Code", type: "string" },
    { key: "category.name", label: "Category", type: "string", groupable: true },
    { key: "title", label: "Title", type: "string" },
    { key: "amount", label: "Amount", type: "currency" },
    { key: "expenseDate", label: "Date", type: "date" },
    { key: "status", label: "Status", type: "string", groupable: true },
];

const LOAN_FIELDS: ReportField[] = [
    { key: "employee.firstName", label: "First Name", type: "string" },
    { key: "employee.lastName", label: "Last Name", type: "string" },
    { key: "employee.employeeCode", label: "Employee Code", type: "string" },
    { key: "type", label: "Loan Type", type: "string", groupable: true },
    { key: "amount", label: "Amount", type: "currency" },
    { key: "emiAmount", label: "EMI", type: "currency" },
    { key: "remainingAmount", label: "Remaining", type: "currency" },
    { key: "status", label: "Status", type: "string", groupable: true },
];

export const DATA_SOURCES: Record<
    string,
    { label: string; fields: ReportField[]; filters: ReportFilter[] }
> = {
    employees: { label: "Employees", fields: EMPLOYEE_FIELDS, filters: EMPLOYEE_FILTERS },
    attendance: { label: "Attendance", fields: ATTENDANCE_FIELDS, filters: [] },
    payroll: { label: "Payroll", fields: PAYROLL_FIELDS, filters: [] },
    leave: { label: "Leave Applications", fields: LEAVE_FIELDS, filters: [] },
    expenses: { label: "Expense Claims", fields: EXPENSE_FIELDS, filters: [] },
    loans: { label: "Loans", fields: LOAN_FIELDS, filters: [] },
};

// ── Report Execution ─────────────────────────────────────────────────

/**
 * Execute a saved report and return structured data.
 */
export async function executeReport(params: {
    organizationId: string;
    dataSource: string;
    fields: string[];
    filters: Record<string, unknown>;
    groupBy?: string | null;
    limit?: number;
}): Promise<ReportResult> {
    const { organizationId, dataSource, fields, filters, groupBy, limit = 1000 } = params;

    const columns = fields.map((key) => {
        const fieldDef = DATA_SOURCES[dataSource]?.fields.find((f) => f.key === key);
        return {
            key,
            label: fieldDef?.label || key,
            type: fieldDef?.type || "string",
        };
    });

    let rows: Record<string, unknown>[] = [];

    switch (dataSource) {
        case "employees":
            rows = await executeEmployeeReport(organizationId, fields, filters, limit);
            break;
        case "attendance":
            rows = await executeAttendanceReport(organizationId, fields, filters, limit);
            break;
        case "payroll":
            rows = await executePayrollReport(organizationId, fields, filters, limit);
            break;
        case "leave":
            rows = await executeLeaveReport(organizationId, fields, filters, limit);
            break;
        case "expenses":
            rows = await executeExpenseReport(organizationId, fields, filters, limit);
            break;
        case "loans":
            rows = await executeLoanReport(organizationId, fields, filters, limit);
            break;
        default:
            throw new Error(`Unknown data source: ${dataSource}`);
    }

    // Group by if specified
    let summary: Record<string, number> | undefined;
    if (groupBy) {
        const grouped = groupRows(rows, groupBy);
        rows = grouped.rows;
        summary = grouped.summary;
    }

    // Build numeric summary for currency/number fields
    if (!summary) {
        summary = {};
        for (const col of columns) {
            if (col.type === "currency" || col.type === "number") {
                const total = rows.reduce(
                    (sum, r) => sum + (Number(r[col.key]) || 0),
                    0,
                );
                summary[col.key] = Math.round(total * 100) / 100;
            }
        }
    }

    return { columns, rows, summary, total: rows.length };
}

// ── Data Source Executors ────────────────────────────────────────────

async function executeEmployeeReport(
    orgId: string,
    fields: string[],
    filters: Record<string, unknown>,
    limit: number,
): Promise<Record<string, unknown>[]> {
    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.designationId) where.designationId = filters.designationId;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.employmentStatus) where.employmentStatus = filters.employmentStatus;
    if (filters.employmentType) where.employmentType = filters.employmentType;
    if (filters.gender) where.gender = filters.gender;

    if (filters.joiningDateFrom || filters.joiningDateTo) {
        where.joiningDate = {};
        if (filters.joiningDateFrom) (where.joiningDate as Record<string, unknown>).gte = new Date(filters.joiningDateFrom as string);
        if (filters.joiningDateTo) (where.joiningDate as Record<string, unknown>).lte = new Date(filters.joiningDateTo as string);
    }

    const employees = await prisma.employee.findMany({
        where,
        include: {
            department: { select: { name: true } },
            designation: { select: { name: true } },
            branch: { select: { name: true } },
            reportingManager: { select: { firstName: true, lastName: true } },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
    });

    return employees.map((e) => flattenObject({
        employeeCode: e.employeeCode,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        "department.name": e.department?.name,
        "designation.name": e.designation?.name,
        "branch.name": e.branch?.name,
        employmentType: e.employmentType,
        employmentStatus: e.employmentStatus,
        joiningDate: e.joiningDate,
        gender: e.gender,
        "reportingManager.firstName": e.reportingManager
            ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}`
            : null,
    }, fields));
}

async function executeAttendanceReport(
    orgId: string,
    fields: string[],
    filters: Record<string, unknown>,
    limit: number,
): Promise<Record<string, unknown>[]> {
    const where: Record<string, unknown> = {
        employee: { organizationId: orgId },
    };

    if (filters.dateFrom || filters.dateTo) {
        where.date = {};
        if (filters.dateFrom) (where.date as Record<string, unknown>).gte = new Date(filters.dateFrom as string);
        if (filters.dateTo) (where.date as Record<string, unknown>).lte = new Date(filters.dateTo as string);
    }
    if (filters.status) where.status = filters.status;
    if (filters.employeeId) where.employeeId = filters.employeeId;

    const records = await prisma.attendance.findMany({
        where,
        include: {
            employee: {
                select: {
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                    department: { select: { name: true } },
                },
            },
        },
        take: limit,
        orderBy: { date: "desc" },
    });

    return records.map((a) => flattenObject({
        "employee.firstName": a.employee.firstName,
        "employee.lastName": a.employee.lastName,
        "employee.employeeCode": a.employee.employeeCode,
        "employee.department.name": a.employee.department?.name,
        date: a.date,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
        status: a.status,
        lateMinutes: a.lateMinutes,
        earlyLeaveMinutes: a.earlyLeaveMinutes,
        overtimeMinutes: a.overtimeMinutes,
        source: a.source,
    }, fields));
}

async function executePayrollReport(
    orgId: string,
    fields: string[],
    filters: Record<string, unknown>,
    limit: number,
): Promise<Record<string, unknown>[]> {
    const where: Record<string, unknown> = {
        employee: { organizationId: orgId },
    };

    if (filters.month) where.month = Number(filters.month);
    if (filters.year) where.year = Number(filters.year);
    if (filters.status) where.status = filters.status;

    const slips = await prisma.salarySlip.findMany({
        where,
        include: {
            employee: {
                select: {
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                    department: { select: { name: true } },
                },
            },
        },
        take: limit,
        orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return slips.map((s) => flattenObject({
        "employee.firstName": s.employee.firstName,
        "employee.lastName": s.employee.lastName,
        "employee.employeeCode": s.employee.employeeCode,
        "employee.department.name": s.employee.department?.name,
        month: s.month,
        year: s.year,
        basicSalary: s.basicSalary,
        grossSalary: s.grossSalary,
        totalDeductions: s.totalDeductions,
        netSalary: s.netSalary,
        festivalBonus: s.festivalBonus,
        lateDeduction: s.lateDeduction,
        loanDeduction: s.loanDeduction,
        status: s.status,
    }, fields));
}

async function executeLeaveReport(
    orgId: string,
    fields: string[],
    filters: Record<string, unknown>,
    limit: number,
): Promise<Record<string, unknown>[]> {
    const where: Record<string, unknown> = {
        employee: { organizationId: orgId },
    };

    if (filters.status) where.status = filters.status;
    if (filters.leaveTypeId) where.leaveTypeId = filters.leaveTypeId;

    const apps = await prisma.leaveApplication.findMany({
        where,
        include: {
            employee: {
                select: {
                    firstName: true,
                    lastName: true,
                    employeeCode: true,
                    department: { select: { name: true } },
                },
            },
            leaveType: { select: { name: true } },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
    });

    return apps.map((l) => flattenObject({
        "employee.firstName": l.employee.firstName,
        "employee.lastName": l.employee.lastName,
        "employee.employeeCode": l.employee.employeeCode,
        "employee.department.name": l.employee.department?.name,
        "leaveType.name": l.leaveType.name,
        fromDate: l.fromDate,
        toDate: l.toDate,
        totalDays: l.totalDays,
        status: l.status,
        halfDay: l.halfDay,
    }, fields));
}

async function executeExpenseReport(
    orgId: string,
    fields: string[],
    filters: Record<string, unknown>,
    limit: number,
): Promise<Record<string, unknown>[]> {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (filters.status) where.status = filters.status;
    if (filters.categoryId) where.categoryId = filters.categoryId;

    const claims = await prisma.expenseClaim.findMany({
        where,
        include: {
            employee: {
                select: { firstName: true, lastName: true, employeeCode: true },
            },
            category: { select: { name: true } },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
    });

    return claims.map((c) => flattenObject({
        "employee.firstName": c.employee.firstName,
        "employee.lastName": c.employee.lastName,
        "employee.employeeCode": c.employee.employeeCode,
        "category.name": c.category.name,
        title: c.title,
        amount: c.amount,
        expenseDate: c.expenseDate,
        status: c.status,
    }, fields));
}

async function executeLoanReport(
    orgId: string,
    fields: string[],
    filters: Record<string, unknown>,
    limit: number,
): Promise<Record<string, unknown>[]> {
    const where: Record<string, unknown> = {
        employee: { organizationId: orgId },
    };
    if (filters.status) where.status = filters.status;

    const loans = await prisma.loan.findMany({
        where,
        include: {
            employee: {
                select: { firstName: true, lastName: true, employeeCode: true },
            },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
    });

    return loans.map((l) => flattenObject({
        "employee.firstName": l.employee.firstName,
        "employee.lastName": l.employee.lastName,
        "employee.employeeCode": l.employee.employeeCode,
        type: l.type,
        amount: l.amount,
        emiAmount: l.emiAmount,
        remainingAmount: l.remainingAmount,
        status: l.status,
    }, fields));
}

// ── Helpers ──────────────────────────────────────────────────────────

function flattenObject(
    data: Record<string, unknown>,
    fields: string[],
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of fields) {
        result[field] = data[field];
    }
    return result;
}

function groupRows(
    rows: Record<string, unknown>[],
    groupBy: string,
): { rows: Record<string, unknown>[]; summary: Record<string, number> } {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
        const key = String(row[groupBy] ?? "N/A");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
    }

    const groupedRows = Array.from(groups.entries()).map(([key, groupRows]) => ({
        [groupBy]: key,
        count: groupRows.length,
    }));

    const summary: Record<string, number> = { totalGroups: groups.size };
    return { rows: groupedRows, summary };
}

/**
 * Get available fields and filters for a data source.
 * Used by the report builder UI.
 */
export function getDataSourceDefinition(dataSource: string) {
    return DATA_SOURCES[dataSource] || null;
}

/**
 * Get all available data sources.
 */
export function getAvailableDataSources() {
    return Object.entries(DATA_SOURCES).map(([key, def]) => ({
        key,
        label: def.label,
        fieldCount: def.fields.length,
        filterCount: def.filters.length,
    }));
}
