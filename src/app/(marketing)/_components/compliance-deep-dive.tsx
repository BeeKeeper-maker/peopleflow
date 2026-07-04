"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, FileText, MapPin, Award, Scale } from "lucide-react";
import { P, fadeUp, fadeLeft, fadeRight, staggerContainer, staggerItem, useInView, Eyebrow } from "./shared";

// ═══════════════════════════════════════════════════════════════
// COMPLIANCE DEEP-DIVE — BD Labour Law Authority
// Confident authority tone: BLA 2006, NID, data residency
// ═══════════════════════════════════════════════════════════════

const complianceItems = [
    {
        law: "BLA 2006",
        title: "Bangladesh Labour Act",
        desc: "Leave, working hours, overtime, maternity — auto-calculated per statute.",
        status: "Built-in",
    },
    {
        law: "Labour Rule 2015",
        title: "BD Labour Rules",
        desc: "Forms, registers, and reports aligned with 2015 rules — auto-generated.",
        status: "Built-in",
    },
    {
        law: "NID",
        title: "National ID Verification",
        desc: "Employee NID validated against BD government database on onboarding.",
        status: "Integrated",
    },
    {
        law: "BIDA",
        title: "BIDA Compliance",
        desc: "Foreign investment entity reporting — export-ready audit trails.",
        status: "Export-ready",
    },
    {
        law: "PF",
        title: "Provident Fund Ledger",
        desc: "Employee + employer contributions tracked per BD PF rules.",
        status: "Built-in",
    },
    {
        law: "Tax",
        title: "BD Tax Deduction",
        desc: "Payroll tax auto-deducted per Bangladesh income tax slabs.",
        status: "Auto-calc",
    },
];

const authorityBadges = [
    { icon: ShieldCheck, label: "BLA 2006 Ready", color: "#10B981" },
    { icon: CheckCircle2, label: "NID Integrated", color: "#60A5FA" },
    { icon: MapPin, label: "BD Data Residency", color: "#A78BFA" },
    { icon: Award, label: "Court-Admissible Logs", color: "#F59E0B" },
];

