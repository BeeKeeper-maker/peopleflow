/**
 * PeopleFlow RBAC v2 — Effective Permission Resolution
 *
 * This module provides the canonical permission-checking logic for the
 * entire application. All API routes should use `requirePermission()`
 * instead of the legacy `requireAdminOrHR()` / `requireManagerOrAbove()`.
 *
 * Resolution order (most specific to least specific):
 *   1. Time-bounded RBACPermission (delegations) — checked first
 *      (e.g., "acting manager while real manager is on leave")
 *   2. UserRoleAssignment → Role → RolePermission (the new v2 system)
 *   3. Legacy User.role string (backward compat — super_admin gets "*")
 *   4. Deny
 *
 * Special cases:
 *   - super_admin role: always granted (wildcard "*")
 *   - System roles (isSystem=true): permissions are the seeded defaults
 *   - Custom roles (isSystem=false): permissions are admin-defined
 *
 * Caching:
 *   Effective permissions are cached in the user's JWT (session.user.permissions)
 *   and refreshed when sessionVersion changes. This avoids a DB query on
 *   every API call. The cache is invalidated on:
 *     - Role assignment change
 *     - Role permission change
 *     - Delegation grant/revoke
 *   (All of these increment the user's sessionVersion.)
 */

import { prisma } from "@/lib/prisma";
import { type AuthContext, type UserRole } from "./api-auth";
import { NextResponse } from "next/server";
import { authLogger } from "./logger";

// ── Types ────────────────────────────────────────────────────────────

export type PermissionScope = "global" | "department" | "branch" | "self" | "team";

export interface EffectivePermission {
    key: string;
    scope: PermissionScope;
    departmentIds?: string[];
    branchIds?: string[];
}

export interface PermissionCheckOptions {
    /** Required for scope=department: the department ID of the resource being accessed */
    departmentId?: string;
    /** Required for scope=branch: the branch ID of the resource being accessed */
    branchId?: string;
    /** Required for scope=self: the user ID who owns the resource (usually auth.userId) */
    ownerId?: string;
    /** Required for scope=team: the reporting manager's employee ID (usually auth.employeeId) */
    managerId?: string;
}

// ── Cache ────────────────────────────────────────────────────────────

// In-process cache (per Node.js worker). Keyed by userId.
// TTL: 30 seconds. Invalidated on sessionVersion change (checked by caller).
// In production with multiple workers/containers, each worker has its own
// in-process cache. To prevent a stale cache on worker B after an
// invalidation event triggered on worker A, we ALSO write a Redis marker
// key `rbac:perms:${userId}` with the same TTL whenever we populate the
// local cache, and delete it in `invalidatePermissionCache`. On every
// local-cache read we re-check the Redis marker: if it is missing the
// local entry is treated as stale and discarded. When Redis is unavailable
// (e.g. in unit tests) we silently fall back to the local cache only.
interface CacheEntry {
    permissions: EffectivePermission[];
    expiresAt: number;
}
const permissionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000; // 30 seconds — P17-BUGS-10 (was 60s)
const CACHE_TTL_SECONDS = Math.ceil(CACHE_TTL_MS / 1000);

/**
 * Redis marker key used for cross-node cache invalidation.
 * Format: `rbac:perms:${userId}` — set on cache populate, deleted on
 * invalidation. Its absence (after a delete, or after natural expiry)
 * signals to other nodes that their local cache for this user is stale.
 */
function redisCacheKey(userId: string): string {
    return `rbac:perms:${userId}`;
}

async function getCached(userId: string): Promise<EffectivePermission[] | null> {
    const entry = permissionCache.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        permissionCache.delete(userId);
        return null;
    }

    // Cross-node invalidation: if Redis is reachable but the marker key is
    // missing, the cache was invalidated on another node. Treat local
    // entry as stale. When Redis is disabled (tests), skip this check and
    // trust the local cache.
    const { isRedisDisabledForRuntime, cacheGet } = await import("./redis");
    if (!isRedisDisabledForRuntime()) {
        const marker = await cacheGet<boolean>(redisCacheKey(userId));
        if (marker === null) {
            permissionCache.delete(userId);
            return null;
        }
    }

    return entry.permissions;
}

async function setCached(userId: string, permissions: EffectivePermission[]): Promise<void> {
    permissionCache.set(userId, {
        permissions,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });

    // Mirror the cache state into Redis so other nodes can detect
    // invalidation. Best-effort — failures here are logged in redis.ts
    // and don't affect the local cache write above.
    const { isRedisDisabledForRuntime, cacheSet } = await import("./redis");
    if (!isRedisDisabledForRuntime()) {
        await cacheSet(redisCacheKey(userId), true, CACHE_TTL_SECONDS);
    }
}

/**
 * Invalidate the cached permissions for a user.
 * Call this whenever a user's role assignment or delegation changes.
 *
 * P17-BUGS-10: Also deletes the Redis marker key so that other worker
 * nodes/containers detect the invalidation on their next read instead of
 * serving stale permissions until their local TTL expires.
 */
