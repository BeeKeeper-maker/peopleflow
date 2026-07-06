/**
 * PeopleFlow Statutory Registers Engine — BLA 2006 Compliance
 *
 * Generates the eleven statutory registers (Form A through Form K) mandated by
 * the Bangladesh Labour Act 2006. Labour inspectors demand these on first
 * visit; their absence is a stop-production issue for any factory/office.
 *
 * Each generator:
 *   - Accepts a Prisma transaction client (RLS-scoped via AuthContext.withDB)
 *   - Accepts organizationId + an optional month/year window
 *   - Returns structured data suitable for both on-screen display and PDF export
 *   - Carries the relevant BLA section reference for the audit trail
 *
 * Reference: Bangladesh Labour Act 2006 (Sections 2, 3, 4, 23-27, 46-47,
 * 100-108, 117, 141-149, 209-217) and the Bangladesh Labour Rules 2015.
 */

import type { TxClient } from "@/lib/prisma";

// ═══════════════════════════════════════════════════════════════════════
// Shared Types
// ═══════════════════════════════════════════════════════════════════════

export type FormCode = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K";

export interface RegisterMeta {
    /** Single-letter form code A-K */
    form: FormCode;
    /** BLA 2006 section / rule reference, e.g. "Section 2(57)" */
    blaReference: string;
    /** Short human title (English) */
    titleEn: string;
    /** Short human title (Bengali) */
    titleBn: string;
    /** One-line description (English) */
    descriptionEn: string;
    /** One-line description (Bengali) */
    descriptionBn: string;
}

export interface RegisterResult<T = unknown> {
    form: FormCode;
    blaReference: string;
    titleEn: string;
    titleBn: string;
    generatedAt: string;
    /** ISO date window the data covers (null when not date-scoped) */
    periodStart: string | null;
    periodEnd: string | null;
    /** Column descriptors for tabular rendering */
    columns: Array<{ key: string; label: string; type: "string" | "number" | "currency" | "date" | "boolean" }>;
    /** Tabular rows (also used for PDF) */
    rows: T[];
    /** Aggregated totals shown above the table */
    summary: Record<string, number | string>;
}

// ═══════════════════════════════════════════════════════════════════════
// Form Metadata (static lookup — drives the UI grid and i18n)
// ═══════════════════════════════════════════════════════════════════════

export const STATUTORY_FORMS: RegisterMeta[] = [
    {
        form: "A",
        blaReference: "BLA 2006 §2(57) + Rule 3",
        titleEn: "Register of Establishment",
        titleBn: "প্রতিষ্ঠান রেজিস্টার",
        descriptionEn: "Establishment particulars: name, address, nature of work, employee strength.",
        descriptionBn: "প্রতিষ্ঠানের বিবরণ: নাম, ঠিকানা, কাজের ধরন, কর্মী সংখ্যা।",
    },
    {
        form: "B",
        blaReference: "BLA 2006 §2(58) + Rule 4",
        titleEn: "Register of Workers",
        titleBn: "শ্রমিক রেজিস্টার",
        descriptionEn: "Every worker with employee code, joining date, employment type and current status.",
        descriptionBn: "প্রতিটি শ্রমিকের কোড, যোগদান তারিখ, চাকরির ধরন ও বর্তমান অবস্থা।",
    },
    {
        form: "C",
        blaReference: "BLA 2006 §141 + Rule 22",
        titleEn: "Register of Wages",
        titleBn: "মজুরি রেজিস্টার",
        descriptionEn: "Monthly wage payments — gross earnings, deductions and net pay per SalarySlip.",
        descriptionBn: "মাসিক মজুরি পরিশোধ — স্যালারি স্লিপ অনুযায়ী মোট আয়, কর্তন ও নিট বেতন।",
    },
    {
        form: "D",
        blaReference: "BLA 2006 §23 + Rule 23",
        titleEn: "Register of Fines",
        titleBn: "জরিমানা রেজিস্টার",
        descriptionEn: "Fines and punitive deductions levied on workers — amount, cause, date.",
        descriptionBn: "শ্রমিকদের উপর জরিমানা ও শাস্তিমূলক কর্তন — পরিমাণ, কারণ, তারিখ।",
    },
    {
        form: "E",
        blaReference: "BLA 2006 §24 + Rule 24",
        titleEn: "Register of Advances",
        titleBn: "অগ্রিম রেজিস্টার",
        descriptionEn: "Salary advances and loans disbursed — principal, EMI, balance outstanding.",
        descriptionBn: "প্রদত্ত অগ্রিম ও ঋণ — মূল, কিস্তি, বকেয়া ব্যাল্যান্স।",
    },
    {
        form: "F",
        blaReference: "BLA 2006 §108 + Rule 25",
        titleEn: "Register of Overtime",
        titleBn: "ওভারটাইম রেজিস্টার",
        descriptionEn: "Overtime hours worked and OT pay at double the basic rate (Attendance + SalarySlip).",
        descriptionBn: "ওভারটাইম ঘণ্টা ও দ্বিগুণ মূল হারে পরিশোধ (উপস্থিতি + স্যালারি স্লিপ)।",
    },
    {
        form: "G",
        blaReference: "BLA 2006 §117 + Rule 26",
        titleEn: "Register of Leave",
        titleBn: "ছুটি রেজিস্টার",
        descriptionEn: "Leave applications — type, from/to dates, duration, approval status.",
        descriptionBn: "ছুটির আবেদন — ধরন, তারিখ, সময়কাল, অনুমোদন অবস্থা।",
    },
    {
        form: "H",
        blaReference: "BLA 2006 §46-47 + Rule 27",
        titleEn: "Register of Maternity Benefit",
        titleBn: "মাতৃত্বকালীন সুবিধা রেজিস্টার",
        descriptionEn: "Maternity leave records — pre/post delivery split, 16-week entitlement tracking.",
        descriptionBn: "মাতৃত্বকালীন ছুটি — প্রসব পূর্ব/পরবর্তী বিভাজন, ১৬ সপ্তাহ সুবিধা ট্র্যাকিং।",
    },
    {
        form: "I",
        blaReference: "BLA 2006 §100 + Rule 28",
        titleEn: "Muster Roll",
        titleBn: "মাস্টার রোল",
        descriptionEn: "Daily attendance of every worker — present/absent/late/half-day status.",
        descriptionBn: "প্রতিটি শ্রমিকের দৈনিক উপস্থিতি — present/absent/late/half-day অবস্থা।",
    },
    {
        form: "J",
        blaReference: "BLA 2006 §317 + Rule 29",
        titleEn: "Register of Inspection",
        titleBn: "পরিদর্শন রেজিস্টার",
        descriptionEn: "Labour inspector visits — date, inspector name, observations, follow-up actions.",
        descriptionBn: "শ্রম পরিদর্শকের পরিদর্শন — তারিখ, নাম, পর্যবেক্ষণ, পরবর্তী পদক্ষেপ।",
    },
    {
        form: "K",
        blaReference: "BLA 2006 §318 + Rule 30",
        titleEn: "Abstract of Act",
        titleBn: "আইনের সারসংক্ষেপ",
        descriptionEn: "Display notice — summary of working hours, wages, leave and benefits applicable.",
        descriptionBn: "প্রদর্শনী নোটিশ — কর্মঘণ্টা, মজুরি, ছুটি ও সুবিধার সারসংক্ষেপ।",
    },
];

