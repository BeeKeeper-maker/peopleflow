"use client";

import { DashboardLayout } from "@/components/layout";
import { ProtectedAppProviders } from "@/components/providers/protected-app-providers";

export default function DashboardGroupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProtectedAppProviders>
            <DashboardLayout>{children}</DashboardLayout>
        </ProtectedAppProviders>
    );
}
