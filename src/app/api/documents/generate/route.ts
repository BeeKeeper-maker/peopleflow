import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrHR } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { generateDocumentHTML, getDocumentTypes, getRequiredFields } from "@/lib/document-templates";
import type { DocumentType } from "@/lib/document-templates";
import { apiLogger } from "@/lib/logger";
import { toPlainSettings } from "@/lib/settings-json";

// Valid document types for validation
const VALID_DOC_TYPES = [
    "offer_letter", "appointment_letter", "experience_certificate",
    "increment_letter", "warning_letter", "termination_letter",
    "salary_certificate", "noc_letter",
];

const AUTO_POPULATED_FIELDS = new Set([
    "organizationName", "employeeName", "employeeEmail", "department", "designation",
    "employeeCode", "joiningDate", "gender", "grossSalary", "basicSalary", "netSalary", "date",
]);

function getCustomRequiredFields(type: DocumentType): string[] {
    return getRequiredFields(type).filter((field) => !AUTO_POPULATED_FIELDS.has(field));
}

function formatDateOverride(value: unknown): string | undefined {
    if (typeof value !== "string" || !value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

function normalizeCustomData(customData: Record<string, unknown>): Record<string, string | number> {
    const entries = Object.entries(customData).map(([key, value]) => {
        const normalizedKey = key === "referenceNumber" ? "refNumber" : key;
        const normalizedValue = normalizedKey.toLowerCase().includes("date")
            ? (formatDateOverride(value) ?? value)
            : value;
        return [normalizedKey, typeof normalizedValue === "number" ? normalizedValue : String(normalizedValue ?? "")];
    });

    return Object.fromEntries(entries);
}

/**
 * POST - Generate document for an employee
 */
export async function POST(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;
        const ctx = auth as AuthContext;

        const body = await req.json();
        const { type, employeeId, customData = {} } = body;

        // ✅ Validate document type
        if (!type || !VALID_DOC_TYPES.includes(type)) {
            return NextResponse.json(
                { error: `Invalid document type. Must be one of: ${VALID_DOC_TYPES.join(", ")}` },
                { status: 400 }
            );
        }

        if (!employeeId || typeof employeeId !== "string") {
            return NextResponse.json({ error: "Employee ID is required" }, { status: 400 });
        }

        // ✅ Validate customData is an object (not array, null, etc.)
        if (typeof customData !== "object" || Array.isArray(customData) || customData === null) {
            return NextResponse.json({ error: "customData must be a plain object" }, { status: 400 });
        }

        const normalizedCustomData = normalizeCustomData(customData as Record<string, unknown>);
        const missingFields = getCustomRequiredFields(type as DocumentType)
            .filter((field) => normalizedCustomData[field] === undefined || normalizedCustomData[field] === null || String(normalizedCustomData[field]).trim() === "");

        if (missingFields.length > 0) {
            return NextResponse.json(
                { error: `Missing required fields: ${missingFields.join(", ")}`, missingFields },
                { status: 400 }
            );
        }

        // ✅ Org-scoping: verify employee belongs to same organization
        const employee = await prisma.employee.findFirst({
            where: {
                id: employeeId,
                organizationId: ctx.organizationId,
            },
            include: {
                user: { select: { name: true, email: true } },
                department: { select: { name: true } },
                designation: { select: { name: true } },
                organization: { select: { name: true, settings: true } },
                salaryAssignments: {
                    where: { isActive: true },
                    include: { salaryStructure: true },
                    take: 1,
                },
            },
        });

        if (!employee) {
            return NextResponse.json(
                { error: "Employee not found in your organization" },
                { status: 404 }
            );
        }

        // Build document data from employee record
        const assignment = employee.salaryAssignments?.[0];
        const basicSalary = assignment
            ? Math.round(assignment.grossSalary * (assignment.salaryStructure.basicPercentage / 100))
            : 0;

        const orgSettings = toPlainSettings(employee.organization?.settings);
        const documentSettings =
            typeof orgSettings.documents === "object" && orgSettings.documents !== null && !Array.isArray(orgSettings.documents)
                ? orgSettings.documents as Record<string, unknown>
                : {};

        const docData: Record<string, string | number> = {
            // Organization info
            organizationName: employee.organization?.name || "",
            orgAddress: typeof documentSettings.orgAddress === "string" ? documentSettings.orgAddress : "",
            signatoryName: typeof documentSettings.signatoryName === "string" ? documentSettings.signatoryName : "",
            signatoryDesignation: typeof documentSettings.signatoryDesignation === "string" ? documentSettings.signatoryDesignation : "",
            signatureImageUrl: typeof documentSettings.signatureImageUrl === "string" ? documentSettings.signatureImageUrl : "",
            // Employee info
            employeeName: employee.user?.name || `${employee.firstName} ${employee.lastName}`.trim(),
            employeeEmail: employee.user?.email || employee.email || "",
            department: employee.department?.name || "",
            designation: employee.designation?.name || "",
            employeeCode: employee.employeeCode || "",
            joiningDate: employee.joiningDate?.toLocaleDateString("en-GB") || "",
            gender: employee.gender || "",
            // Salary info
            grossSalary: assignment?.grossSalary || 0,
            basicSalary,
            netSalary: assignment?.grossSalary || 0, // Approximate
            // Current date
            date: new Date().toLocaleDateString("en-GB"),
            // ✅ Custom data merged AFTER defaults (user can override)
            // Note: all values are HTML-escaped by document-templates.ts safe() function
            ...normalizedCustomData,
        };

        const html = generateDocumentHTML(type as DocumentType, docData);
        const requiredFields = getCustomRequiredFields(type as DocumentType);

        return NextResponse.json({
            success: true,
            html,
            type,
            employeeName: employee.user?.name,
            requiredFields,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "Document generation error:");
        return NextResponse.json(
            { error: "Failed to generate document" },
            { status: 500 }
        );
    }
}

/**
 * GET - List available document types and their required fields
 */
export async function GET() {
    try {
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;

        const types = getDocumentTypes();

        return NextResponse.json({
            documentTypes: types.map(t => ({
                ...t,
                requiredFields: getCustomRequiredFields(t.value),
            })),
        });
    } catch (error) {
        apiLogger.error({ err: error }, "Document types error:");
        return NextResponse.json(
            { error: "Failed to fetch document types" },
            { status: 500 }
        );
    }
}
