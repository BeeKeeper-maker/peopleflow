import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma";
import { requirePermission } from "@/lib/rbac-v2";
import { getOrgRoles } from "@/lib/rbac-v2";
import { createAuditLog } from "@/lib/audit-log";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

/**
 * GET /api/rbac/roles — List all roles (system + custom) for the org
 *
 * Returns roles with their permissions and user counts.
 *
 * Authorization: rbac:roles:view
 */
export async function GET() {
    const auth = await requirePermission("rbac:roles:view");
    if (auth instanceof NextResponse) return auth;

    try {
        const roles = await getOrgRoles(auth.organizationId);
        return NextResponse.json({ data: roles, total: roles.length });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_ROLES_ERROR");
        return NextResponse.json(
            { error: "Failed to fetch roles" },
            { status: 500 },
        );
    }
}

const createRoleSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50),
    slug: z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9_]+$/, "Slug must be lowercase letters, numbers, and underscores only"),
    description: z.string().max(500).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    permissions: z.array(
        z.object({
            permissionId: z.string(),
            scope: z.enum(["global", "department", "branch", "self", "team"]).default("global"),
            departmentIds: z.array(z.string()).optional(),
            branchIds: z.array(z.string()).optional(),
        }),
    ).default([]),
});

/**
 * POST /api/rbac/roles — Create a custom role
 *
 * Body:
 *   {
 *     "name": "Branch Manager",
 *     "slug": "branch_manager",
 *     "description": "Manages a single branch",
 *     "color": "#10b981",
 *     "permissions": [
 *       { "permissionId": "perm_...", "scope": "global" },
 *       { "permissionId": "perm_...", "scope": "team" }
 *     ]
 *   }
 *
 * Authorization: rbac:roles:manage
 * Plan limit: Plan.maxCustomRoles (0=none, -1=unlimited)
 */
export async function POST(req: Request) {
    const auth = await requirePermission("rbac:roles:manage");
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json();
        const validation = createRoleSchema.safeParse(body);

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

        const { name, slug, description, color, permissions } = validation.data;

        // Check slug uniqueness within this org (system roles also count)
        const existing = await auth.withDB((db) =>
            db.role.findFirst({
                where: {
                    OR: [{ organizationId: auth.organizationId }, { organizationId: null }],
                    slug,
                },
            }),
        );
        if (existing) {
            return NextResponse.json(
                { error: `A role with slug "${slug}" already exists`, code: "SLUG_EXISTS" },
                { status: 409 },
            );
        }

        // Check plan limit on custom roles
        const subscription = await auth.withDB((db) =>
            db.subscription.findUnique({
                where: { organizationId: auth.organizationId },
                include: { plan: true },
            }),
        );
        const maxCustomRoles = subscription?.plan?.maxCustomRoles ?? 0;
        if (maxCustomRoles !== -1) {
            const currentCount = await auth.withDB((db) =>
                db.role.count({
                    where: { organizationId: auth.organizationId, isSystem: false },
                }),
            );
            if (currentCount >= maxCustomRoles) {
                return NextResponse.json(
                    {
                        error: `Custom role limit reached (${currentCount}/${maxCustomRoles}). Upgrade your plan to create more custom roles.`,
                        code: "PLAN_LIMIT_REACHED",
                        currentCount,
                        maxCustomRoles,
                    },
                    { status: 402 },
                );
            }
        }

        // Validate all permissionIds exist
        if (permissions.length > 0) {
            const permIds = permissions.map((p) => p.permissionId);
            const existingPerms = await auth.withDB((db) =>
                db.permission.findMany({
                    where: { id: { in: permIds } },
                    select: { id: true },
                }),
            );
            const existingPermIds = new Set(existingPerms.map((p) => p.id));
            const invalid = permIds.filter((id) => !existingPermIds.has(id));
            if (invalid.length > 0) {
                return NextResponse.json(
                    {
                        error: `Invalid permission IDs: ${invalid.join(", ")}`,
                        code: "INVALID_PERMISSION",
                    },
                    { status: 400 },
                );
            }
        }

        // Create role + permissions (withDB already wraps in transaction)
        const role = await auth.withDB(async (db) => {
            const newRole = await db.role.create({
                data: {
                    name,
                    slug,
                    description,
                    color,
                    isSystem: false,
                    organizationId: auth.organizationId,
                    sortOrder: 100, // custom roles after system roles
                },
            });

            if (permissions.length > 0) {
                await db.rolePermission.createMany({
                    data: permissions.map((p) => ({
                        roleId: newRole.id,
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

            return newRole;
        });

        // Audit log
        await createAuditLog({
            organizationId: auth.organizationId,
            action: "create",
            entityType: "Role",
            entityId: role.id,
            newValues: { name, slug, description, permissionsCount: permissions.length },
            userId: auth.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            apiLogger.error({ err }, "Audit log failed for role creation");
        });

        apiLogger.info(
            { roleId: role.id, roleName: name, creatorUserId: auth.userId },
            "Custom role created",
        );

        return NextResponse.json(
            {
                success: true,
                role,
                message: `Role "${name}" created with ${permissions.length} permission(s).`,
            },
            { status: 201 },
        );
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_ROLE_ERROR");
        return NextResponse.json(
            { error: "Failed to create role" },
            { status: 500 },
        );
    }
}
