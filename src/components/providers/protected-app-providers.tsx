"use client";

import { AuthProvider } from "./auth-provider";
import { QueryProvider } from "./query-provider";
import { PWARegister } from "@/components/pwa/register";

/**
 * Providers needed only inside authenticated app shells.
 * Keeping them out of public marketing/auth pages reduces public-page JS,
 * avoids unnecessary /api/auth/session work, and lowers hydration pressure.
 */
export function ProtectedAppProviders({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <QueryProvider>
                <PWARegister />
                {children}
            </QueryProvider>
        </AuthProvider>
    );
}