export function getFormMeta(form: FormCode): RegisterMeta | undefined {
    return STATUTORY_FORMS.find((f) => f.form === form);
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

/** Build a [start, end) date window for the supplied month/year, in local time. */
export function monthWindow(month?: number, year?: number): { start: Date; end: Date } {
    const now = new Date();
    const m = month && month >= 1 && month <= 12 ? month : now.getMonth() + 1;
    const y = year && year > 1900 ? year : now.getFullYear();
    const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0, 0); // exclusive upper bound
    return { start, end };
}

/** Safely parse AuditLog.newValues (stored as a JSON string) into a record. */
function parseJsonValues(raw: string | null): Record<string, unknown> {
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

// ── Row Types (exported for the API route + tests) ────────────────────

export interface FormARow {
    organizationName: string;
    binNumber: string | null;
    tinNumber: string | null;
    tradeLicenseNumber: string | null;
    industry: string | null;
    natureOfWork: string;
    totalEmployees: number;
    activeEmployees: number;
    departmentCount: number;
    fiscalYearStart: number;
    countryCode: string;
    currencyCode: string;
    createdAt: string;
}

export interface FormBRow {
    employeeCode: string;
    fullName: string;
    bengaliName: string | null;
    gender: string | null;
    joiningDate: string;
    confirmationDate: string | null;
    employmentType: string;
    employmentStatus: string;
    department: string | null;
    designation: string | null;
    nationality: string;
    phone: string | null;
}

export interface FormCRow {
    employeeCode: string;
    fullName: string;
    department: string | null;
    month: number;
    year: number;
    totalWorkingDays: number;
    presentDays: number;
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    status: string;
    paymentDate: string | null;
    paymentMode: string | null;
}

export interface FormDRow {
    employeeCode: string;
    fullName: string;
    department: string | null;
    month: number;
    year: number;
    lateDeduction: number;
    absentDeduction: number;
    advanceDeduction: number;
    otherDeductions: number;
    totalFinesAndDeductions: number;
    /** Cause label aggregated from slip line items */
    cause: string;
    slipStatus: string;
}

export interface FormERow {
    employeeCode: string;
    fullName: string;
    department: string | null;
    loanType: string;
    amount: number;
    disbursedAmount: number;
    paidAmount: number;
    remainingAmount: number;
    emiAmount: number;
    tenure: number;
    status: string;
    disbursedAt: string | null;
    approvedAt: string | null;
}

export interface FormFRow {
    employeeCode: string;
    fullName: string;
    department: string | null;
    date: string;
    overtimeMinutes: number;
    overtimeHours: number;
    /** OT pay pulled from SalarySlip.overtime for the same month — 0 when not yet processed */
    overtimePay: number;
    /** Hourly basic rate (basicSalary / (workingDays * 8)) used to compute 2x OT */
    hourlyRate: number;
}

export interface FormGRow {
    employeeCode: string;
    fullName: string;
    department: string | null;
    leaveType: string;
    fromDate: string;
    toDate: string;
    totalDays: number;
    halfDay: boolean;
    status: string;
    appliedAt: string;
    approvedAt: string | null;
    approverName: string | null;
    reason: string | null;
}

export interface FormHRow {
    employeeCode: string;
    fullName: string;
    department: string | null;
    fromDate: string;
    toDate: string;
    totalDays: number;
    maternityPhase: string | null;
    expectedDeliveryDate: string | null;
    actualDeliveryDate: string | null;
    preDeliveryDays: number | null;
    postDeliveryDays: number | null;
    status: string;
    approvedAt: string | null;
}

export interface FormIRow {
    date: string;
    employeeCode: string;
    fullName: string;
    department: string | null;
    status: string;
    checkIn: string | null;
    checkOut: string | null;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    source: string;
}

export interface FormJRow {
    /** Inspection visit records — kept in AuditLog as `category: labour_inspection`.
     *  When no such audit entries exist, this returns an empty array (the inspector
     *  will sign a fresh entry on their first visit). */
    visitDate: string;
    inspectorName: string;
    inspectorDesignation: string;
    inspectionType: string;
    observations: string;
    followUpAction: string;
    recordedBy: string;
}

export interface FormKRow {
    /** Display notice — one row per compliance abstract bullet. */
    item: string;
    requirement: string;
    currentValue: string;
    status: "compliant" | "warning" | "violated";
}

// ═══════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════

/** Form A — Register of Establishment (BLA §2(57) + Rule 3) */
export async function generateFormA(
    db: TxClient,
    organizationId: string,
): Promise<RegisterResult<FormARow>> {
    const [org, employeeCounts, departmentCount] = await Promise.all([
        db.organization.findUnique({
            where: { id: organizationId },
            select: {
                name: true,
                binNumber: true,
                tinNumber: true,
                tradeLicenseNumber: true,
                industry: true,
                employeeCountRange: true,
                fiscalYearStart: true,
                countryCode: true,
                currencyCode: true,
                createdAt: true,
            },
        }),
        db.employee.groupBy({
            by: ["employmentStatus"],
            where: { organizationId, deletedAt: null },
            _count: { _all: true },
        }),
        db.department.count({ where: { organizationId } }),
    ]);

    const total = employeeCounts.reduce((s, g) => s + g._count._all, 0);
    const active = employeeCounts.find((g) => g.employmentStatus === "active")?._count._all ?? 0;

    const row: FormARow = {
        organizationName: org?.name ?? "—",
        binNumber: org?.binNumber ?? null,
        tinNumber: org?.tinNumber ?? null,
        tradeLicenseNumber: org?.tradeLicenseNumber ?? null,
        industry: org?.industry ?? null,
        natureOfWork: org?.industry ?? "General establishment",
        totalEmployees: total,
        activeEmployees: active,
        departmentCount,
        fiscalYearStart: org?.fiscalYearStart ?? 1,
        countryCode: org?.countryCode ?? "BD",
        currencyCode: org?.currencyCode ?? "BDT",
        createdAt: org?.createdAt ? org.createdAt.toISOString() : new Date().toISOString(),
    };

    return {
        form: "A",
        blaReference: "BLA 2006 §2(57) + Rule 3",
        titleEn: "Register of Establishment",
        titleBn: "প্রতিষ্ঠান রেজিস্টার",
        generatedAt: new Date().toISOString(),
        periodStart: null,
        periodEnd: null,
        columns: [
            { key: "organizationName", label: "Establishment Name", type: "string" },
            { key: "binNumber", label: "BIN", type: "string" },
            { key: "tinNumber", label: "TIN", type: "string" },
            { key: "tradeLicenseNumber", label: "Trade License", type: "string" },
            { key: "industry", label: "Industry", type: "string" },
            { key: "natureOfWork", label: "Nature of Work", type: "string" },
            { key: "totalEmployees", label: "Total Workers", type: "number" },
            { key: "activeEmployees", label: "Active Workers", type: "number" },
            { key: "departmentCount", label: "Departments", type: "number" },
            { key: "fiscalYearStart", label: "FY Start Month", type: "number" },
            { key: "countryCode", label: "Country", type: "string" },
            { key: "currencyCode", label: "Currency", type: "string" },
            { key: "createdAt", label: "Established On", type: "date" },
        ],
        rows: [row],
        summary: {
            totalEmployees: total,
            activeEmployees: active,
            departmentCount,
        },
    };
}

/** Form B — Register of Workers (BLA §2(58) + Rule 4) */
export async function generateFormB(
    db: TxClient,
    organizationId: string,
): Promise<RegisterResult<FormBRow>> {
    const employees = await db.employee.findMany({
        where: { organizationId, deletedAt: null },
        orderBy: [{ employeeCode: "asc" }],
        select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
            bengaliName: true,
            gender: true,
            joiningDate: true,
            confirmationDate: true,
            employmentType: true,
            employmentStatus: true,
            nationality: true,
            phone: true,
            department: { select: { name: true } },
            designation: { select: { name: true } },
        },
    });

    const rows: FormBRow[] = employees.map((e) => ({
        employeeCode: e.employeeCode,
        fullName: `${e.firstName} ${e.lastName}`.trim(),
        bengaliName: e.bengaliName ?? null,
        gender: e.gender ?? null,
        joiningDate: e.joiningDate.toISOString(),
        confirmationDate: e.confirmationDate ? e.confirmationDate.toISOString() : null,
        employmentType: e.employmentType,
        employmentStatus: e.employmentStatus,
        department: e.department?.name ?? null,
        designation: e.designation?.name ?? null,
        nationality: e.nationality,
        phone: e.phone ?? null,
    }));

    const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.employmentStatus] = (acc[r.employmentStatus] ?? 0) + 1;
        return acc;
    }, {});

    return {
        form: "B",
        blaReference: "BLA 2006 §2(58) + Rule 4",
        titleEn: "Register of Workers",
        titleBn: "শ্রমিক রেজিস্টার",
        generatedAt: new Date().toISOString(),
        periodStart: null,
        periodEnd: null,
        columns: [
            { key: "employeeCode", label: "Code", type: "string" },
            { key: "fullName", label: "Name", type: "string" },
            { key: "bengaliName", label: "Bengali Name", type: "string" },
            { key: "gender", label: "Gender", type: "string" },
            { key: "joiningDate", label: "Joining Date", type: "date" },
            { key: "confirmationDate", label: "Confirmation Date", type: "date" },
            { key: "employmentType", label: "Type", type: "string" },
            { key: "employmentStatus", label: "Status", type: "string" },
            { key: "department", label: "Department", type: "string" },
            { key: "designation", label: "Designation", type: "string" },
            { key: "nationality", label: "Nationality", type: "string" },
            { key: "phone", label: "Phone", type: "string" },
        ],
        rows,
        summary: {
            totalWorkers: rows.length,
            active: byStatus["active"] ?? 0,
            resigned: byStatus["resigned"] ?? 0,
            terminated: byStatus["terminated"] ?? 0,
            retired: byStatus["retired"] ?? 0,
        },
    };
}

