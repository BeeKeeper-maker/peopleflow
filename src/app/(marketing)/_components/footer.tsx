"use client";

import Link from "next/link";
import { P } from "./shared";
import Logo from "./logo";

// ═══════════════════════════════════════════════════════════════
// ENTERPRISE FOOTER — Authority + Legal Links
// ═══════════════════════════════════════════════════════════════

const columns = [
    {
        title: "Product",
        links: [
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
            { label: "Compliance", href: "#compliance" },
            { label: "Security", href: "#" },
            { label: "Changelog", href: "#" },
        ],
    },
    {
        title: "Solutions",
        links: [
            { label: "RMG & Garments", href: "#" },
            { label: "Corporate", href: "#" },
            { label: "NGO & Development", href: "#" },
            { label: "Group of Companies", href: "#" },
            { label: "Government", href: "#" },
        ],
    },
    {
        title: "Resources",
        links: [
            { label: "Documentation", href: "#" },
            { label: "API Reference", href: "#" },
            { label: "BLA 2006 Guide", href: "#" },
            { label: "Blog", href: "#" },
            { label: "System Status", href: "#" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "About Us", href: "#" },
            { label: "Careers", href: "#" },
            { label: "Contact Sales", href: "#" },
            { label: "Partners", href: "#" },
            { label: "Legal", href: "/legal/privacy" },
        ],
    },
];

export default function FooterEnterprise() {
    return (
        <footer style={{ background: "#050508", borderTop: `1px solid ${P.border}` }}>
            <div className="max-w-7xl mx-auto px-6 py-16">
                {/* Top section */}
                <div className="grid lg:grid-cols-6 gap-12 mb-16">
                    {/* Brand column */}
                    <div className="lg:col-span-2">
                        <div className="mb-5">
                            <Logo size="md" />
                        </div>
                        <p className="text-sm leading-relaxed mb-6 max-w-xs" style={{ color: P.muted }}>
                            Bangladesh{"'"}s most trusted enterprise HRMS. Built for BLA 2006 compliance,
                            designed for the modern workforce.
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            </div>
                            <span className="text-xs font-medium" style={{ color: P.emerald }}>
                                All systems operational
                            </span>
                        </div>
                    </div>

                    {/* Link columns */}
                    {columns.map((col) => (
                        <div key={col.title}>
                            <h4 className="text-sm font-semibold text-white mb-4 tracking-tight">{col.title}</h4>
                            <ul className="space-y-2.5">
                                {col.links.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-sm transition-colors duration-200 no-underline"
                                            style={{ color: P.subtle }}
                                            onMouseEnter={(e) => { e.currentTarget.style.color = "white"; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.color = P.subtle; }}
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Divider */}
                <div
                    className="h-px mb-8"
                    style={{ background: `linear-gradient(to right, transparent, ${P.border}, transparent)` }}
                />

                {/* Bottom bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs" style={{ color: P.ghost }}>
                        © 2026 PeopleFlow. Architected by Sharif Mohammad Nasrullah. All rights reserved.
                    </p>
                    <div className="flex items-center gap-6">
                        {[
                            { label: "Privacy Policy", href: "/legal/privacy" },
                            { label: "Terms of Service", href: "/legal/terms" },
                            { label: "Cookie Policy", href: "/legal/cookies" },
                        ].map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="text-xs transition-colors duration-200 no-underline"
                                style={{ color: P.ghost }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = P.subtle; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = P.ghost; }}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
