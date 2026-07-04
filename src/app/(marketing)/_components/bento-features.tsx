"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users, Calendar, DollarSign, UserPlus, Target, ShieldCheck,
    Clock, FileText, Zap, TrendingUp, Bell, Smartphone, BarChart3,
    Fingerprint, CreditCard, Award, GitBranch, type LucideIcon,
} from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem, useInView, Eyebrow } from "./shared";

// ═══════════════════════════════════════════════════════════════
// FEATURES BENTO — Tabbed Feature Explorer
// Linear-style tabs with smooth underline + staggered bento grid
// ═══════════════════════════════════════════════════════════════

type Feature = {
    icon: LucideIcon;
    title: string;
    desc: string;
    color: string;
    span?: "wide" | "tall" | "normal";
};

type TabGroup = {
    id: string;
    label: string;
    features: Feature[];
};

const tabs: TabGroup[] = [
    {
        id: "core",
        label: "Core HR",
        features: [
            { icon: Users, title: "Employee Directory", desc: "Centralized records with custom fields, document vault, and org chart.", color: "#60A5FA", span: "wide" },
            { icon: GitBranch, title: "Department & Designations", desc: "Hierarchical structure with role-based access.", color: "#A78BFA" },
            { icon: FileText, title: "Document Vault", desc: "Secure NID, contracts, certificates with expiry alerts.", color: "#10B981" },
            { icon: Bell, title: "Smart Notifications", desc: "Push, email, in-app — configurable per event type.", color: "#F59E0B" },
            { icon: Smartphone, title: "Mobile-First ESS", desc: "Employees self-serve from any device, offline-capable.", color: "#F43F5E", span: "tall" },
        ],
    },
    {
        id: "attendance",
        label: "Attendance",
        features: [
            { icon: Fingerprint, title: "Biometric Sync", desc: "ZKTeco + ADMS direct cloud — no middleware.", color: "#60A5FA", span: "wide" },
            { icon: Clock, title: "Shift & Roster", desc: "RMG-friendly shift patterns with auto-rotation.", color: "#A78BFA" },
            { icon: Calendar, title: "Geo-Fencing", desc: "Branch-aware check-in with location validation.", color: "#10B981" },
            { icon: Zap, title: "Auto-Absent", desc: "Cron-driven absent marking for no-shows.", color: "#F59E0B" },
            { icon: BarChart3, title: "Real-time Dashboard", desc: "Live attendance %, late arrivals, OT hours.", color: "#F43F5E", span: "tall" },
        ],
    },
    {
        id: "payroll",
        label: "Payroll",
        features: [
            { icon: DollarSign, title: "Payroll Engine", desc: "Auto-calc gross, deductions, net — PF, tax, festival bonus.", color: "#10B981", span: "wide" },
            { icon: CreditCard, title: "bKash + Bank Disbursement", desc: "One-click digital disbursement via bKash, Nagad, EFT.", color: "#60A5FA" },
            { icon: FileText, title: "Payslip Lock & Reverse", desc: "Audit-friendly payslip lifecycle with rollback.", color: "#A78BFA" },
            { icon: Award, title: "PF Ledger", desc: "Provident fund tracking with employee portal.", color: "#F59E0B" },
            { icon: BarChart3, title: "Tax Certificate", desc: "Auto-generated BD tax certificates per employee.", color: "#F43F5E", span: "tall" },
        ],
    },
    {
        id: "recruitment",
        label: "Recruitment",
        features: [
            { icon: UserPlus, title: "Career Portal", desc: "Public job board at /careers/[org] — SEO friendly.", color: "#60A5FA", span: "wide" },
            { icon: Zap, title: "AI Resume Parser", desc: "Extract skills, experience, education from PDFs.", color: "#A78BFA" },
            { icon: GitBranch, title: "Pipeline Stages", desc: "Customizable kanban from applied → hired.", color: "#10B981" },
            { icon: Users, title: "Candidate Vault", desc: "Talent pool with tags, ratings, re-hire flags.", color: "#F59E0B" },
            { icon: FileText, title: "Offer Letters", desc: "Templated offers with e-signature workflow.", color: "#F43F5E", span: "tall" },
        ],
    },
    {
        id: "performance",
        label: "Performance",
        features: [
            { icon: Target, title: "OKR & Goals", desc: "Cascading goals with quarterly check-ins.", color: "#60A5FA", span: "wide" },
            { icon: Users, title: "360° Reviews", desc: "Self + manager + peer reviews with calibration.", color: "#A78BFA" },
            { icon: TrendingUp, title: "Review Cycles", desc: "Annual, semi-annual, probation — fully configurable.", color: "#10B981" },
            { icon: Award, title: "Calibration Matrix", desc: "9-box talent grid for succession planning.", color: "#F59E0B" },
            { icon: BarChart3, title: "Performance Analytics", desc: "Trends, distribution, bias detection.", color: "#F43F5E", span: "tall" },
        ],
    },
    {
        id: "compliance",
        label: "Compliance",
        features: [
            { icon: ShieldCheck, title: "BLA 2006 Ready", desc: "Leave, wage, working hours — all compliant by default.", color: "#10B981", span: "wide" },
            { icon: Fingerprint, title: "NID Verification", desc: "Bangladesh NID validation integrated.", color: "#60A5FA" },
            { icon: FileText, title: "Audit Logs", desc: "Every action logged — court-admissible evidence.", color: "#A78BFA" },
            { icon: ShieldCheck, title: "Data Residency", desc: "Bangladesh-hosted data, RLS tenant isolation.", color: "#F59E0B" },
            { icon: Users, title: "Maternity & Leave", desc: "Auto-calc per BD labour law, no manual lookup.", color: "#F43F5E", span: "tall" },
        ],
    },
];