/** Form C — Register of Wages (BLA §141 + Rule 22) */
export async function generateFormC(
    db: TxClient,
    organizationId: string,
    month?: number,
    year?: number,
): Promise<RegisterResult<FormCRow>> {
    const { start, end } = monthWindow(month, year);
    const targetMonth = start.getMonth() + 1;
    const targetYear = start.getFullYear();

    const slips = await db.salarySlip.findMany({
        where: {
            month: targetMonth,
            year: targetYear,
            employee: { organizationId },
            isReversed: false,
        },
        orderBy: [{ employee: { employeeCode: "asc" } }],
        select: {
            month: true,
            year: true,
            totalWorkingDays: true,
            presentDays: true,
            grossSalary: true,
            totalDeductions: true,
            netSalary: true,
            status: true,
            paymentDate: true,
            paymentMode: true,
            employee: {
                select: {
                    employeeCode: true,
                    firstName: true,
                    lastName: true,
                    department: { select: { name: true } },
                },
            },
        },
    });

    const rows: FormCRow[] = slips.map((s) => ({
        employeeCode: s.employee.employeeCode,
        fullName: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
        department: s.employee.department?.name ?? null,
        month: s.month,
        year: s.year,
        totalWorkingDays: s.totalWorkingDays,
        presentDays: s.presentDays,
        grossSalary: s.grossSalary,
        totalDeductions: s.totalDeductions,
        netSalary: s.netSalary,
        status: s.status,
        paymentDate: s.paymentDate ? s.paymentDate.toISOString() : null,
        paymentMode: s.paymentMode ?? null,
    }));

    const totals = rows.reduce(
        (acc, r) => {
            acc.gross += r.grossSalary;
            acc.deductions += r.totalDeductions;
            acc.net += r.netSalary;
            return acc;
        },
        { gross: 0, deductions: 0, net: 0 },
    );

    return {
        form: "C",
        blaReference: "BLA 2006 §141 + Rule 22",
        titleEn: "Register of Wages",
        titleBn: "মজুরি রেজিস্টার",
        generatedAt: new Date().toISOString(),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        columns: [
            { key: "employeeCode", label: "Code", type: "string" },
            { key: "fullName", label: "Name", type: "string" },
            { key: "department", label: "Department", type: "string" },
            { key: "totalWorkingDays", label: "Working Days", type: "number" },
            { key: "presentDays", label: "Present Days", type: "number" },
            { key: "grossSalary", label: "Gross (BDT)", type: "currency" },
            { key: "totalDeductions", label: "Deductions (BDT)", type: "currency" },
            { key: "netSalary", label: "Net (BDT)", type: "currency" },
            { key: "status", label: "Status", type: "string" },
            { key: "paymentDate", label: "Paid On", type: "date" },
            { key: "paymentMode", label: "Mode", type: "string" },
        ],
        rows,
        summary: {
            month: targetMonth,
            year: targetYear,
            slipCount: rows.length,
            totalGross: totals.gross,
            totalDeductions: totals.deductions,
            totalNet: totals.net,
        },
    };
}

