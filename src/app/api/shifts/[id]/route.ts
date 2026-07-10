import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { z } from "zod";
import { apiLogger } from "@/lib/logger";

const shiftSchema = z.object({
    name: z.string().min(1, "Name is required"),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid logic format (HH:mm)"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid logic format (HH:mm)"),
    breakDuration: z.number().min(0).default(60),
    graceMinutes: z.number().min(0).default(15),
    halfDayHours: z.number().min(0).default(4),
    fullDayHours: z.number().min(0).default(8),
    isDefault: z.boolean().default(false),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const { id } = await params;
        const json = await req.json();
        const body = shiftSchema.parse(json);

        // If setting as default, unset others
        if (body.isDefault) {
            await auth.withDB((db) =>
                db.shift.updateMany({
                    where: { organizationId: auth.organizationId, isDefault: true, id: { not: id } },
                    data: { isDefault: false }
                }),
            );
        }

        const shift = await auth.withDB((db) =>
            db.shift.update({
                where: { id, organizationId: auth.organizationId },
                data: body
            }),
        );

        return NextResponse.json(shift);

    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "UPDATE_SHIFT_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) return auth;

        const { id } = await params;

        // Check if assigned to any employees
        const assignedCount = await auth.withDB((db) =>
            db.employee.count({
                where: { shiftId: id, organizationId: auth.organizationId }
            }),
        );

        if (assignedCount > 0) {
            return new NextResponse(`Cannot delete shift. It is assigned to ${assignedCount} employees.`, { status: 400 });
        }

        // Soft delete or hard delete? Schema says isActive, so let's use that or hard delete if no relations.
        // Actually, let's hard delete since we checked relations.
        await auth.withDB((db) =>
            db.shift.delete({
                where: { id, organizationId: auth.organizationId }
            }),
        );

        return new NextResponse(null, { status: 204 });

    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "DELETE_SHIFT_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