export async function invalidatePermissionCache(userId: string): Promise<void> {
    permissionCache.delete(userId);

    const { isRedisDisabledForRuntime, cacheDel } = await import("./redis");
    if (!isRedisDisabledForRuntime()) {
        await cacheDel(redisCacheKey(userId));
    }
}

// ── Core Resolution ──────────────────────────────────────────────────

/**
 * Compute the effective permission set for a user.
 *
 * Combines:
 *   - Permissions from all assigned roles (UserRoleAssignment → Role → RolePermission)
 *   - Time-bounded delegations (RBACPermission with validFrom/validUntil)
 *
 * For super_admin role, returns [{ key: "*", scope: "global" }] immediately.
 *
 * @param userId  The user whose permissions to compute
 * @param organizationId  The org scope (for tenant isolation)
 */
export async function computeEffectivePermissions(
    userId: string,
    organizationId: string,
): Promise<EffectivePermission[]> {
    // Check cache first
    const cached = await getCached(userId);
    if (cached) return cached;

    // Load user to check role (super_admin shortcut)
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });

    if (!user) {
        await setCached(userId, []);
        return [];
    }

    // super_admin gets wildcard
    if (user.role === "super_admin") {
        const wildcard: EffectivePermission[] = [{ key: "*", scope: "global" }];
        await setCached(userId, wildcard);
        return wildcard;
    }

    // Load role assignments (v2) — includes role + rolePermissions
    const assignments = await prisma.userRoleAssignment.findMany({
        where: {
            userId,
            organizationId,
            OR: [
                { expiresAt: null },
                { expiresAt: { gte: new Date() } },
            ],
        },
        include: {
            role: {
                include: {
                    rolePermissions: {
                        include: {
                            permission: { select: { key: true } },
                        },
                    },
                },
            },
        },
    });

    const permissions: EffectivePermission[] = [];

    // From role assignments
    for (const assignment of assignments) {
        for (const rp of assignment.role.rolePermissions) {
            permissions.push({
                key: rp.permission.key,
                scope: rp.scope as PermissionScope,
                departmentIds: rp.departmentIds as string[] | undefined,
                branchIds: rp.branchIds as string[] | undefined,
            });
        }
    }

    // From time-bounded delegations (RBACPermission — legacy table, still used)
    const delegations = await prisma.rBACPermission.findMany({
        where: {
            userId,
            organizationId,
            isActive: true,
            validFrom: { lte: new Date() },
            OR: [
                { validUntil: null },
                { validUntil: { gte: new Date() } },
            ],
        },
        select: {
            permission: true,
            scope: true,
            departmentIds: true,
            branchIds: true,
        },
    });

    for (const d of delegations) {
        permissions.push({
            key: d.permission,
            scope: d.scope as PermissionScope,
            departmentIds: d.departmentIds as string[] | undefined,
            branchIds: d.branchIds as string[] | undefined,
        });
    }

    // Fallback: if no v2 assignments exist (legacy user not yet migrated),
    // derive permissions from the legacy User.role string using the static
    // ROLE_PERMISSIONS map. This ensures backward compat during migration.
    if (assignments.length === 0 && delegations.length === 0) {
        const legacyPerms = getLegacyRolePermissions(user.role as UserRole);
        for (const key of legacyPerms) {
            // Determine scope from the permission key suffix
            let scope: PermissionScope = "global";
            if (key.endsWith(":self")) scope = "self";
            else if (key.endsWith(":team")) scope = "team";

            permissions.push({ key, scope });
        }
    }

    await setCached(userId, permissions);
    return permissions;
}

// ── Legacy fallback (for users not yet migrated to v2) ───────────────

import { ROLE_PERMISSIONS, type Permission } from "./permissions";

function getLegacyRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
}

// ── Permission Check ─────────────────────────────────────────────────

/**
 * Check if a user has a specific permission, respecting scope.
 *
 * @param userId  The user to check
 * @param organizationId  The org scope
 * @param requiredPermission  e.g., "payroll:process", "leave:approve"
 * @param options  Scope-specific context (departmentId, branchId, ownerId, managerId)
 * @returns true if the user has the permission (with matching scope)
 */
