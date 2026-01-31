"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import {
    hasPermission,
    canAccessRoute,
    getDefaultRoute,
    isHRLevel,
    isManagerLevel,
    type UserRole,
    type Permission,
} from "@/lib/permissions";

/**
 * Hook for checking user permissions
 * 
 * @example
 * const { can, role, isHR, isManager } = usePermissions();
 * 
 * if (can("employee:create")) {
 *   // Show create button
 * }
 */
export function usePermissions() {
    const { data: session, status } = useSession();

    const role = session?.user?.role as UserRole | undefined;

    const permissions = useMemo(() => ({
        /**
         * Check if user has a specific permission
         */
        can: (permission: Permission): boolean => {
            return hasPermission(role, permission);
        },

        /**
         * Check if user can access a route
         */
        canAccess: (path: string): boolean => {
            return canAccessRoute(role, path);
        },

        /**
         * Current user role
         */
        role,

        /**
         * Is user HR/Admin level
         */
        isHR: isHRLevel(role),

        /**
         * Is user Manager level or above
         */
        isManager: isManagerLevel(role),

        /**
         * Is user a regular employee (not manager/HR)
         */
        isEmployee: role === "employee",

        /**
         * Is user super admin
         */
        isSuperAdmin: role === "super_admin",

        /**
         * Get default route for current role
         */
        defaultRoute: getDefaultRoute(role),

        /**
         * Is session loading
         */
        isLoading: status === "loading",

        /**
         * Is user authenticated
         */
        isAuthenticated: status === "authenticated",
    }), [role, status]);

    return permissions;
}

/**
 * Hook to protect a page/component based on permission
 * Redirects to appropriate page if user doesn't have permission
 * 
 * @example
 * useRequirePermission("employee:create", "/unauthorized");
 */
export function useRequirePermission(
    permission: Permission,
    redirectTo?: string
) {
    const router = useRouter();
    const { can, isLoading, isAuthenticated, defaultRoute } = usePermissions();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        if (!can(permission)) {
            router.push(redirectTo || defaultRoute);
        }
    }, [can, permission, isLoading, isAuthenticated, router, redirectTo, defaultRoute]);

    return {
        hasPermission: can(permission),
        isLoading,
    };
}

/**
 * Hook to protect routes based on role
 * Redirects employees to ESS, managers to manager portal
 * 
 * @example
 * useRequireHRAccess(); // Only HR/Admin can access
 */
export function useRequireHRAccess() {
    const router = useRouter();
    const { isHR, isLoading, isAuthenticated, defaultRoute } = usePermissions();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        if (!isHR) {
            router.push(defaultRoute);
        }
    }, [isHR, isLoading, isAuthenticated, router, defaultRoute]);

    return { isHR, isLoading };
}

/**
 * Hook to require manager level access
 */
export function useRequireManagerAccess() {
    const router = useRouter();
    const { isManager, isLoading, isAuthenticated, defaultRoute } = usePermissions();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            router.push("/login");
            return;
        }

        if (!isManager) {
            router.push(defaultRoute);
        }
    }, [isManager, isLoading, isAuthenticated, router, defaultRoute]);

    return { isManager, isLoading };
}

// Re-export types for convenience
export type { UserRole, Permission };
