/**
 * PeopleFlow HRMS - Role-Based Access Control (RBAC)
 * 
 * This module defines the permission system for the application.
 * It provides utilities for checking if a user can perform specific actions.
 */

// User roles in the system
export type UserRole =
    | "super_admin"  // Full system access
    | "admin"        // Organization admin
    | "hr_admin"     // HR operations
    | "manager"      // Team management
    | "employee";    // Self-service only

// Permission action types
export type Permission =
    // Employee permissions
    | "employee:view"
    | "employee:create"
    | "employee:update"
    | "employee:delete"
    | "employee:view:self"
    | "employee:update:self"
    | "employee:view:team"
    // Leave permissions
    | "leave:view"
    | "leave:apply"
    | "leave:approve"
    | "leave:apply:self"
    | "leave:view:self"
    | "leave:approve:team"
    // Attendance permissions
    | "attendance:view"
    | "attendance:mark"
    | "attendance:mark:self"
    | "attendance:view:self"
    | "attendance:view:team"
    // Payroll permissions
    | "payroll:view"
    | "payroll:process"
    | "payroll:approve"
    | "payslip:view:self"
    // Recruitment permissions
    | "recruitment:view"
    | "recruitment:manage"
    // Performance permissions
    | "performance:view"
    | "performance:manage"
    | "performance:view:self"
    | "performance:review:team"
    // Expense permissions
    | "expense:submit"
    | "expense:approve"
    | "expense:approve:team"
    | "expense:view:self"
    // Settings & Admin
    | "settings:view"
    | "settings:manage"
    | "reports:view"
    | "reports:export"
    // Wildcard
    | "*";

/**
 * Role-based permission mappings
 * Each role has a list of permissions they can perform
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
    super_admin: ["*"], // Full access to everything

    admin: [
        "employee:view", "employee:create", "employee:update", "employee:delete",
        "leave:view", "leave:approve",
        "attendance:view", "attendance:mark",
        "payroll:view", "payroll:process", "payroll:approve",
        "recruitment:view", "recruitment:manage",
        "performance:view", "performance:manage",
        "expense:approve",
        "settings:view", "settings:manage",
        "reports:view", "reports:export",
    ],

    hr_admin: [
        "employee:view", "employee:create", "employee:update",
        "leave:view", "leave:approve",
        "attendance:view", "attendance:mark",
        "payroll:view", "payroll:process",
        "recruitment:view", "recruitment:manage",
        "performance:view", "performance:manage",
        "reports:view", "reports:export",
    ],

    manager: [
        // Self permissions
        "employee:view:self", "employee:update:self",
        "leave:apply:self", "leave:view:self",
        "attendance:mark:self", "attendance:view:self",
        "payslip:view:self",
        "performance:view:self",
        "expense:submit", "expense:view:self",
        // Team permissions
        "employee:view:team",
        "leave:approve:team",
        "attendance:view:team",
        "performance:review:team",
        "expense:approve:team",
        "reports:view",
    ],

    employee: [
        // Only self-service permissions
        "employee:view:self", "employee:update:self",
        "leave:apply:self", "leave:view:self",
        "attendance:mark:self", "attendance:view:self",
        "payslip:view:self",
        "performance:view:self",
        "expense:submit", "expense:view:self",
    ],
};

/**
 * Route access control - which roles can access which route groups
 */
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
    // Admin/HR routes (dashboard, employees, payroll, etc.)
    "/dashboard": ["super_admin", "admin", "hr_admin"],
    "/employees": ["super_admin", "admin", "hr_admin"],
    "/departments": ["super_admin", "admin", "hr_admin"],
    "/designations": ["super_admin", "admin", "hr_admin"],
    "/leaves": ["super_admin", "admin", "hr_admin"],
    "/attendance": ["super_admin", "admin", "hr_admin"],
    "/payroll": ["super_admin", "admin", "hr_admin"],
    "/recruitment": ["super_admin", "admin", "hr_admin"],
    "/performance": ["super_admin", "admin", "hr_admin"],
    "/reports": ["super_admin", "admin", "hr_admin"],
    "/settings": ["super_admin", "admin"],

    // Manager routes
    "/manager": ["super_admin", "admin", "hr_admin", "manager"],

    // Employee Self-Service routes (all authenticated users)
    "/ess": ["super_admin", "admin", "hr_admin", "manager", "employee"],
};

/**
 * Default redirect path based on user role
 */
export const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
    super_admin: "/dashboard",
    admin: "/dashboard",
    hr_admin: "/dashboard",
    manager: "/manager/dashboard",
    employee: "/ess/dashboard",
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
    if (!role) return false;

    const permissions = ROLE_PERMISSIONS[role];

    // Check for wildcard (super_admin)
    if (permissions.includes("*")) return true;

    // Check for exact permission
    if (permissions.includes(permission)) return true;

    // Check for parent permission (e.g., employee:view includes employee:view:self)
    const parts = permission.split(":");
    if (parts.length === 3) {
        const parentPermission = `${parts[0]}:${parts[1]}` as Permission;
        if (permissions.includes(parentPermission)) return true;
    }

    return false;
}

/**
 * Check if a role can access a specific route
 */
export function canAccessRoute(role: UserRole | undefined, path: string): boolean {
    if (!role) return false;

    // Super admin can access everything
    if (role === "super_admin") return true;

    // Find matching route pattern
    for (const [routePattern, allowedRoles] of Object.entries(ROUTE_ACCESS)) {
        if (path.startsWith(routePattern)) {
            return allowedRoles.includes(role);
        }
    }

    // Default: allow access (for public routes)
    return true;
}

/**
 * Get the default redirect path for a role
 */
export function getDefaultRoute(role: UserRole | undefined): string {
    if (!role) return "/login";
    return ROLE_DEFAULT_ROUTES[role] || "/ess/dashboard";
}

/**
 * Check if user is HR/Admin level
 */
export function isHRLevel(role: UserRole | undefined): boolean {
    if (!role) return false;
    return ["super_admin", "admin", "hr_admin"].includes(role);
}

/**
 * Check if user is Manager level or above
 */
export function isManagerLevel(role: UserRole | undefined): boolean {
    if (!role) return false;
    return ["super_admin", "admin", "hr_admin", "manager"].includes(role);
}
