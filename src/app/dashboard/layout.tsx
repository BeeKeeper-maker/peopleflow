// Force dynamic rendering for all dashboard pages
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { ProtectedAppProviders } from "@/components/providers/protected-app-providers";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <ProtectedAppProviders>{children}</ProtectedAppProviders>;
}
