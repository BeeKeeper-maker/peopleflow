import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { requirePermission } from "@/lib/rbac-v2";
import { createAuditLog } from "@/lib/audit-log";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/rbac/roles/[id] — Get a single role with full details
 */
export async function GET(_req: Request, { params }: RouteParams) {
    const auth = await requirePermission("rbac:roles:view");
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await params;

        const role = await auth.withDB((db) =>
            db.role.findFirst({
                where: {
                    id,
                    OR: [{ organizationId: auth.organizationId }, { organizationId: null }],
                },
                include: {
                    rolePermissions: {
                        include: { permission: true },
                    },
                    _count: {
                        select: { userAssignments: true },
                    },
                },
            }),
        );

        if (!role) {
            return NextResponse.json({ error: "Role not found" }, { status: 404 });
        }

        return NextResponse.json(role);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_ROLE_ERROR");
        return NextResponse.json({ error: "Failed to fetch role" }, { status: 500 });
    }
}

const updateRoleSchema = z.object({
    name: z.string().min(2).max(50).optional(),
    description: z.string().max(500).nullable().optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    permissions: z
        .array(
            z.object({
                permissionId: z.string(),
                scope: z.enum(["global", "department", "branch", "self", "team"]).default("global"),
                departmentIds: z.array(z.string()).optional(),
                branchIds: z.array(z.string()).optional(),
            }),
        )
        .optional(),
});

/**
 * PATCH /api/rbac/roles/[id] — Update a role (name, description, permissions)
 *
 * System roles (isSystem=true):
 *   - Name/description/color can be edited (cosmetic)
 *   - Permissions can be EXTENDED but the system-seeded permissions cannot
 *     be removed (to preserve invariants like "admin can always view employees")
 *
 * Custom roles (isSystem=false):
 *   - Fully editable
 *
 * Authorization: rbac:roles:manage
 */
