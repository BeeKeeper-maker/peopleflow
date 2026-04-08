import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdminOrHR } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { generateDocumentHTML, getDocumentTypes, getRequiredFields } from "@/lib/document-templates";
import type { DocumentType } from "@/lib/document-templates";
import { apiLogger } from "@/lib/logger";

// Valid document types for validation
const VALID_DOC_TYPES = [
    "offer_letter", "appointment_letter", "experience_certificate",
    "increment_letter", "warning_letter", "termination_letter",
    "salary_certificate", "noc_letter",
];

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
                organization: { select: { name: true } },
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

        const docData: Record<string, string | number> = {
            // Organization info
            organizationName: employee.organization?.name || "",
            // Employee info
            employeeName: employee.user?.name || "",
            employeeEmail: employee.user?.email || "",
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
            ...customData,
        };

        const html = generateDocumentHTML(type as DocumentType, docData);
        const requiredFields = getRequiredFields(type as DocumentType);

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
export async function GET(req: Request) {
    try {
        const auth = await requireAdminOrHR();
        if (auth instanceof NextResponse) return auth;

        const types = getDocumentTypes();

        return NextResponse.json({
            documentTypes: types.map(t => ({
                ...t,
                requiredFields: getRequiredFields(t.value),
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