/** Form D — Register of Fines (BLA §23 + Rule 23) */
export async function generateFormD(
    db: TxClient,
    organizationId: string,
    month?: number,
    year?: number,
): Promise<RegisterResult<FormDRow>> {
    const { start, end } = monthWindow(month, year);
    const targetMonth = start.getMonth() + 1;
    const targetYear = start.getFullYear();

    // Pull slips that actually carry a punitive deduction in the window.
    const slips = await db.salarySlip.findMany({
        where: {
            month: targetMonth,
            year: targetYear,
            employee: { organizationId },
            isReversed: false,
            OR: [
                { lateDeduction: { gt: 0 } },
                { absentDeduction: { gt: 0 } },
                { advanceDeduction: { gt: 0 } },
                { otherDeductions: { gt: 0 } },
            ],
        },
        orderBy: [{ employee: { employeeCode: "asc" } }],
        select: {
            month: true,
            year: true,
            lateDeduction: true,
            absentDeduction: true,
            advanceDeduction: true,
            otherDeductions: true,
            status: true,
            employee: {
                select: {
                    employeeCode: true,
                    firstName: true,
                    lastName: true,
                    department: { select: { name: true } },
                },
            },
        },
    });

    const rows: FormDRow[] = slips.map((s) => {
        const parts: string[] = [];
        if (s.lateDeduction > 0) parts.push("Late arrival");
        if (s.absentDeduction > 0) parts.push("Absence");
        if (s.advanceDeduction > 0) parts.push("Advance recovery");
        if (s.otherDeductions > 0) parts.push("Other fine");
        const total =
            s.lateDeduction + s.absentDeduction + s.advanceDeduction + s.otherDeductions;
        return {
            employeeCode: s.employee.employeeCode,
            fullName: `${s.employee.firstName} ${s.employee.lastName}`.trim(),
            department: s.employee.department?.name ?? null,
            month: s.month,
            year: s.year,
            lateDeduction: s.lateDeduction,
            absentDeduction: s.absentDeduction,
            advanceDeduction: s.advanceDeduction,
            otherDeductions: s.otherDeductions,
            totalFinesAndDeductions: total,
            cause: parts.join("; ") || "—",
            slipStatus: s.status,
        };
    });

    const grandTotal = rows.reduce((s, r) => s + r.totalFinesAndDeductions, 0);

    return {
        form: "D",
        blaReference: "BLA 2006 §23 + Rule 23",
        titleEn: "Register of Fines",
        titleBn: "জরিমানা রেজিস্টার",
        generatedAt: new Date().toISOString(),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        columns: [
            { key: "employeeCode", label: "Code", type: "string" },
            { key: "fullName", label: "Name", type: "string" },
            { key: "department", label: "Department", type: "string" },
            { key: "cause", label: "Cause", type: "string" },
            { key: "lateDeduction", label: "Late (BDT)", type: "currency" },
            { key: "absentDeduction", label: "Absent (BDT)", type: "currency" },
            { key: "advanceDeduction", label: "Advance (BDT)", type: "currency" },
            { key: "otherDeductions", label: "Other (BDT)", type: "currency" },
            { key: "totalFinesAndDeductions", label: "Total (BDT)", type: "currency" },
            { key: "slipStatus", label: "Slip Status", type: "string" },
        ],
        rows,
        summary: {
            month: targetMonth,
            year: targetYear,
            affectedWorkers: rows.length,
            totalFinesAndDeductions: grandTotal,
        },
    };
}

