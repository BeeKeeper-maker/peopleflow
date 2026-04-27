import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { apiLogger } from "@/lib/logger";

// GET /api/rbac/delegations — List delegations for the current user's organization
export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    try {
        // Delegations where current user is the "owner" (created for others during their tenure)
        // We use organizationId to scope and show all delegations
        const allDelegations = await prisma.rBACPermission.findMany({
            where: {
                organizationId: auth.organizationId,
            },
            include: {
                user: {
                    select: { name: true, email: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        // Split into: delegated TO current user vs delegated to others
        const received = allDelegations.filter((d) => d.userId === auth.userId);
        const delegated = allDelegations.filter((d) => d.userId !== auth.userId);

        return NextResponse.json({
            data: {
                delegated,
                received,
            },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "DELEGATION_LIST_ERROR");
        return NextResponse.json({ error: "Failed to fetch delegations" }, { status: 500 });
    }
}

// POST /api/rbac/delegations — Create a new time-bounded delegation
export async function POST(req: NextRequest) {
    // Only admin/HR can create permission delegations
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const body = await req.json();

        // Find the target employee's user ID — must belong to same org
        const targetEmployee = await prisma.employee.findFirst({
            where: { id: body.targetEmployeeId, organizationId: auth.organizationId },
            select: { userId: true, firstName: true, lastName: true },
        });

        if (!targetEmployee?.userId) {
            return NextResponse.json({ error: "Target employee not found" }, { status: 404 });
        }

        // Self-delegation prevention
        if (targetEmployee.userId === auth.userId) {
            return NextResponse.json({ error: "Cannot delegate to yourself" }, { status: 400 });
        }

        const delegation = await prisma.rBACPermission.create({
            data: {
                userId: targetEmployee.userId,
                organizationId: auth.organizationId,
                permission: body.permission || "approval:act",
                scope: body.scope || "department",
                departmentIds: body.departmentIds || [],
                validFrom: new Date(body.validFrom),
                validUntil: new Date(body.validUntil),
                isActive: true,
            },
        });

        return NextResponse.json({ data: delegation }, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "DELEGATION_CREATE_ERROR");
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create delegation" },
            { status: 500 }
        );
    }
}

// DELETE /api/rbac/delegations — Revoke a delegation
export async function DELETE(req: NextRequest) {
    // Only admin/HR can revoke delegations
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const id = req.nextUrl.searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "Delegation ID required" }, { status: 400 });
        }

        // Verify the delegation belongs to caller's organization
        const existing = await prisma.rBACPermission.findFirst({
            where: { id, organizationId: auth.organizationId },
        });
        if (!existing) {
            return NextResponse.json({ error: "Delegation not found" }, { status: 404 });
        }

        await prisma.rBACPermission.update({
            where: { id },
            data: { isActive: false },
        });

        return NextResponse.json({ message: "Delegation revoked" });
    } catch (error) {
        apiLogger.error({ err: error }, "DELEGATION_DELETE_ERROR");
        return NextResponse.json({ error: "Failed to revoke delegation" }, { status: 500 });
    }
}
