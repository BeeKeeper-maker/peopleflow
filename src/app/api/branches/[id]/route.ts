import { NextResponse } from "next/server";

import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

// GET /api/branches/[id] — Get a single branch
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;

        const branch = await auth.withDB((db) => db.branch.findFirst({
            where: { id, organizationId: auth.organizationId },
            include: {
                _count: { select: { employees: true } },
            },
        }));

        if (!branch) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }

        return NextResponse.json(branch);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "GET_BRANCH_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}

// PUT /api/branches/[id] — Update a branch
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;
        const json = await req.json();

        // Verify ownership
        const existing = await auth.withDB((db) => db.branch.findFirst({
            where: { id, organizationId: auth.organizationId },
        }));

        if (!existing) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }

        const branch = await auth.withDB((db) => db.branch.update({
            where: { id },
            data: {
                name: json.name,
                code: json.code || undefined,
                address: json.address || null,
                city: json.city || null,
                phone: json.phone || null,
                email: json.email || null,
                isHeadOffice: json.isHeadOffice ?? existing.isHeadOffice,
                isActive: json.isActive ?? existing.isActive,
                latitude: json.latitude !== undefined ? (json.latitude != null ? parseFloat(json.latitude) : null) : existing.latitude,
                longitude: json.longitude !== undefined ? (json.longitude != null ? parseFloat(json.longitude) : null) : existing.longitude,
                geoFenceRadius: json.geoFenceRadius !== undefined ? parseInt(json.geoFenceRadius) : existing.geoFenceRadius,
            },
        }));

        return NextResponse.json(branch);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "UPDATE_BRANCH_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}

// DELETE /api/branches/[id] — Delete a branch
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        const { id } = await params;

        const branch = await auth.withDB((db) => db.branch.findFirst({
            where: { id, organizationId: auth.organizationId },
        }));

        if (!branch) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }

        await auth.withDB((db) => db.branch.delete({ where: { id } }));

        return NextResponse.json({ success: true });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        apiLogger.error({ err: error, errorId }, "DELETE_BRANCH_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
