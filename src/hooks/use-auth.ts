"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Hook to get current session with loading state
 */
export function useAuth() {
    const { data: session, status } = useSession();
    const isLoading = status === "loading";
    const isAuthenticated = status === "authenticated";

    return {
        user: session?.user,
        isLoading,
        isAuthenticated,
        session,
    };
}

/**
 * Hook to require authentication - redirects to login if not authenticated
 */
export function useRequireAuth(redirectTo = "/login") {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push(redirectTo);
        }
    }, [isAuthenticated, isLoading, router, redirectTo]);

    return { isLoading, isAuthenticated };
}

/**
 * Hook to require specific role(s)
 */
export function useRequireRole(allowedRoles: string[], redirectTo = "/unauthorized") {
    const { user, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && isAuthenticated && user) {
            if (!allowedRoles.includes(user.role)) {
                router.push(redirectTo);
            }
        }
    }, [user, isLoading, isAuthenticated, allowedRoles, router, redirectTo]);

    return { isLoading, isAuthenticated, hasRole: user ? allowedRoles.includes(user.role) : false };
}

/**
 * Hook to handle logout
 */
export function useLogout() {
    const router = useRouter();

    const logout = async () => {
        await signOut({ redirect: false });
        router.push("/login");
    };

    return { logout };
}