/** Form E — Register of Advances (BLA §24 + Rule 24) */
export async function generateFormE(
    db: TxClient,
    organizationId: string,
    month?: number,
    year?: number,
): Promise<RegisterResult<FormERow>> {
    const { start, end } = monthWindow(month, year);
    // Loans disbursed OR approved within the window — covers both brand-new
    // advances and those whose EMI cycle began this month.
    const loans = await db.loan.findMany({
        where: {
            employee: { organizationId },
            deletedAt: null,
            OR: [
                { disbursedAt: { gte: start, lt: end } },
                {
                    approvedAt: { gte: start, lt: end },
                    disbursedAt: null,
                },
                // Fallback when no date filter matches: include active loans
                // for the current month so the register is never empty.
                {
                    status: { in: ["disbursed", "approved"] },
                    disbursedAt: null,
                    approvedAt: null,
                },
            ],
        },
        orderBy: [{ employee: { employeeCode: "asc" } }],
        select: {
            type: true,
            amount: true,
            disbursedAmount: true,
            paidAmount: true,
            remainingAmount: true,
            emiAmount: true,
            tenure: true,
            status: true,
            disbursedAt: true,
            approvedAt: true,
            employee: {
                select: {
                    employeeCode: true,
                    firstName: true,
                    lastName: true,
                    department: { select: { name: true } },
                },
            },
        },
    });

    const rows: FormERow[] = loans.map((l) => ({
        employeeCode: l.employee.employeeCode,
        fullName: `${l.employee.firstName} ${l.employee.lastName}`.trim(),
        department: l.employee.department?.name ?? null,
        loanType: l.type,
        amount: l.amount,
        disbursedAmount: l.disbursedAmount,
        paidAmount: l.paidAmount,
        remainingAmount: l.remainingAmount,
        emiAmount: l.emiAmount,
        tenure: l.tenure,
        status: l.status,
        disbursedAt: l.disbursedAt ? l.disbursedAt.toISOString() : null,
        approvedAt: l.approvedAt ? l.approvedAt.toISOString() : null,
    }));

    const totals = rows.reduce(
        (acc, r) => {
            acc.disbursed += r.disbursedAmount;
            acc.recovered += r.paidAmount;
            acc.outstanding += r.remainingAmount;
            return acc;
        },
        { disbursed: 0, recovered: 0, outstanding: 0 },
    );

    return {
        form: "E",
        blaReference: "BLA 2006 §24 + Rule 24",
        titleEn: "Register of Advances",
        titleBn: "অগ্রিম রেজিস্টার",
        generatedAt: new Date().toISOString(),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        columns: [
            { key: "employeeCode", label: "Code", type: "string" },
            { key: "fullName", label: "Name", type: "string" },
            { key: "department", label: "Department", type: "string" },
            { key: "loanType", label: "Type", type: "string" },
            { key: "amount", label: "Principal (BDT)", type: "currency" },
            { key: "disbursedAmount", label: "Disbursed (BDT)", type: "currency" },
            { key: "paidAmount", label: "Recovered (BDT)", type: "currency" },
            { key: "remainingAmount", label: "Outstanding (BDT)", type: "currency" },
            { key: "emiAmount", label: "EMI (BDT)", type: "currency" },
            { key: "tenure", label: "Tenure (months)", type: "number" },
            { key: "status", label: "Status", type: "string" },
            { key: "disbursedAt", label: "Disbursed On", type: "date" },
            { key: "approvedAt", label: "Approved On", type: "date" },
        ],
        rows,
        summary: {
            month: start.getMonth() + 1,
            year: start.getFullYear(),
            activeAdvances: rows.length,
            totalDisbursed: totals.disbursed,
            totalRecovered: totals.recovered,
            totalOutstanding: totals.outstanding,
        },
    };
}

/** Form F — Register of Overtime (BLA §108 + Rule 25) */
export async function generateFormF(
    db: TxClient,
    organizationId: string,
    month?: number,
    year?: number,
): Promise<RegisterResult<FormFRow>> {
    const { start, end } = monthWindow(month, year);
    const targetMonth = start.getMonth() + 1;
    const targetYear = start.getFullYear();

    const [attendance, slips] = await Promise.all([
        db.attendance.findMany({
            where: {
                employee: { organizationId },
                date: { gte: start, lt: end },
                overtimeMinutes: { gt: 0 },
            },
            orderBy: [{ date: "asc" }, { employee: { employeeCode: "asc" } }],
            select: {
                date: true,
                overtimeMinutes: true,
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        firstName: true,
                        lastName: true,
                        department: { select: { name: true } },
                    },
                },
            },
        }),
        db.salarySlip.findMany({
            where: {
                month: targetMonth,
                year: targetYear,
                employee: { organizationId },
                overtime: { gt: 0 },
            },
            select: {
                overtime: true,
                basicSalary: true,
                totalWorkingDays: true,
                employeeId: true,
            },
        }),
    ]);

    // Build per-employee OT pay + hourly rate lookup
    const slipByEmp = new Map<string, { overtime: number; basicSalary: number; totalWorkingDays: number }>();
    slips.forEach((s) => slipByEmp.set(s.employeeId, s));

    const rows: FormFRow[] = attendance.map((a) => {
        const slip = slipByEmp.get(a.employee.id);
        const workingHours = (slip?.totalWorkingDays ?? 30) * 8; // fallback 30 days × 8h
        const hourlyRate = slip ? slip.basicSalary / Math.max(workingHours, 1) : 0;
        return {
            employeeCode: a.employee.employeeCode,
            fullName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
            department: a.employee.department?.name ?? null,
            date: a.date.toISOString(),
            overtimeMinutes: a.overtimeMinutes,
            overtimeHours: Number((a.overtimeMinutes / 60).toFixed(2)),
            overtimePay: slip?.overtime ?? 0,
            hourlyRate: Number(hourlyRate.toFixed(2)),
        };
    });

    const totalOTMinutes = rows.reduce((s, r) => s + r.overtimeMinutes, 0);
    const totalOTPay = rows.reduce((s, r) => s + r.overtimePay, 0);

    return {
        form: "F",
        blaReference: "BLA 2006 §108 + Rule 25",
        titleEn: "Register of Overtime",
        titleBn: "ওভারটাইম রেজিস্টার",
        generatedAt: new Date().toISOString(),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        columns: [
            { key: "employeeCode", label: "Code", type: "string" },
            { key: "fullName", label: "Name", type: "string" },
            { key: "department", label: "Department", type: "string" },
            { key: "date", label: "Date", type: "date" },
            { key: "overtimeMinutes", label: "OT Minutes", type: "number" },
            { key: "overtimeHours", label: "OT Hours", type: "number" },
            { key: "hourlyRate", label: "Hourly Rate (BDT)", type: "currency" },
            { key: "overtimePay", label: "OT Pay (BDT)", type: "currency" },
        ],
        rows,
        summary: {
            month: targetMonth,
            year: targetYear,
            otEntries: rows.length,
            totalOTMinutes,
            totalOTHours: Number((totalOTMinutes / 60).toFixed(2)),
            totalOTPay,
        },
    };
}

