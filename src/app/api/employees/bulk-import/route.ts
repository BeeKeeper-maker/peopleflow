/**
 * Employee Bulk Import API
 *
 * POST /api/employees/bulk-import
 *   - multipart/form-data with `file` (CSV) and optional `confirm` ("true")
 *   - requireAdminOrHR auth
 *   - Parses CSV, validates each row, returns a preview of valid/invalid rows
 *   - When `confirm=true`, actually creates the employees (RLS-scoped via auth.withDB)
 *
 * CSV columns (header row required, case-insensitive):
 *   employeeCode, firstName, lastName, email, phone,
 *   department, designation, joiningDate, employmentType, gender
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ROWS = 1000;

const VALID_EMPLOYMENT_TYPES = new Set([
    "permanent",
    "contractual",
    "intern",
    "probation",
]);

const VALID_GENDERS = new Set(["male", "female", "other"]);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CsvRow {
    rowNumber: number;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    department: string;
    designation: string;
    joiningDate: string;
    employmentType: string;
    gender: string;
    errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Parser (basic — comma-separated, header row required)
// ─────────────────────────────────────────────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
    // Strip BOM if present and normalize Windows line endings
    const normalized = text
        .replace(/^\uFEFF/, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n");
    const lines = normalized.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: CsvRow[] = [];

    const at = (values: string[], name: string): string => {
        const idx = headers.indexOf(name);
        if (idx < 0) return "";
        return values[idx] ?? "";
    };

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // skip blank lines

        const values = line.split(",").map((v) => v.trim());

        const row: CsvRow = {
            rowNumber: i + 1,
            employeeCode: at(values, "employeecode"),
            firstName: at(values, "firstname"),
            lastName: at(values, "lastname"),
            email: at(values, "email"),
            phone: at(values, "phone"),
            department: at(values, "department"),
            designation: at(values, "designation"),
            joiningDate: at(values, "joiningdate"),
            employmentType: at(values, "employmenttype") || "permanent",
            gender: at(values, "gender"),
            errors: [],
        };

        // ── Validate required fields ──────────────────────────────────────
        if (!row.employeeCode) {
            row.errors.push("Employee code is required");
        }
        if (!row.firstName) {
            row.errors.push("First name is required");
        }
        if (!row.lastName) {
            row.errors.push("Last name is required");
        }
        if (!row.joiningDate) {
            row.errors.push("Joining date is required");
        } else if (isNaN(new Date(row.joiningDate).getTime())) {
            row.errors.push("Invalid joining date format");
        }

        // ── Validate email format ─────────────────────────────────────────
        if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
            row.errors.push("Invalid email format");
        }

        // ── Validate BD phone format ──────────────────────────────────────
        if (row.phone) {
            const cleaned = row.phone.replace(/[\s-]/g, "");
            if (!/^(\+?880|0)?1[3-9]\d{8}$/.test(cleaned)) {
                row.errors.push("Invalid BD phone format");
            }
        }

        // ── Validate employmentType enum ──────────────────────────────────
        if (
            row.employmentType &&
            !VALID_EMPLOYMENT_TYPES.has(row.employmentType.toLowerCase())
        ) {
            row.errors.push(
                "Employment type must be one of: permanent, contractual, intern, probation",
            );
        }

        // ── Validate gender enum ──────────────────────────────────────────
        if (row.gender && !VALID_GENDERS.has(row.gender.toLowerCase())) {
            row.errors.push("Gender must be one of: male, female, other");
        }

        rows.push(row);
    }

    return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const confirm = formData.get("confirm") === "true";

        if (!file) {
            return NextResponse.json(
                { error: "No file provided" },
                { status: 400 },
            );
        }

        if (!file.name.toLowerCase().endsWith(".csv")) {
            return NextResponse.json(
                { error: "File must be a CSV" },
                { status: 400 },
            );
        }

        const text = await file.text();
        const rows = parseCsv(text);

        if (rows.length === 0) {
            return NextResponse.json(
                { error: "CSV file is empty or has no data rows" },
                { status: 400 },
            );
        }

        if (rows.length > MAX_ROWS) {
            return NextResponse.json(
                {
                    error: `CSV has ${rows.length} rows. Maximum ${MAX_ROWS} rows per import is allowed.`,
                },
                { status: 400 },
            );
        }

        // ── Check for duplicate employee codes within the CSV ──────────────
        const codeSet = new Set<string>();
        for (const row of rows) {
            if (row.employeeCode) {
                if (codeSet.has(row.employeeCode)) {
                    row.errors.push("Duplicate employee code in CSV");
                } else {
                    codeSet.add(row.employeeCode);
                }
            }
        }

        // ── Check for duplicate emails within the CSV ──────────────────────
        const emailSet = new Set<string>();
        for (const row of rows) {
            if (row.email) {
                const lower = row.email.toLowerCase();
                if (emailSet.has(lower)) {
                    row.errors.push("Duplicate email in CSV");
                } else {
                    emailSet.add(lower);
                }
            }
        }

        // ── Check existing employee codes in the database (within org) ─────
        const codes = rows.map((r) => r.employeeCode).filter(Boolean);
        if (codes.length > 0) {
            const existing = await auth.withDB((db) =>
                db.employee.findMany({
                    where: {
                        organizationId: auth.organizationId,
                        employeeCode: { in: codes },
                    },
                    select: { employeeCode: true },
                }),
            );
            const existingCodes = new Set(existing.map((e) => e.employeeCode));
            for (const row of rows) {
                if (row.employeeCode && existingCodes.has(row.employeeCode)) {
                    row.errors.push("Employee code already exists");
                }
            }
        }

        // ── Check existing emails in the database (within org) ─────────────
        const emails = rows
            .map((r) => r.email)
            .filter(Boolean)
            .map((e) => e!.toLowerCase());
        if (emails.length > 0) {
            const existingEmails = await auth.withDB((db) =>
                db.employee.findMany({
                    where: {
                        organizationId: auth.organizationId,
                        email: { in: emails },
                    },
                    select: { email: true },
                }),
            );
            const existingEmailSet = new Set(
                existingEmails
                    .map((e) => e.email?.toLowerCase())
                    .filter(Boolean) as string[],
            );
            for (const row of rows) {
                if (row.email && existingEmailSet.has(row.email.toLowerCase())) {
                    row.errors.push("Email already exists in organization");
                }
            }
        }

        const validRows = rows.filter((r) => r.errors.length === 0);
        const invalidRows = rows.filter((r) => r.errors.length > 0);

        // ── If confirm mode, create the employees ─────────────────────────
        let created = 0;
        let failed = 0;
        if (confirm && validRows.length > 0) {
            // Fetch departments and designations for name → id mapping
            const [departments, designations] = await auth.withDB((db) =>
                Promise.all([
                    db.department.findMany({
                        where: { organizationId: auth.organizationId },
                        select: { id: true, name: true },
                    }),
                    db.designation.findMany({
                        where: { organizationId: auth.organizationId },
                        select: { id: true, name: true },
                    }),
                ]),
            );

            const deptMap = new Map(
                departments.map((d) => [d.name.toLowerCase(), d.id]),
            );
            const desigMap = new Map(
                designations.map((d) => [d.name.toLowerCase(), d.id]),
            );

            for (const row of validRows) {
                try {
                    await auth.withDB(async (db) => {
                        await db.employee.create({
                            data: {
                                employeeCode: row.employeeCode,
                                firstName: row.firstName,
                                lastName: row.lastName,
                                email: row.email ? row.email.toLowerCase() : null,
                                phone: row.phone || null,
                                joiningDate: new Date(row.joiningDate),
                                employmentType: row.employmentType.toLowerCase(),
                                gender: row.gender ? row.gender.toLowerCase() : null,
                                organizationId: auth.organizationId,
                                departmentId: row.department
                                    ? (deptMap.get(row.department.toLowerCase()) ?? null)
                                    : null,
                                designationId: row.designation
                                    ? (desigMap.get(row.designation.toLowerCase()) ?? null)
                                    : null,
                            },
                        });
                    });
                    created++;
                } catch (err) {
                    apiLogger.error(
                        { err, employeeCode: row.employeeCode },
                        "BULK_IMPORT_EMPLOYEE_CREATE_FAILED",
                    );
                    failed++;
                    row.errors.push("Database error during creation");
                }
            }
        }

        return NextResponse.json({
            total: rows.length,
            valid: validRows.length,
            invalid: invalidRows.length,
            created: confirm ? created : 0,
            failed: confirm ? failed : 0,
            preview: {
                validRows: validRows.slice(0, 100),
                invalidRows: invalidRows.slice(0, 100),
            },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "BULK_IMPORT_FAILED");
        return NextResponse.json(
            { error: "Failed to process CSV file" },
            { status: 500 },
        );
    }
}