export default function ComplianceDeepDive() {
    const { ref, isInView } = useInView(0.08);

    return (
        <section
            id="compliance"
            ref={ref}
            className="relative py-24 overflow-hidden"
            style={{ background: P.bgDeep }}
        >
            {/* Background: subtle authority gradient */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.05), transparent)",
                }}
            />

            <div className="relative max-w-6xl mx-auto px-6">
                {/* ── Header ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="text-center mb-12"
                >
                    <Eyebrow>
                        <Scale className="w-3 h-3" />
                        Compliance Authority
                    </Eyebrow>
                    <h2
                        className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] mt-4 mb-3"
                        style={{ color: P.heading }}
                    >
                        Built to satisfy
                        <span
                            className="bg-clip-text text-transparent ml-2"
                            style={{ backgroundImage: P.gradText }}
                        >
                            Bangladesh labour law.
                        </span>
                    </h2>
                    <p className="text-[15px] max-w-xl mx-auto" style={{ color: P.body }}>
                        Every leave, every payslip, every overtime hour — calculated per BLA 2006.
                        Audit-ready evidence, on demand.
                    </p>
                </motion.div>

                {/* ── Authority badges row ── */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="flex flex-wrap justify-center gap-3 mb-14"
                >
                    {authorityBadges.map((badge) => (
                        <motion.div
                            key={badge.label}
                            variants={staggerItem}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                            style={{
                                background: `${badge.color}10`,
                                border: `1px solid ${badge.color}30`,
                            }}
                        >
                            <badge.icon className="w-3.5 h-3.5" style={{ color: badge.color }} />
                            <span className="text-[12px] font-semibold" style={{ color: P.heading }}>
                                {badge.label}
                            </span>
                        </motion.div>
                    ))}
                </motion.div>

                {/* ── Two-column: checklist + scorecard ── */}
                <div className="grid md:grid-cols-2 gap-5">
                    {/* ── Left: Compliance checklist ── */}
                    <motion.div
                        variants={fadeLeft}
                        initial="hidden"
                        animate={isInView ? "visible" : "hidden"}
                    >
                        <div
                            className="rounded-2xl p-7 h-full"
                            style={{
                                background: P.surface,
                                border: `1px solid ${P.border}`,
                            }}
                        >
                            <div className="flex items-center gap-2.5 mb-6">
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: P.emeraldDim,
                                        border: `1px solid rgba(16,185,129,0.25)`,
                                    }}
                                >
                                    <FileText className="w-4 h-4" style={{ color: P.emerald }} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: P.emerald }}>
                                        Compliance Checklist
                                    </div>
                                    <div className="text-[15px] font-semibold font-display" style={{ color: P.heading }}>
                                        Every regulation, handled
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {complianceItems.map((item) => (
                                    <div
                                        key={item.law}
                                        className="flex items-start gap-3 p-3 rounded-lg transition-colors duration-200"
                                        style={{ background: "rgba(255,255,255,0.015)" }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.015)"; }}
                                    >
                                        <CheckCircle2
                                            className="w-4 h-4 shrink-0 mt-0.5"
                                            style={{ color: P.emerald }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span
                                                    className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                                                    style={{
                                                        background: P.emeraldDim,
                                                        color: P.emerald,
                                                    }}
                                                >
                                                    {item.law}
                                                </span>
                                                <span className="text-[12px] font-semibold" style={{ color: P.heading }}>
                                                    {item.title}
                                                </span>
                                            </div>
                                            <div className="text-[11px] leading-relaxed" style={{ color: P.body }}>
                                                {item.desc}
                                            </div>
                                        </div>
                                        <span
                                            className="text-[9px] font-semibold uppercase tracking-wider shrink-0 mt-0.5"
                                            style={{ color: P.emerald }}
                                        >
                                            {item.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* ── Right: Scorecard ── */}
                    <motion.div
                        variants={fadeRight}
                        initial="hidden"
                        animate={isInView ? "visible" : "hidden"}
                    >
                        <div
                            className="rounded-2xl p-7 h-full relative overflow-hidden"
                            style={{
                                background: "linear-gradient(180deg, rgba(16,185,129,0.04), transparent)",
                                border: `1px solid rgba(16,185,129,0.18)`,
                            }}
                        >
                            {/* Glow */}
                            <div
                                className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none"
                                style={{
                                    background: "radial-gradient(circle, rgba(16,185,129,0.15), transparent 70%)",
                                    filter: "blur(40px)",
                                }}
                            />

                            <div className="relative">
                                <div className="flex items-center gap-2.5 mb-6">
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                                        style={{
                                            background: P.emeraldDim,
                                            border: `1px solid rgba(16,185,129,0.25)`,
                                        }}
                                    >
                                        <ShieldCheck className="w-4 h-4" style={{ color: P.emerald }} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: P.emerald }}>
                                            Compliance Score
                                        </div>
                                        <div className="text-[15px] font-semibold font-display" style={{ color: P.heading }}>
                                            How PeopleFlow maps to law
                                        </div>
                                    </div>
                                </div>

                                {/* Score circle */}
                                <div className="flex items-center justify-center mb-6">
                                    <div className="relative w-32 h-32">
                                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                            <circle
                                                cx="50" cy="50" r="44"
                                                fill="none"
                                                stroke={P.border}
                                                strokeWidth="6"
                                            />
                                            <motion.circle
                                                cx="50" cy="50" r="44"
                                                fill="none"
                                                stroke={P.emerald}
                                                strokeWidth="6"
                                                strokeLinecap="round"
                                                strokeDasharray={2 * Math.PI * 44}
                                                initial={{ strokeDashoffset: 2 * Math.PI * 44 }}
                                                animate={isInView ? { strokeDashoffset: 2 * Math.PI * 44 * 0.04 } : {}}
                                                transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <div className="font-mono text-3xl font-bold" style={{ color: P.heading }}>96</div>
                                            <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: P.emerald }}>Compliant</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Breakdown */}
                                <div className="space-y-2.5">
                                    {[
                                        { label: "BLA 2006 leave & wage", score: 100 },
                                        { label: "NID verification", score: 100 },
                                        { label: "Audit trail integrity", score: 100 },
                                        { label: "PF & tax calculation", score: 92 },
                                        { label: "Maternity benefits", score: 88 },
                                    ].map((item, i) => (
                                        <motion.div
                                            key={item.label}
                                            initial={{ opacity: 0, x: 8 }}
                                            animate={isInView ? { opacity: 1, x: 0 } : {}}
                                            transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[11px]" style={{ color: P.body }}>{item.label}</span>
                                                <span className="text-[11px] font-mono font-semibold" style={{ color: P.emerald }}>{item.score}%</span>
                                            </div>
                                            <div
                                                className="h-1 rounded-full overflow-hidden"
                                                style={{ background: P.border }}
                                            >
                                                <motion.div
                                                    className="h-full rounded-full"
                                                    style={{ background: P.emerald }}
                                                    initial={{ width: 0 }}
                                                    animate={isInView ? { width: `${item.score}%` } : {}}
                                                    transition={{ delay: 0.6 + i * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                                />
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>

                                <div
                                    className="mt-6 pt-5 text-[11px] text-center"
                                    style={{ color: P.muted, borderTop: `1px solid ${P.border}` }}
                                >
                                    Scores reflect feature coverage vs. BD regulatory requirements.
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
