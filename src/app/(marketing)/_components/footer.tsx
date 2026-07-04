"use client";

import Link from "next/link";
import { Mail, Phone, MapPin, Globe } from "lucide-react";
import { P } from "./shared";
import Logo from "./logo";

// ═══════════════════════════════════════════════════════════════
// FOOTER — Enterprise Authority
// 5-column layout: Brand + 4 link groups + BD office + legal
// ═══════════════════════════════════════════════════════════════

const columns = [
    {
        title: "Product",
        links: [
            { label: "Features", href: "#features" },
            { label: "Compliance", href: "#compliance" },
            { label: "Pricing", href: "#pricing" },
            { label: "ROI Calculator", href: "#roi" },
            { label: "Compare", href: "#compare" },
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
            { label: "API Reference", href: "/api/v1/docs" },
            { label: "BLA 2006 Guide", href: "#" },
            { label: "Blog", href: "#" },
            { label: "System Status", href: "/api/health" },
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
        <footer
            className="relative"
            style={{
                background: P.bgDeep,
                borderTop: `1px solid ${P.border}`,
            }}
        >
            {/* Top gradient accent */}
            <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                    background: `linear-gradient(to right, transparent, ${P.borderActive}, transparent)`,
                }}
            />

            <div className="max-w-6xl mx-auto px-6 py-16">
                {/* Top section */}
                <div className="grid lg:grid-cols-6 gap-10 mb-14">
                    {/* Brand column */}
                    <div className="lg:col-span-2">
                        <div className="mb-5">
                            <Logo size="md" />
                        </div>
                        <p className="text-[13px] leading-relaxed mb-6 max-w-xs" style={{ color: P.muted }}>
                            Enterprise HR platform engineered for Bangladesh.
                            Payroll, attendance, leave, and compliance — automated.
                        </p>

                        {/* BD office */}
                        <div className="space-y-2.5 mb-6">
                            <div className="flex items-start gap-2 text-[12px]" style={{ color: P.body }}>
                                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: P.blueBright }} />
                                <span>
                                    Level 8, Gulshan Avenue
                                    <br />
                                    Dhaka 1212, Bangladesh
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-[12px]" style={{ color: P.body }}>
                                <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: P.blueBright }} />
                                <span className="font-mono">+880 1700 000000</span>
                            </div>
                            <div className="flex items-center gap-2 text-[12px]" style={{ color: P.body }}>
                                <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: P.blueBright }} />
                                <span>hello@peopleflow.com.bd</span>
                            </div>
                        </div>

                        {/* Beta status */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className="relative">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            </div>
                            <span className="text-[11px] font-medium" style={{ color: P.emerald }}>
                                Beta environment ready
                            </span>
                        </div>

                        {/* Language */}
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: P.subtle }}>
                            <Globe className="w-3 h-3" />
                            <span>English · বাংলা</span>
                        </div>
                    </div>

                    {/* Link columns */}
                    {columns.map((col) => (
                        <div key={col.title}>
                            <h4
                                className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-4"
                                style={{ color: P.muted }}
                            >
                                {col.title}
                            </h4>
                            <ul className="space-y-2.5">
                                {col.links.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-[13px] transition-colors duration-200 no-underline"
                                            style={{ color: P.body }}
                                            onMouseEnter={(e) => { e.currentTarget.style.color = P.heading; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.color = P.body; }}
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Compliance badges row */}
                <div
                    className="flex flex-wrap items-center justify-center gap-3 mb-8 py-5"
                    style={{
                        borderTop: `1px solid ${P.border}`,
                        borderBottom: `1px solid ${P.border}`,
                    }}
                >
                    {["BLA 2006 Ready", "NID Integrated", "BD Data Residency", "bKash Partner", "ISO 27001 (in progress)"].map((badge) => (
                        <span
                            key={badge}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-md"
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: `1px solid ${P.border}`,
                                color: P.muted,
                            }}
                        >
                            {badge}
                        </span>
                    ))}
                </div>

                {/* Bottom bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[11px]" style={{ color: P.ghost }}>
                        © 2026 PeopleFlow. Architected by Sharif Mohammad Nasrullah. All rights reserved.
                    </p>
                    <div className="flex items-center gap-5">
                        {[
                            { label: "Privacy", href: "/legal/privacy" },
                            { label: "Terms", href: "/legal/terms" },
                            { label: "Cookies", href: "/legal/cookies" },
                        ].map((item) => (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="text-[11px] transition-colors duration-200 no-underline"
                                style={{ color: P.ghost }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = P.body; }}
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
