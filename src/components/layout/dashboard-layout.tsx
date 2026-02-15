"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { SkipLink } from "@/components/ui/skip-link";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Close sidebar on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isSidebarOpen) {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSidebarOpen]);

    // Prevent body scroll when sidebar is open on mobile
    useEffect(() => {
        if (isSidebarOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isSidebarOpen]);

    return (
        <div className="min-h-screen bg-background transition-colors duration-300">
            {/* Skip to Content - Accessibility */}
            <SkipLink href="#main-content">Skip to main content</SkipLink>

            {/* Sidebar - Hidden on mobile, visible on desktop */}
            <div
                className={cn(
                    "fixed inset-y-0 left-0 z-50 lg:z-40",
                    "transform transition-transform duration-300 ease-in-out",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
                role="navigation"
                aria-label="Main navigation"
            >
                <Sidebar />
            </div>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Main Content */}
            <div className="lg:pl-64">
                <Header
                    onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    isSidebarOpen={isSidebarOpen}
                />
                <main
                    id="main-content"
                    className="p-4 sm:p-6"
                    role="main"
                    tabIndex={-1}
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