export default function BentoFeatures() {
    const [activeTab, setActiveTab] = useState(tabs[0].id);
    const { ref, isInView } = useInView(0.05);
    const activeGroup = tabs.find((t) => t.id === activeTab) || tabs[0];

    return (
        <section
            id="features"
            ref={ref}
            className="relative py-24"
            style={{ background: P.bg }}
        >
            <div className="max-w-6xl mx-auto px-6">
                {/* ── Header ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="text-center mb-12"
                >
                    <Eyebrow>Everything you need</Eyebrow>
                    <h2
                        className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] mt-4 mb-3"
                        style={{ color: P.heading }}
                    >
                        One platform.
                        <span
                            className="bg-clip-text text-transparent ml-2"
                            style={{ backgroundImage: P.gradText }}
                        >
                            Every HR workflow.
                        </span>
                    </h2>
                    <p className="text-[15px] max-w-xl mx-auto" style={{ color: P.body }}>
                        From hire to retire — built ground-up for Bangladeshi teams.
                    </p>
                </motion.div>

                {/* ── Tabs ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.1}
                    className="flex flex-wrap justify-center gap-1.5 mb-10"
                >
                    {tabs.map((tab) => {
                        const isActive = tab.id === activeTab;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className="relative px-4 py-2 rounded-full text-[12px] sm:text-[13px] font-semibold cursor-pointer transition-colors duration-200"
                                style={{
                                    color: isActive ? P.heading : P.muted,
                                    background: isActive ? "rgba(59,130,246,0.10)" : "transparent",
                                    border: `1px solid ${isActive ? P.borderHover : P.border}`,
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                        e.currentTarget.style.color = P.body;
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = "transparent";
                                        e.currentTarget.style.color = P.muted;
                                    }
                                }}
                            >
                                {tab.label}
                                {isActive && (
                                    <motion.div
                                        layoutId="tab-underline"
                                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                                        style={{ background: P.gradBrand }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </motion.div>

                {/* ── Bento Grid ── */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        variants={staggerContainer}
                        initial="hidden"
                        animate="visible"
                        exit={{ opacity: 0 }}
                        className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
                    >
                        {activeGroup.features.map((feature, i) => (
                            <FeatureCard key={`${activeTab}-${i}`} feature={feature} index={i} />
                        ))}
                    </motion.div>
                </AnimatePresence>

                {/* ── Bottom note ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.4}
                    className="text-center mt-10"
                >
                    <p className="text-[12px]" style={{ color: P.muted }}>
                        30+ features across 6 modules ·{" "}
                        <a href="#compare" style={{ color: P.blueBright }} className="underline">See full comparison →</a>
                    </p>
                </motion.div>
            </div>
        </section>
    );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
    const { icon: Icon, title, desc, color, span = "normal" } = feature;

    const spanClass =
        span === "wide" ? "col-span-2" : span === "tall" ? "row-span-2" : "";

    return (
        <motion.div
            variants={staggerItem}
            className={`group relative rounded-2xl p-5 sm:p-6 overflow-hidden ${spanClass}`}
            style={{
                background: P.surface,
                border: `1px solid ${P.border}`,
                minHeight: span === "tall" ? "240px" : "auto",
                transition: "border-color 300ms ease, transform 300ms ease",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${color}40`;
                e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = P.border;
                e.currentTarget.style.transform = "translateY(0)";
            }}
        >
            {/* Gradient glow on hover */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                    background: `radial-gradient(circle at top left, ${color}10, transparent 60%)`,
                }}
            />

            {/* Icon */}
            <div className="relative">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{
                        background: `${color}12`,
                        border: `1px solid ${color}30`,
                    }}
                >
                    <Icon className="w-4.5 h-4.5" style={{ color }} />
                </div>
            </div>

            {/* Content */}
            <div className="relative">
                <h3
                    className="font-display text-[15px] sm:text-[16px] font-semibold mb-1.5 tracking-tight"
                    style={{ color: P.heading }}
                >
                    {title}
                </h3>
                <p className="text-[12px] sm:text-[13px] leading-relaxed" style={{ color: P.body }}>
                    {desc}
                </p>
            </div>

            {/* Bottom accent for tall cards */}
            {span === "tall" && (
                <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, transparent, ${color}40, transparent)` }} />
            )}
        </motion.div>
    );
}