export async function hasEffectivePermission(
    userId: string,
    organizationId: string,
    requiredPermission: string,
    options?: PermissionCheckOptions,
): Promise<boolean> {
    const permissions = await computeEffectivePermissions(userId, organizationId);

    for (const perm of permissions) {
        // Wildcard match
        if (perm.key === "*") return true;

        // Exact key match
        if (perm.key !== requiredPermission) continue;

        // Scope check
        switch (perm.scope) {
            case "global":
                return true;
            case "self":
                // Caller must verify ownership separately (resource-specific).
                // If no ownerId provided, assume the caller has already verified
                // or the resource is the user's own (e.g., /api/employees/me).
                if (!options?.ownerId || options.ownerId === userId) return true;
                continue;
            case "team":
                // Caller must verify the resource owner is a direct reportee.
                // managerId should be the authed user's employeeId.
                if (!options?.managerId) {
                    // No manager context — can't verify team scope. Deny.
                    continue;
                }
                // The actual reportee check is resource-specific and done by the caller.
                // Here we just confirm the user HAS a team-scoped permission.
                return true;
            case "department":
                if (!options?.departmentId) continue;
                // P17-BUGS-12: Distinguish undefined (all departments) from
                // an explicit empty array (no departments — deny).
                //   undefined / null → global scope (all departments)
                //   []               → scoped, no match (deny)
                //   [id1, id2]       → scoped to listed departments
                if (perm.departmentIds === undefined || perm.departmentIds === null) {
                    return true; // all departments
                }
                if (perm.departmentIds.length === 0) {
                    continue; // explicitly no departments — deny this permission
                }
                if (perm.departmentIds.includes(options.departmentId)) return true;
                continue;
            case "branch":
                if (!options?.branchId) continue;
                // P17-BUGS-12: same undefined-vs-empty distinction as above.
                if (perm.branchIds === undefined || perm.branchIds === null) {
                    return true; // all branches
                }
                if (perm.branchIds.length === 0) {
                    continue; // explicitly no branches — deny this permission
                }
                if (perm.branchIds.includes(options.branchId)) return true;
                continue;
        }
    }

    return false;
}

// ── API Route Helper ─────────────────────────────────────────────────

/**
 * Require a specific permission for an API route.
 *
 * Usage:
 *   export async function GET(req: Request) {
 *     const auth = await requirePermission("payroll:view");
 *     if (auth instanceof NextResponse) return auth;
 *     // auth is now AuthContext with guaranteed permission
 *     ...
 *   }
 *
 * @param permission  The permission key to require (e.g., "payroll:process")
 * @param options  Scope-specific context (for team/department/branch checks)
 * @returns AuthContext if allowed, NextResponse (403) if denied
 */
export async function requirePermission(
    permission: string,
    options?: PermissionCheckOptions,
): Promise<AuthContext | NextResponse> {
    // First, require authentication (reuses existing logic)
    const { requireAuth, isAuthenticated } = await import("./api-auth");
    const authResult = await requireAuth();
    if (!isAuthenticated(authResult)) return authResult as NextResponse;
    const ctx = authResult as AuthContext;

    // Check permission
    const allowed = await hasEffectivePermission(
        ctx.userId,
        ctx.organizationId,
        permission,
        {
            ownerId: ctx.userId,
            managerId: ctx.employeeId,
            ...options,
        },
    );

    if (!allowed) {
        authLogger.warn(
            {
                userId: ctx.userId,
                role: ctx.role,
                permission,
                organizationId: ctx.organizationId,
            },
            "Permission denied",
        );
        return NextResponse.json(
            {
                error: "You do not have permission to perform this action.",
                code: "PERMISSION_DENIED",
                requiredPermission: permission,
            },
            { status: 403 },
        );
    }

    return ctx;
}

/**
 * Check if a user has a permission WITHOUT returning a response.
 * Useful for conditional logic inside a route handler.
 */
export async function checkPermission(
    ctx: AuthContext,
    permission: string,
    options?: PermissionCheckOptions,
): Promise<boolean> {
    return hasEffectivePermission(
        ctx.userId,
        ctx.organizationId,
        permission,
        {
            ownerId: ctx.userId,
            managerId: ctx.employeeId,
            ...options,
        },
    );
}

// ── Backfill Helper ──────────────────────────────────────────────────

/**
 * Backfill UserRoleAssignment for a user based on their legacy User.role.
 *
 * Called by the seed script for existing users, and by the registration
 * flow for new users. Ensures every user has a v2 assignment mirroring
 * their User.role string.
 */
export async function backfillUserRoleAssignment(
    userId: string,
    organizationId: string,
    roleSlug: string,
    assignedBy?: string,
): Promise<void> {
    // Find the system role with this slug
    const role = await prisma.role.findFirst({
        where: {
            slug: roleSlug,
            OR: [
                { organizationId: null }, // system role
                { organizationId }, // tenant custom role (unlikely for backfill)
            ],
        },
    });

    if (!role) {
        authLogger.warn(
            { userId, roleSlug, organizationId },
            "Backfill: role not found, skipping assignment",
        );
        return;
    }

    // Upsert assignment (unique on userId+roleId)
    await prisma.userRoleAssignment.upsert({
        where: {
            userId_roleId: { userId, roleId: role.id },
        },
        create: {
            userId,
            roleId: role.id,
            organizationId,
            assignedBy,
        },
        update: {
            // Already exists — no-op
        },
    });
}

/**
 * Get a list of all permissions available in the system (the catalog).
 * Used by the Role Editor UI to show the permission matrix.
 */
export async function getPermissionCatalog() {
    return prisma.permission.findMany({
        orderBy: [{ module: "asc" }, { action: "asc" }],
    });
}

/**
 * Get all roles for an organization (system + custom).
 */
export async function getOrgRoles(organizationId: string) {
    return prisma.role.findMany({
        where: {
            OR: [
                { organizationId: null }, // system roles
                { organizationId }, // tenant custom roles
            ],
        },
        include: {
            _count: {
                select: { userAssignments: true },
            },
            rolePermissions: {
                include: {
                    permission: true,
                },
            },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
}