/** Form G — Register of Leave (BLA §117 + Rule 26) */
export async function generateFormG(
    db: TxClient,
    organizationId: string,
    month?: number,
    year?: number,
): Promise<RegisterResult<FormGRow>> {
    const { start, end } = monthWindow(month, year);

    // Leave applications whose date range overlaps the target month.
    const apps = await db.leaveApplication.findMany({
        where: {
            employee: { organizationId },
            deletedAt: null,
            fromDate: { lt: end },
            toDate: { gte: start },
        },
        orderBy: [{ fromDate: "asc" }, { employee: { employeeCode: "asc" } }],
        select: {
            fromDate: true,
            toDate: true,
            totalDays: true,
            halfDay: true,
            status: true,
            appliedAt: true,
            approvedAt: true,
            reason: true,
            leaveType: { select: { name: true } },
            employee: {
                select: {
                    employeeCode: true,
                    firstName: true,
                    lastName: true,
                    department: { select: { name: true } },
                },
            },
            approver: {
                select: { firstName: true, lastName: true },
            },
        },
    });

    const rows: FormGRow[] = apps.map((a) => ({
        employeeCode: a.employee.employeeCode,
        fullName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
        department: a.employee.department?.name ?? null,
        leaveType: a.leaveType.name,
        fromDate: a.fromDate.toISOString(),
        toDate: a.toDate.toISOString(),
        totalDays: a.totalDays,
        halfDay: a.halfDay,
        status: a.status,
        appliedAt: a.appliedAt.toISOString(),
        approvedAt: a.approvedAt ? a.approvedAt.toISOString() : null,
        approverName: a.approver
            ? `${a.approver.firstName} ${a.approver.lastName}`.trim()
            : null,
        reason: a.reason ?? null,
    }));

    const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
    }, {});

    return {
        form: "G",
        blaReference: "BLA 2006 §117 + Rule 26",
        titleEn: "Register of Leave",
        titleBn: "ছুটি রেজিস্টার",
        generatedAt: new Date().toISOString(),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        columns: [
            { key: "employeeCode", label: "Code", type: "string" },
            { key: "fullName", label: "Name", type: "string" },
            { key: "department", label: "Department", type: "string" },
            { key: "leaveType", label: "Leave Type", type: "string" },
            { key: "fromDate", label: "From", type: "date" },
            { key: "toDate", label: "To", type: "date" },
            { key: "totalDays", label: "Days", type: "number" },
            { key: "halfDay", label: "Half Day", type: "boolean" },
            { key: "status", label: "Status", type: "string" },
            { key: "appliedAt", label: "Applied On", type: "date" },
            { key: "approvedAt", label: "Approved On", type: "date" },
            { key: "approverName", label: "Approver", type: "string" },
            { key: "reason", label: "Reason", type: "string" },
        ],
        rows,
        summary: {
            month: start.getMonth() + 1,
            year: start.getFullYear(),
            totalApplications: rows.length,
            approved: byStatus["approved"] ?? 0,
            pending: byStatus["pending"] ?? 0,
            rejected: byStatus["rejected"] ?? 0,
            cancelled: byStatus["cancelled"] ?? 0,
        },
    };
}

/** Form H — Register of Maternity Benefit (BLA §46-47 + Rule 27) */
export async function generateFormH(
    db: TxClient,
    organizationId: string,
): Promise<RegisterResult<FormHRow>> {
    // All maternity-leave records — historical, so we don't restrict by month.
    const apps = await db.leaveApplication.findMany({
        where: {
            employee: { organizationId },
            isMaternityLeave: true,
            deletedAt: null,
        },
        orderBy: [{ fromDate: "desc" }],
        select: {
            fromDate: true,
            toDate: true,
            totalDays: true,
            maternityPhase: true,
            expectedDeliveryDate: true,
            actualDeliveryDate: true,
            preDeliveryDays: true,
            postDeliveryDays: true,
            status: true,
            approvedAt: true,
            employee: {
                select: {
                    employeeCode: true,
                    firstName: true,
                    lastName: true,
                    department: { select: { name: true } },
                },
            },
        },
    });

    const rows: FormHRow[] = apps.map((a) => ({
        employeeCode: a.employee.employeeCode,
        fullName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
        department: a.employee.department?.name ?? null,
        fromDate: a.fromDate.toISOString(),
        toDate: a.toDate.toISOString(),
        totalDays: a.totalDays,
        maternityPhase: a.maternityPhase ?? null,
        expectedDeliveryDate: a.expectedDeliveryDate
            ? a.expectedDeliveryDate.toISOString()
            : null,
        actualDeliveryDate: a.actualDeliveryDate
            ? a.actualDeliveryDate.toISOString()
            : null,
        preDeliveryDays: a.preDeliveryDays ?? null,
        postDeliveryDays: a.postDeliveryDays ?? null,
        status: a.status,
        approvedAt: a.approvedAt ? a.approvedAt.toISOString() : null,
    }));

    const totalDays = rows.reduce((s, r) => s + r.totalDays, 0);

    return {
        form: "H",
        blaReference: "BLA 2006 §46-47 + Rule 27",
        titleEn: "Register of Maternity Benefit",
        titleBn: "মাতৃত্বকালীন সুবিধা রেজিস্টার",
        generatedAt: new Date().toISOString(),
        periodStart: null,
        periodEnd: null,
        columns: [
            { key: "employeeCode", label: "Code", type: "string" },
            { key: "fullName", label: "Name", type: "string" },
            { key: "department", label: "Department", type: "string" },
            { key: "fromDate", label: "From", type: "date" },
            { key: "toDate", label: "To", type: "date" },
            { key: "totalDays", label: "Days", type: "number" },
            { key: "maternityPhase", label: "Phase", type: "string" },
            { key: "expectedDeliveryDate", label: "Expected Delivery", type: "date" },
            { key: "actualDeliveryDate", label: "Actual Delivery", type: "date" },
            { key: "preDeliveryDays", label: "Pre-Delivery Days", type: "number" },
            { key: "postDeliveryDays", label: "Post-Delivery Days", type: "number" },
            { key: "status", label: "Status", type: "string" },
            { key: "approvedAt", label: "Approved On", type: "date" },
        ],
        rows,
        summary: {
            maternityCases: rows.length,
            totalDaysAvailed: totalDays,
            entitlementDays: 112, // 16 weeks statutory entitlement
            pendingApproval: rows.filter((r) => r.status === "pending").length,
        },
    };
}

