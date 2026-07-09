import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

// Valid document types for employee self-service
const VALID_DOC_TYPES = [
    "offer_letter", "appointment_letter", "experience_certificate",
    "increment_letter", "salary_certificate", "noc_letter",
];

/**
 * GET /api/ess/document-request — List employee's own document requests
 */
export async function GET(req: Request) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        // Find the logged-in employee
        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: { userId: auth.userId, organizationId: auth.organizationId },
        }));

        if (!employee) {
            return NextResponse.json(
                { error: "Employee profile not found" },
                { status: 404 }
            );
        }

        const requests = await auth.withDB((db) => db.documentRequest.findMany({
            where: {
                employeeId: employee.id,
                organizationId: auth.organizationId,
            },
            orderBy: { createdAt: "desc" },
        }));

        return NextResponse.json(requests);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_DOCUMENT_REQUESTS_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

/**
 * POST /api/ess/document-request — Submit a document request
 * Auto-generates the document if possible, otherwise saves as pending
 */
export async function POST(req: Request) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const body = await req.json();
        const { type } = body;

        if (!type || !VALID_DOC_TYPES.includes(type)) {
            return NextResponse.json(
                { error: `Invalid document type. Must be one of: ${VALID_DOC_TYPES.join(", ")}` },
                { status: 400 }
            );
        }

        // Auto-scope to the logged-in employee
        const employee = await auth.withDB((db) => db.employee.findFirst({
            where: {
                userId: auth.userId,
                organizationId: auth.organizationId,
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
        }));

        if (!employee) {
            return NextResponse.json(
                { error: "Employee profile not found" },
                { status: 404 }
            );
        }

        // Create a tracked document request
        const docRequest = await auth.withDB((db) => db.documentRequest.create({
            data: {
                type,
                status: "processing",
                employeeId: employee.id,
                organizationId: auth.organizationId,
            },
        }));

        // Try to auto-generate the document
        let html: string | null = null;
        try {
            const { generateDocumentHTML, getRequiredFields } = await import("@/lib/document-templates");
            type DocumentType = Parameters<typeof generateDocumentHTML>[0];

            const assignment = employee.salaryAssignments?.[0];
            const basicSalary = assignment
                ? Math.round(Number(assignment.grossSalary) * (Number(assignment.salaryStructure.basicPercentage) / 100))
                : 0;

            const docData: Record<string, string | number> = {
                organizationName: employee.organization?.name || "",
                employeeName: employee.user?.name || "",
                employeeEmail: employee.user?.email || "",
                department: employee.department?.name || "",
                designation: employee.designation?.name || "",
                employeeCode: employee.employeeCode || "",
                joiningDate: employee.joiningDate?.toLocaleDateString("en-GB") || "",
                gender: employee.gender || "",
                grossSalary: assignment?.grossSalary ? Number(assignment.grossSalary) : 0,
                basicSalary,
                netSalary: assignment?.grossSalary ? Number(assignment.grossSalary) : 0,
                date: new Date().toLocaleDateString("en-GB"),
            };

            html = generateDocumentHTML(type as DocumentType, docData);

            // Mark as ready
            await auth.withDB((db) => db.documentRequest.update({
                where: { id: docRequest.id },
                data: {
                    status: "ready",
                    processedAt: new Date(),
                    processedBy: auth.userId,
                },
            }));
        } catch {
            // If generation fails, leave as processing for HR to handle
            apiLogger.warn("Auto-generation not available for:", type);
        }

        // Re-fetch the request to return the latest status (may have been updated to 'ready')
        const updatedRequest = await auth.withDB((db) => db.documentRequest.findUnique({
            where: { id: docRequest.id },
        }));

        return NextResponse.json({
            success: true,
            request: updatedRequest || docRequest,
            html,
            type,
            employeeName: employee.user?.name,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "ESS Document request error:");
        return NextResponse.json(
            { error: "Failed to process document request" },
            { status: 500 }
        );
    }
}
