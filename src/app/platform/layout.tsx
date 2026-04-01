"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PlatformSidebar } from "@/components/platform/sidebar";
import { PlatformHeader } from "@/components/platform/header";

interface AdminProfile {
    id: string;
    name: string;
    email: string;
    role: string;
}

export default function PlatformLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [admin, setAdmin] = useState<AdminProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Skip auth check on login page
    const isLoginPage = pathname === "/platform/login";

    useEffect(() => {
        if (isLoginPage) {
            setLoading(false);
            return;
        }

        fetch("/api/platform/auth", { credentials: "include" })
            .then((r) => {
                if (!r.ok) throw new Error("Unauthorized");
                return r.json();
            })
            .then((data) => {
                setAdmin(data.admin);
                setLoading(false);
            })
            .catch(() => {
                router.push("/platform/login");
            });
    }, [isLoginPage, router]);

    // Login page renders without shell
    if (isLoginPage) {
        return (
            <div className="platform-theme min-h-screen bg-[#08080F]">
                {children}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="platform-theme min-h-screen bg-[#08080F] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-sm text-zinc-500">Loading Mission Control...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="platform-theme min-h-screen bg-[#08080F] text-white flex">
            <PlatformSidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? "ml-[72px]" : "ml-[260px]"}`}>
                <PlatformHeader admin={admin} />
                <main className="flex-1 p-6 overflow-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
