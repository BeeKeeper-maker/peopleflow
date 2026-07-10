import { NextResponse } from "next/server";
import { requirePermission, getPermissionCatalog } from "@/lib/rbac-v2";

/**
 * GET /api/rbac/permissions — List all available permissions (the catalog)
 *
 * Returns the full system-defined permission catalog, grouped by module.
 * Used by the Role Editor UI to show the permission matrix.
 *
 * Authorization: rbac:roles:view (anyone who can view roles can see the catalog)
 */
export async function GET() {
    const auth = await requirePermission("rbac:roles:view");
    if (auth instanceof NextResponse) return auth;

    const permissions = await getPermissionCatalog();

    // Group by module for easier UI rendering
    const byModule: Record<string, typeof permissions> = {};
    for (const perm of permissions) {
        if (!byModule[perm.module]) byModule[perm.module] = [];
        byModule[perm.module].push(perm);
    }

    return NextResponse.json({
        data: permissions,
        byModule,
        total: permissions.length,
    });
}
