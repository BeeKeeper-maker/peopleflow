import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const body = await req.json();

        const field = await prisma.customField.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!field) {
            return NextResponse.json({ error: "Custom field not found" }, { status: 404 });
        }

        const updated = await prisma.customField.update({
            where: { id },
            data: {
                ...(body.label !== undefined && { label: body.label }),
                ...(body.options !== undefined && { options: body.options }),
                ...(body.isRequired !== undefined && { isRequired: body.isRequired }),
                ...(body.isFilterable !== undefined && { isFilterable: body.isFilterable }),
                ...(body.isSearchable !== undefined && { isSearchable: body.isSearchable }),
                ...(body.defaultValue !== undefined && { defaultValue: body.defaultValue }),
                ...(body.description !== undefined && { description: body.description }),
                ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
            },
        });

        await createAuditLog({
            organizationId: ctx.organizationId,
            action: "update",
            entityType: "CustomField",
            entityId: id,
            userId: ctx.userId,
        }).catch(() => {});

        return NextResponse.json(updated);
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_CUSTOM_FIELD_ERROR");
        return NextResponse.json({ error: "Failed to update custom field" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;

        const field = await prisma.customField.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!field) {
            return NextResponse.json({ error: "Custom field not found" }, { status: 404 });
        }

        // Soft delete (deactivate) instead of hard delete to preserve
        // existing customFields JSONB values in entities.
        await prisma.customField.update({
            where: { id },
            data: { isActive: false },
        });

        await createAuditLog({
            organizationId: ctx.organizationId,
            action: "delete",
            entityType: "CustomField",
            entityId: id,
            oldValues: { label: field.label, key: field.key },
            userId: ctx.userId,
        }).catch(() => {});

        return NextResponse.json({
            success: true,
            message: `Custom field "${field.label}" deactivated. Existing values are preserved.`,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "DELETE_CUSTOM_FIELD_ERROR");
        return NextResponse.json({ error: "Failed to delete custom field" }, { status: 500 });
    }
}