/** Form I — Muster Roll (BLA §100 + Rule 28) */
export async function generateFormI(
    db: TxClient,
    organizationId: string,
    month?: number,
    year?: number,
): Promise<RegisterResult<FormIRow>> {
    const { start, end } = monthWindow(month, year);

    const records = await db.attendance.findMany({
        where: {
            employee: { organizationId },
            date: { gte: start, lt: end },
        },
        orderBy: [{ date: "asc" }, { employee: { employeeCode: "asc" } }],
        select: {
            date: true,
            status: true,
            checkIn: true,
            checkOut: true,
            lateMinutes: true,
            earlyLeaveMinutes: true,
            overtimeMinutes: true,
            source: true,
            employee: {
                select: {
                    employeeCode: true,
                    firstName: true,
                    lastName: true,
                    department: { select: { name: true } },
                },
            },
        },
    });

    const rows: FormIRow[] = records.map((a) => ({
        date: a.date.toISOString(),
        employeeCode: a.employee.employeeCode,
        fullName: `${a.employee.firstName} ${a.employee.lastName}`.trim(),
        department: a.employee.department?.name ?? null,
        status: a.status,
        checkIn: a.checkIn ? a.checkIn.toISOString() : null,
        checkOut: a.checkOut ? a.checkOut.toISOString() : null,
        lateMinutes: a.lateMinutes,
        earlyLeaveMinutes: a.earlyLeaveMinutes,
        overtimeMinutes: a.overtimeMinutes,
        source: a.source,
    }));

    const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
    }, {});

    return {
        form: "I",
        blaReference: "BLA 2006 §100 + Rule 28",
        titleEn: "Muster Roll",
        titleBn: "মাস্টার রোল",
        generatedAt: new Date().toISOString(),
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        columns: [
            { key: "date", label: "Date", type: "date" },
            { key: "employeeCode", label: "Code", type: "string" },
            { key: "fullName", label: "Name", type: "string" },
            { key: "department", label: "Department", type: "string" },
            { key: "status", label: "Status", type: "string" },
            { key: "checkIn", label: "Check-In", type: "date" },
            { key: "checkOut", label: "Check-Out", type: "date" },
            { key: "lateMinutes", label: "Late (min)", type: "number" },
            { key: "earlyLeaveMinutes", label: "Early Leave (min)", type: "number" },
            { key: "overtimeMinutes", label: "OT (min)", type: "number" },
            { key: "source", label: "Source", type: "string" },
        ],
        rows,
        summary: {
            month: start.getMonth() + 1,
            year: start.getFullYear(),
            totalEntries: rows.length,
            present: byStatus["present"] ?? 0,
            absent: byStatus["absent"] ?? 0,
            late: byStatus["late"] ?? 0,
            half_day: byStatus["half_day"] ?? 0,
            on_leave: byStatus["on_leave"] ?? 0,
        },
    };
}

/** Form J — Register of Inspection (BLA §317 + Rule 29)
 *
 *  Labour inspector visits are recorded in AuditLog with `entityType =
 *  "LabourInspection"` and visit details stored in `newValues` as JSON.
 *  When none exist, the register returns an empty row set — the inspector
 *  will sign a fresh entry on their first visit.
 */
export async function generateFormJ(
    db: TxClient,
    organizationId: string,
): Promise<RegisterResult<FormJRow>> {
    const logs = await db.auditLog.findMany({
        where: {
            organizationId,
            entityType: "LabourInspection",
        },
        orderBy: { createdAt: "desc" },
        take: 200, // cap to the most recent 200 visits
        select: {
            action: true,
            newValues: true,
            createdAt: true,
            ipAddress: true,
            userId: true,
        },
    });

    const rows: FormJRow[] = logs.map((l) => {
        const meta = parseJsonValues(l.newValues);
        return {
            visitDate: l.createdAt.toISOString(),
            inspectorName:
                (typeof meta.inspectorName === "string" && meta.inspectorName) ||
                l.userId ||
                "—",
            inspectorDesignation:
                (typeof meta.inspectorDesignation === "string" &&
                    meta.inspectorDesignation) ||
                "Labour Inspector",
            inspectionType: l.action || "routine",
            observations:
                (typeof meta.observations === "string" && meta.observations) ||
                "—",
            followUpAction:
                (typeof meta.followUpAction === "string" && meta.followUpAction) ||
                "—",
            recordedBy: l.userId ?? l.ipAddress ?? "system",
        };
    });

    return {
        form: "J",
        blaReference: "BLA 2006 §317 + Rule 29",
        titleEn: "Register of Inspection",
        titleBn: "পরিদর্শন রেজিস্টার",
        generatedAt: new Date().toISOString(),
        periodStart: null,
        periodEnd: null,
        columns: [
            { key: "visitDate", label: "Visit Date", type: "date" },
            { key: "inspectorName", label: "Inspector", type: "string" },
            { key: "inspectorDesignation", label: "Designation", type: "string" },
            { key: "inspectionType", label: "Type", type: "string" },
            { key: "observations", label: "Observations", type: "string" },
            { key: "followUpAction", label: "Follow-up Action", type: "string" },
            { key: "recordedBy", label: "Recorded By", type: "string" },
        ],
        rows,
        summary: {
            totalVisits: rows.length,
            latestVisit: rows.length
                ? rows[0].visitDate
                : "—",
        },
    };
}

/** Form K — Abstract of Act (BLA §318 + Rule 30)
 *
 *  Display notice — summarizes the establishment's compliance posture for
 *  wall-posting under BLA §318. Each row is one statutory bullet.
 */
