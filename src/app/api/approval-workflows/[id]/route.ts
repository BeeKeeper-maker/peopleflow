import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

// PUT /api/approval-workflows/[id] — Update a workflow
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    const { id } = await params;

    try {
        const existing = await prisma.approvalWorkflow.findUnique({
            where: { id },
        });

        if (!existing || existing.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }

        const body = await req.json();
        const { name, steps, isActive } = body;

        const updated = await prisma.approvalWorkflow.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(steps !== undefined && { steps: typeof steps === "string" ? steps : JSON.stringify(steps) }),
                ...(isActive !== undefined && { isActive }),
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Failed to update workflow:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE /api/approval-workflows/[id] — Delete a workflow
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    const { id } = await params;

    try {
        const existing = await prisma.approvalWorkflow.findUnique({
            where: { id },
        });

        if (!existing || existing.organizationId !== auth.organizationId) {
            return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
        }

        await prisma.approvalWorkflow.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete workflow:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
