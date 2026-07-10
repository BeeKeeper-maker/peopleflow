import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

// PUT /api/approval-workflows/[id] — Update a workflow
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr can update approval workflows
    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const { id } = await params;

    try {
        const existing = await auth.withDB((db) => db.approvalWorkflow.findUnique({
            where: { id },
        }));

        if (!existing || existing.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }

        const body = await req.json();
        const { name, steps, isActive } = body;

        const updated = await auth.withDB((db) => db.approvalWorkflow.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(steps !== undefined && { steps: typeof steps === "string" ? steps : JSON.stringify(steps) }),
                ...(isActive !== undefined && { isActive }),
            },
        }));

        return NextResponse.json(updated);
    } catch (error) {
        apiLogger.error({ err: error }, "Failed to update workflow:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE /api/approval-workflows/[id] — Delete a workflow
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr can delete approval workflows
    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const { id } = await params;

    try {
        const existing = await auth.withDB((db) => db.approvalWorkflow.findUnique({
            where: { id },
        }));

        if (!existing || existing.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }

        await auth.withDB((db) => db.approvalWorkflow.delete({ where: { id } }));

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "Failed to delete workflow:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