export async function PATCH(req: Request, { params }: RouteParams) {
    const auth = await requirePermission("rbac:roles:manage");
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await params;
        const body = await req.json();
        const validation = updateRoleSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validation.error.issues.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        const { name, description, color, permissions } = validation.data;

        // Load role, verifying org scope
        const role = await auth.withDB((db) =>
            db.role.findFirst({
                where: {
                    id,
                    OR: [{ organizationId: auth.organizationId }, { organizationId: null }],
                },
                include: {
                    rolePermissions: true,
                },
            }),
        );

        if (!role) {
            return NextResponse.json({ error: "Role not found" }, { status: 404 });
        }

        // P17-BUGS-11: System core roles (admin, hr_admin, manager, employee,
        // super_admin) cannot have their permission set modified — doing so
        // would let a malicious/accidental admin strip critical invariants
        // (e.g., remove "admin can always view employees") and lock the
        // tenant out of recovery paths. Cosmetic edits (name/description/
        // color) are still permitted, but `permissions` is rejected.
        // Tenants that need a different permission set must create a custom
        // role (isSystem=false) instead.
        if (role.isSystem && permissions !== undefined) {
            return NextResponse.json(
                {
                    error: "System roles cannot be modified. Create a custom role instead.",
                    code: "SYSTEM_ROLE_PERMISSIONS_LOCKED",
                },
                { status: 403 },
            );
        }

        const oldValues = {
            name: role.name,
            description: role.description,
            color: role.color,
            permissionsCount: role.rolePermissions.length,
        };

        // Update (withDB already wraps in transaction)
        const updated = await auth.withDB(async (db) => {
            const updatedRole = await db.role.update({
                where: { id },
                data: {
                    ...(name !== undefined ? { name } : {}),
                    ...(description !== undefined ? { description } : {}),
                    ...(color !== undefined ? { color } : {}),
                },
            });

            // If permissions provided, replace all RolePermission rows
            if (permissions !== undefined) {
                // For system roles, preserve existing system-seeded permissions
                if (role.isSystem) {
                    await db.rolePermission.deleteMany({
                        where: { roleId: id },
                    });
                } else {
                    await db.rolePermission.deleteMany({
                        where: { roleId: id },
                    });
                }

                if (permissions.length > 0) {
                    // Validate permissionIds
                    const permIds = permissions.map((p) => p.permissionId);
                    const existingPerms = await db.permission.findMany({
                        where: { id: { in: permIds } },
                        select: { id: true },
                    });
                    const existingPermIds = new Set(existingPerms.map((p) => p.id));
                    const validPerms = permissions.filter((p) => existingPermIds.has(p.permissionId));

                    await db.rolePermission.createMany({
                        data: validPerms.map((p) => ({
                            roleId: id,
                            permissionId: p.permissionId,
                            scope: p.scope,
                            departmentIds: p.departmentIds
                                ? (p.departmentIds as unknown as Prisma.InputJsonValue)
                                : Prisma.JsonNull,
                            branchIds: p.branchIds
                                ? (p.branchIds as unknown as Prisma.InputJsonValue)
                                : Prisma.JsonNull,
                        })),
                    });
                }
            }

            return updatedRole;
        });

        // Audit log
        await createAuditLog({
            organizationId: auth.organizationId,
            action: "update",
            entityType: "Role",
            entityId: id,
            oldValues,
            newValues: {
                name,
                description,
                color,
                permissionsCount: permissions?.length,
            },
            userId: auth.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            apiLogger.error({ err }, "Audit log failed for role update");
        });

        // Invalidate permission cache for all users with this role
        const assignments = await auth.withDB((db) =>
            db.userRoleAssignment.findMany({
                where: { roleId: id },
                select: { userId: true },
            }),
        );
        const { invalidatePermissionCache } = await import("@/lib/rbac-v2");
        for (const a of assignments) {
            // P17-BUGS-10: invalidatePermissionCache is now async (clears
            // both the local in-process Map and the cross-node Redis marker
            // key). Fire-and-forget — failures are logged inside the helper.
            invalidatePermissionCache(a.userId).catch((err) =>
                apiLogger.error({ err, userId: a.userId }, "Failed to invalidate permission cache"),
            );
        }

        return NextResponse.json({
            success: true,
            role: updated,
            message: `Role "${updated.name}" updated.`,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_ROLE_ERROR");
        return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }
}

/**
 * DELETE /api/rbac/roles/[id] — Delete a custom role
 *
 * System roles (isSystem=true) cannot be deleted.
 * Roles with active user assignments cannot be deleted (reassign first).
 *
 * Authorization: rbac:roles:manage
 */
export async function DELETE(req: Request, { params }: RouteParams) {
    const auth = await requirePermission("rbac:roles:manage");
    if (auth instanceof NextResponse) return auth;

    try {
        const { id } = await params;

        const role = await auth.withDB((db) =>
            db.role.findFirst({
                where: {
                    id,
                    OR: [{ organizationId: auth.organizationId }, { organizationId: null }],
                },
                include: {
                    _count: { select: { userAssignments: true } },
                },
            }),
        );

        if (!role) {
            return NextResponse.json({ error: "Role not found" }, { status: 404 });
        }

        if (role.isSystem) {
            return NextResponse.json(
                { error: "System roles cannot be deleted", code: "SYSTEM_ROLE" },
                { status: 400 },
            );
        }

        if (role._count.userAssignments > 0) {
            return NextResponse.json(
                {
                    error: `Cannot delete role: ${role._count.userAssignments} user(s) are still assigned. Reassign them first.`,
                    code: "HAS_USERS",
                    userCount: role._count.userAssignments,
                },
                { status: 409 },
            );
        }

        await auth.withDB((db) => db.role.delete({ where: { id } }));

        await createAuditLog({
            organizationId: auth.organizationId,
            action: "delete",
            entityType: "Role",
            entityId: id,
            oldValues: { name: role.name, slug: role.slug },
            userId: auth.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            apiLogger.error({ err }, "Audit log failed for role deletion");
        });

        apiLogger.info(
            { roleId: id, roleName: role.name, deleterUserId: auth.userId },
            "Custom role deleted",
        );

        return NextResponse.json({
            success: true,
            message: `Role "${role.name}" deleted.`,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "DELETE_ROLE_ERROR");
        return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
    }
}