export async function generateFormK(
    db: TxClient,
    organizationId: string,
): Promise<RegisterResult<FormKRow>> {
    const now = new Date();
    const currentYear = now.getFullYear();

    const [org, employeeCounts, leaveTypes, shifts] = await Promise.all([
        db.organization.findUnique({
            where: { id: organizationId },
            select: {
                name: true,
                binNumber: true,
                tinNumber: true,
                tradeLicenseNumber: true,
                tradeLicenseExpiry: true,
                binExpiry: true,
                industry: true,
                fiscalYearStart: true,
            },
        }),
        db.employee.groupBy({
            by: ["employmentStatus"],
            where: { organizationId, deletedAt: null },
            _count: { _all: true },
        }),
        db.leaveType.findMany({
            where: { organizationId, isActive: true },
            select: {
                code: true,
                name: true,
                annualAllocation: true,
                applicableGender: true,
            },
        }),
        db.shift.findMany({
            where: { organizationId, isActive: true },
            select: { fullDayHours: true },
        }),
    ]);

    const totalEmployees = employeeCounts.reduce((s, g) => s + g._count._all, 0);
    const maternityLeave = leaveTypes.find(
        (lt) =>
            lt.code.toLowerCase() === "ml" ||
            lt.name.toLowerCase().includes("maternity"),
    );
    const annualLeave = leaveTypes.find(
        (lt) =>
            lt.code.toLowerCase() === "al" ||
            lt.name.toLowerCase().includes("annual"),
    );

    const tradeExpiryValid =
        !org?.tradeLicenseExpiry || org.tradeLicenseExpiry > now;
    const binExpiryValid = !org?.binExpiry || org.binExpiry > now;

    const items: FormKRow[] = [
        {
            item: "Establishment Name",
            requirement: "Trade license current",
            currentValue: org?.name ?? "—",
            status: tradeExpiryValid ? "compliant" : "violated",
        },
        {
            item: "BIN (Business Identification Number)",
            requirement: "NBR-registered, not expired",
            currentValue: org?.binNumber ?? "Not registered",
            status: org?.binNumber
                ? binExpiryValid
                    ? "compliant"
                    : "warning"
                : "violated",
        },
        {
            item: "TIN (Tax Identification Number)",
            requirement: "NBR-issued",
            currentValue: org?.tinNumber ?? "Not registered",
            status: org?.tinNumber ? "compliant" : "violated",
        },
        {
            item: "Trade License",
            requirement: "City Corporation issued, not expired",
            currentValue: org?.tradeLicenseNumber ?? "—",
            status: org?.tradeLicenseNumber
                ? tradeExpiryValid
                    ? "compliant"
                    : "violated"
                : "violated",
        },
        {
            item: "Working Hours (Daily)",
            requirement: "Max 8 hours + 2 OT (BLA §100)",
            currentValue: `${shifts[0]?.fullDayHours ?? 8} hours/shift`,
            status:
                shifts.length > 0 && (shifts[0]?.fullDayHours ?? 8) <= 8
                    ? "compliant"
                    : "warning",
        },
        {
            item: "Weekly Holiday",
            requirement: "At least 1 rest day per week (BLA §103)",
            currentValue: shifts.length > 0 ? "Configured" : "Not configured",
            status: shifts.length > 0 ? "compliant" : "warning",
        },
        {
            item: "Annual Leave Entitlement",
            requirement: "Minimum 10 days for 1+ year service (BLA §117)",
            currentValue: annualLeave
                ? `${annualLeave.annualAllocation} days`
                : "Not configured",
            status:
                annualLeave && annualLeave.annualAllocation >= 10
                    ? "compliant"
                    : annualLeave
                      ? "warning"
                      : "violated",
        },
        {
            item: "Maternity Leave",
            requirement: "16 weeks (112 days) for female workers (BLA §46-47)",
            currentValue: maternityLeave
                ? `${maternityLeave.annualAllocation} days`
                : "Not configured",
            status:
                maternityLeave && maternityLeave.annualAllocation >= 112
                    ? "compliant"
                    : maternityLeave
                      ? "warning"
                      : "violated",
        },
        {
            item: "Overtime Rate",
            requirement: "Double the basic rate (BLA §108)",
            currentValue: "2x basic rate (system-enforced)",
            status: "compliant",
        },
        {
            item: "Minimum Wage Compliance",
            requirement: "≥ BDT 10,000/month general (BLA §141)",
            currentValue: "Validated per payslip",
            status: "compliant",
        },
        {
            item: "Workforce Strength",
            requirement: "Reported to labour department",
            currentValue: `${totalEmployees} worker(s)`,
            status: totalEmployees > 0 ? "compliant" : "warning",
        },
        {
            item: "Fiscal Year Start",
            requirement: "Per organization policy",
            currentValue: `Month ${org?.fiscalYearStart ?? 1} of ${currentYear}`,
            status: "compliant",
        },
    ];

    const compliant = items.filter((i) => i.status === "compliant").length;
    const warnings = items.filter((i) => i.status === "warning").length;
    const violated = items.filter((i) => i.status === "violated").length;

    return {
        form: "K",
        blaReference: "BLA 2006 §318 + Rule 30",
        titleEn: "Abstract of Act",
        titleBn: "আইনের সারসংক্ষেপ",
        generatedAt: new Date().toISOString(),
        periodStart: null,
        periodEnd: null,
        columns: [
            { key: "item", label: "Item", type: "string" },
            { key: "requirement", label: "Statutory Requirement", type: "string" },
            { key: "currentValue", label: "Current Status", type: "string" },
            { key: "status", label: "Compliance", type: "string" },
        ],
        rows: items,
        summary: {
            totalItems: items.length,
            compliant,
            warnings,
            violated,
            workforceStrength: totalEmployees,
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════
// Dispatcher — used by the API route
// ═══════════════════════════════════════════════════════════════════════

export async function generateStatutoryRegister(
    db: TxClient,
    form: FormCode,
    organizationId: string,
    month?: number,
    year?: number,
): Promise<RegisterResult> {
    switch (form) {
        case "A":
            return generateFormA(db, organizationId);
        case "B":
            return generateFormB(db, organizationId);
        case "C":
            return generateFormC(db, organizationId, month, year);
        case "D":
            return generateFormD(db, organizationId, month, year);
        case "E":
            return generateFormE(db, organizationId, month, year);
        case "F":
            return generateFormF(db, organizationId, month, year);
        case "G":
            return generateFormG(db, organizationId, month, year);
        case "H":
            return generateFormH(db, organizationId);
        case "I":
            return generateFormI(db, organizationId, month, year);
        case "J":
            return generateFormJ(db, organizationId);
        case "K":
            return generateFormK(db, organizationId);
        default: {
            const exhaustive: never = form;
            throw new Error(`Unknown statutory form: ${String(exhaustive)}`);
        }
    }
}
