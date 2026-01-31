"use client";

import { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePermissions, type Permission, type UserRole } from "@/hooks/use-permissions";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
    children: ReactNode;
    /**
     * Required permission to access this route
     */
    permission?: Permission;
    /**
     * Required roles to access this route
     */
    roles?: UserRole[];
    /**
     * Require HR level access (super_admin, admin, hr_admin)
     */
    requireHR?: boolean;
    /**
     * Require Manager level access
     */
    requireManager?: boolean;
    /**
     * Custom redirect path if unauthorized
     */
    redirectTo?: string;
    /**
     * Show loading spinner while checking auth
     */
    showLoading?: boolean;
    /**
     * Custom loading component
     */
    loadingComponent?: ReactNode;
    /**
     * Custom unauthorized component (instead of redirect)
     */
    fallback?: ReactNode;
}

/**
 * ProtectedRoute Component
 * 
 * Wraps a page/component and enforces permission/role requirements.
 * Redirects unauthorized users to their default route or login.
 * 
 * @example
 * // Require HR access
 * <ProtectedRoute requireHR>
 *   <EmployeeList />
 * </ProtectedRoute>
 * 
 * @example
 * // Require specific permission
 * <ProtectedRoute permission="payroll:process">
 *   <PayrollPage />
 * </ProtectedRoute>
 * 
 * @example
 * // Require specific roles
 * <ProtectedRoute roles={["super_admin", "admin"]}>
 *   <SettingsPage />
 * </ProtectedRoute>
 */
export function ProtectedRoute({
    children,
    permission,
    roles,
    requireHR,
    requireManager,
    redirectTo,
    showLoading = true,
    loadingComponent,
    fallback,
}: ProtectedRouteProps) {
    const router = useRouter();
    const {
        can,
        role,
        isHR,
        isManager,
        isLoading,
        isAuthenticated,
        defaultRoute,
    } = usePermissions();

    // Check if user meets requirements
    const hasAccess = (() => {
        // Still loading
        if (isLoading) return null;

        // Not authenticated
        if (!isAuthenticated) return false;

        // Check HR requirement
        if (requireHR && !isHR) return false;

        // Check Manager requirement
        if (requireManager && !isManager) return false;

        // Check specific permission
        if (permission && !can(permission)) return false;

        // Check specific roles
        if (roles && role && !roles.includes(role)) return false;

        return true;
    })();

    useEffect(() => {
        if (hasAccess === null) return; // Still loading

        if (hasAccess === false) {
            if (!isAuthenticated) {
                router.push("/login");
            } else {
                router.push(redirectTo || defaultRoute);
            }
        }
    }, [hasAccess, isAuthenticated, router, redirectTo, defaultRoute]);

    // Loading state
    if (isLoading || hasAccess === null) {
        if (loadingComponent) return <>{loadingComponent}</>;
        if (!showLoading) return null;

        return (
            <div className="flex h-screen items-center justify-center bg-[#0A0A0F]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                    <p className="text-sm text-white/60">Loading...</p>
                </div>
            </div>
        );
    }

    // Unauthorized - show fallback or redirect
    if (hasAccess === false) {
        if (fallback) return <>{fallback}</>;
        return null; // Will redirect via useEffect
    }

    // Authorized
    return <>{children}</>;
}

/**
 * Higher-order component version of ProtectedRoute
 */
export function withProtection<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    options: Omit<ProtectedRouteProps, "children">
) {
    return function ProtectedComponent(props: P) {
        return (
            <ProtectedRoute {...options}>
                <WrappedComponent {...props} />
            </ProtectedRoute>
        );
    };
}
