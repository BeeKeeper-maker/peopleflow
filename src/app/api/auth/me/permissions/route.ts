import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { computeEffectivePermissions } from "@/lib/rbac-v2";

/**
 * GET /api/auth/me/permissions — Get the current user's effective permissions
 *
 * Returns the full set of permissions the authenticated user has, combining:
 *   - Role-based permissions (from UserRoleAssignment → Role → RolePermission)
 *   - Time-bounded delegations (RBACPermission)
 *   - Legacy role fallback (for users not yet migrated to v2)
 *
 * Used by:
 *   - The usePermissions() React hook (client-side permission checks)
 *   - The sidebar to filter nav items by permission
 *   - The Role Editor "preview as this user" feature
 *
 * Authorization: any authenticated user (they can always see their own perms)
 */
export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    const permissions = await computeEffectivePermissions(
        auth.userId,
        auth.organizationId,
    );

    return NextResponse.json({
        data: permissions,
        total: permissions.length,
        // Convenience: a Set of permission keys for O(1) lookup
        keys: permissions.map((p) => p.key),
    });
}
