import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, invalidatePermissionCache } from "@/lib/rbac-v2";
import { createAuditLog } from "@/lib/audit-log";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/access/users/[id]/roles — Get a user's role assignments
 */
export async function GET(req: Request, { params }: RouteParams) {
    const auth = await requirePermission("rbac:roles:view");
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await params;

        const user = await prisma.user.findFirst({
            where: { id, organizationId: auth.organizationId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                roleAssignments: {
                    include: {
                        role: {
                            select: { id: true, name: true, slug: true, isSystem: true, color: true },
                        },
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                currentRole: user.role,
                isActive: user.isActive,
            },
            assignments: user.roleAssignments.map((a) => ({
                id: a.id,
                roleId: a.roleId,
                roleName: a.role.name,
                roleSlug: a.role.slug,
                isSystem: a.role.isSystem,
                color: a.role.color,
                assignedAt: a.assignedAt,
                expiresAt: a.expiresAt,
            })),
        });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_USER_ROLES_ERROR");
        return NextResponse.json({ error: "Failed to fetch user roles" }, { status: 500 });
    }
}

const assignRoleSchema = z.object({
    roleId: z.string().min(1, "Role ID is required"),
    expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * POST /api/access/users/[id]/roles — Assign a role to a user
 *
 * Creates a UserRoleAssignment record AND updates User.role (legacy string)
 * to match the new role's slug. This is the missing link in RBAC v2.
 */
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requirePermission("rbac:roles:manage");
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await params;
        const body = await req.json();
        const validation = assignRoleSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.issues },
                { status: 400 },
            );
        }

        const { roleId, expiresAt } = validation.data;

        const user = await prisma.user.findFirst({
            where: { id, organizationId: auth.organizationId },
            select: { id: true, email: true, role: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const role = await prisma.role.findFirst({
            where: {
                id: roleId,
                OR: [{ organizationId: auth.organizationId }, { organizationId: null }],
            },
        });

        if (!role) {
            return NextResponse.json({ error: "Role not found" }, { status: 404 });
        }

        // Prevent demoting the last admin
        if ((user.role === "admin" || user.role === "super_admin") && role.slug !== "admin" && role.slug !== "super_admin") {
            const adminCount = await prisma.user.count({
                where: {
                    organizationId: auth.organizationId,
                    role: { in: ["admin", "super_admin"] },
                    isActive: true,
                },
            });
            if (adminCount <= 1) {
                return NextResponse.json(
                    { error: "Cannot demote the last admin. Promote another user first." },
                    { status: 400 },
                );
            }
        }

        // Prevent self-demotion
        if (user.id === auth.userId && (role.slug === "employee" || role.slug === "manager")) {
            return NextResponse.json(
                { error: "You cannot demote yourself. Ask another admin." },
                { status: 400 },
            );
        }

        const assignment = await prisma.userRoleAssignment.upsert({
            where: { userId_roleId: { userId: id, roleId } },
            create: {
                userId: id,
                roleId,
                organizationId: auth.organizationId,
                assignedBy: auth.userId,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
            update: {
                assignedBy: auth.userId,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
        });

        // Update User.role (legacy string) to match
        await prisma.user.update({
            where: { id },
            data: { role: role.slug },
        });

        invalidatePermissionCache(id);

        await createAuditLog({
            organizationId: auth.organizationId,
            action: "update",
            entityType: "User",
            entityId: id,
            oldValues: { role: user.role },
            newValues: { role: role.slug, roleId, roleName: role.name, assignedBy: auth.userId },
            userId: auth.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => apiLogger.error({ err }, "Audit log failed for role assignment"));

        apiLogger.info(
            { userId: id, roleId, roleSlug: role.slug, assignerUserId: auth.userId },
            "Role assigned to user",
        );

        return NextResponse.json({
            success: true,
            assignment,
            message: `Role "${role.name}" assigned to ${user.email}. Access updated.`,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "ASSIGN_ROLE_ERROR");
        return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
    }
}

/**
 * DELETE /api/access/users/[id]/roles?roleId=... — Remove a role assignment
 */
export async function DELETE(req: Request, { params }: RouteParams) {
    const auth = await requirePermission("rbac:roles:manage");
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await params;
        const url = new URL(req.url);
        const roleId = url.searchParams.get("roleId");

        if (!roleId) {
            return NextResponse.json({ error: "roleId query parameter is required" }, { status: 400 });
        }

        const user = await prisma.user.findFirst({
            where: { id, organizationId: auth.organizationId },
            select: { id: true, email: true, role: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (user.role === "admin" || user.role === "super_admin") {
            const adminCount = await prisma.user.count({
                where: {
                    organizationId: auth.organizationId,
                    role: { in: ["admin", "super_admin"] },
                    isActive: true,
                },
            });
            if (adminCount <= 1) {
                return NextResponse.json(
                    { error: "Cannot remove the last admin's role." },
                    { status: 400 },
                );
            }
        }

        await prisma.userRoleAssignment.deleteMany({
            where: { userId: id, roleId },
        });

        await prisma.user.update({
            where: { id },
            data: { role: "employee" },
        });

        invalidatePermissionCache(id);

        await createAuditLog({
            organizationId: auth.organizationId,
            action: "update",
            entityType: "User",
            entityId: id,
            oldValues: { role: user.role },
            newValues: { role: "employee", action: "role_removed", roleId },
            userId: auth.userId,
        }).catch(() => {});

        return NextResponse.json({
            success: true,
            message: `Role removed. ${user.email} now has the default Employee role.`,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "REMOVE_ROLE_ERROR");
        return NextResponse.json({ error: "Failed to remove role" }, { status: 500 });
    }
}
