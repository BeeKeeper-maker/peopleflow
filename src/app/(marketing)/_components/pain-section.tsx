"use client";

import { motion } from "framer-motion";
import { X, Check, ArrowRight, FileSpreadsheet, Clock, AlertTriangle, ShieldCheck, Zap, TrendingUp } from "lucide-react";
import { P, fadeUp, fadeLeft, fadeRight, staggerContainer, staggerItem, useInView, Eyebrow } from "./shared";

// ═══════════════════════════════════════════════════════════════
// PROBLEM → SOLUTION — Before/After Split
// Linear-style: bold copy, clear visual contrast
// ═══════════════════════════════════════════════════════════════

const beforePain = [
    { icon: FileSpreadsheet, label: "Spreadsheets scattered across HR, finance, ops" },
    { icon: AlertTriangle, label: "Manual payroll errors — wrong OT, missed leave encashment" },
    { icon: Clock, label: "40+ hours/week lost to manual reconciliation" },
    { icon: X, label: "Compliance evidence missing for BLA 2006 audits" },
    { icon: X, label: "Buddy punching inflating attendance records" },
    { icon: X, label: "No real-time view — month-end surprises only" },
];

const afterGains = [
    { icon: ShieldCheck, label: "Single source of truth — every team aligned" },
    { icon: Zap, label: "Automated payroll — bKash + bank EFT in one click" },
    { icon: TrendingUp, label: "3-minute payslip generation, not 3 days" },
    { icon: Check, label: "BLA 2006 compliance evidence auto-generated" },
    { icon: Check, label: "Biometric anti-buddy-punch built in" },
    { icon: Check, label: "Live dashboard — see everything in real-time" },
];

export default function PainSection() {
    const { ref, isInView } = useInView(0.1);

    return (
        <section
            id="problem-solution"
            ref={ref}
            className="relative py-24 overflow-hidden"
            style={{ background: P.bg }}
        >
            {/* Subtle background gradient */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.04), transparent)",
                }}
            />

            <div className="relative max-w-6xl mx-auto px-6">
                {/* ── Header ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="text-center mb-14"
                >
                    <Eyebrow>The Cost of Manual HR</Eyebrow>
                    <h2
                        className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] mt-4 mb-4"
                        style={{ color: P.heading }}
                    >
                        40+ hours lost every week.
                        <br />
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: P.gradText }}
                        >
                            We give them back.
                        </span>
                    </h2>
                    <p className="text-[15px] max-w-xl mx-auto leading-relaxed" style={{ color: P.body }}>
                        Bangladeshi HR teams spend a third of their week on work that should be automated.
                        See what changes when you switch to PeopleFlow.
                    </p>
                </motion.div>

                {/* ── Before/After split ── */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="grid md:grid-cols-2 gap-5"
                >
                    {/* ── BEFORE ── */}
                    <motion.div variants={fadeLeft}>
                        <div
                            className="relative rounded-2xl p-7 h-full"
                            style={{
                                background: "rgba(244,63,94,0.03)",
                                border: `1px solid rgba(244,63,94,0.12)`,
                            }}
                        >
                            {/* Header */}
                            <div className="flex items-center gap-2.5 mb-5">
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: "rgba(244,63,94,0.10)",
                                        border: "1px solid rgba(244,63,94,0.20)",
                                    }}
                                >
                                    <AlertTriangle className="w-4 h-4" style={{ color: P.rose }} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: P.rose }}>
                                        Before PeopleFlow
                                    </div>
                                    <div className="text-[15px] font-semibold font-display" style={{ color: P.heading }}>
                                        The chaos of manual HR
                                    </div>
                                </div>
                            </div>

                            {/* List */}
                            <div className="space-y-3">
                                {beforePain.map((item, i) => (
                                    <motion.div
                                        key={i}
                                        variants={staggerItem}
                                        className="flex items-start gap-3"
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                            style={{
                                                background: "rgba(244,63,94,0.10)",
                                                border: "1px solid rgba(244,63,94,0.20)",
                                            }}
                                        >
                                            <X className="w-2.5 h-2.5" style={{ color: P.rose }} />
                                        </div>
                                        <span className="text-[13px] leading-relaxed" style={{ color: P.body }}>
                                            {item.label}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Cost badge */}
                            <div
                                className="mt-6 pt-5 flex items-center justify-between"
                                style={{ borderTop: "1px solid rgba(244,63,94,0.12)" }}
                            >
                                <div className="text-[11px]" style={{ color: P.muted }}>Estimated weekly loss</div>
                                <div className="font-mono text-[18px] font-bold" style={{ color: P.rose }}>
                                    40+ hrs
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* ── AFTER ── */}
                    <motion.div variants={fadeRight}>
                        <div
                            className="relative rounded-2xl p-7 h-full"
                            style={{
                                background: "rgba(16,185,129,0.04)",
                                border: `1px solid rgba(16,185,129,0.18)`,
                                boxShadow: `0 0 32px ${P.emeraldDim}`,
                            }}
                        >
                            {/* Header */}
                            <div className="flex items-center gap-2.5 mb-5">
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: "rgba(16,185,129,0.10)",
                                        border: "1px solid rgba(16,185,129,0.25)",
                                    }}
                                >
                                    <ShieldCheck className="w-4 h-4" style={{ color: P.emerald }} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: P.emerald }}>
                                        After PeopleFlow
                                    </div>
                                    <div className="text-[15px] font-semibold font-display" style={{ color: P.heading }}>
                                        HR on autopilot
                                    </div>
                                </div>
                            </div>

                            {/* List */}
                            <div className="space-y-3">
                                {afterGains.map((item, i) => (
                                    <motion.div
                                        key={i}
                                        variants={staggerItem}
                                        className="flex items-start gap-3"
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                            style={{
                                                background: "rgba(16,185,129,0.12)",
                                                border: "1px solid rgba(16,185,129,0.30)",
                                            }}
                                        >
                                            <Check className="w-2.5 h-2.5" style={{ color: P.emerald }} />
                                        </div>
                                        <span className="text-[13px] leading-relaxed" style={{ color: P.heading }}>
                                            {item.label}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>

                            {/* Savings badge */}
                            <div
                                className="mt-6 pt-5 flex items-center justify-between"
                                style={{ borderTop: "1px solid rgba(16,185,129,0.18)" }}
                            >
                                <div className="text-[11px]" style={{ color: P.muted }}>Time saved per week</div>
                                <div className="font-mono text-[18px] font-bold" style={{ color: P.emerald }}>
                                    36+ hrs
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>

                {/* ── Bottom CTA ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.3}
                    className="text-center mt-10"
                >
                    <a
                        href="#features"
                        className="inline-flex items-center gap-2 text-[13px] font-semibold no-underline transition-colors"
                        style={{ color: P.blueBright }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = P.blue; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = P.blueBright; }}
                    >
                        See how it works
                        <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
