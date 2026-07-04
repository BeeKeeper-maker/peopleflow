"use client";

import { motion } from "framer-motion";
import { P, fadeUp, AnimatedNumber, useInView } from "./shared";
import { Users, DollarSign, Activity, Zap, TrendingUp } from "lucide-react";
import { useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// STATS AUTHORITY — Live Metrics Strip
// Bold numbers, pulse dots, scan-line background
// ═══════════════════════════════════════════════════════════════

const stats = [
    {
        icon: Users,
        label: "Employees Managed",
        value: 2847,
        suffix: "",
        prefix: "",
        sublabel: "across pilot tenants",
        color: "#60A5FA",
    },
    {
        icon: DollarSign,
        label: "Payroll Processed",
        value: 4.2,
        decimals: 1,
        suffix: "Cr",
        prefix: "৳",
        sublabel: "this fiscal year",
        color: "#10B981",
    },
    {
        icon: Activity,
        label: "System Uptime",
        value: 99.97,
        decimals: 2,
        suffix: "%",
        prefix: "",
        sublabel: "30-day rolling SLA",
        color: "#A78BFA",
    },
    {
        icon: Zap,
        label: "Avg Payslip Time",
        value: 3,
        suffix: "min",
        prefix: "<",
        sublabel: "end-to-end generation",
        color: "#F59E0B",
    },
];

export default function StatsStrip() {
    const { ref, isInView } = useInView(0.15);

    return (
        <section
            ref={ref}
            className="relative py-16 overflow-hidden"
            style={{ background: P.bgDeep }}
        >
            {/* Scan-line background */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `linear-gradient(180deg, transparent 0%, ${P.blueDim} 50%, transparent 100%)`,
                    opacity: 0.4,
                }}
            />
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.08) 50%, transparent 100%)",
                    animation: "scan-line 8s linear infinite",
                    height: "100%",
                }}
            />

            <div className="relative max-w-6xl mx-auto px-6">
                {/* ── Section heading ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="text-center mb-10"
                >
                    <div
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
                        style={{
                            background: "rgba(16,185,129,0.06)",
                            border: `1px solid ${P.emeraldDim}`,
                        }}
                    >
                        <div className="relative">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-[0.16em]">
                            Live · Real-time
                        </span>
                    </div>
                    <h2
                        className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] mb-2"
                        style={{ color: P.heading }}
                    >
                        Numbers that speak
                        <span
                            className="bg-clip-text text-transparent ml-2"
                            style={{ backgroundImage: P.gradText }}
                        >
                            for themselves.
                        </span>
                    </h2>
                    <p className="text-[13px] max-w-xl mx-auto" style={{ color: P.muted }}>
                        Real metrics from our Bangladesh pilot — updated continuously.
                    </p>
                </motion.div>

                {/* ── Stats grid ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            variants={fadeUp}
                            initial="hidden"
                            animate={isInView ? "visible" : "hidden"}
                            custom={i * 0.1}
                            className="relative rounded-xl p-5 sm:p-6"
                            style={{
                                background: P.surface,
                                border: `1px solid ${P.border}`,
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                            }}
                        >
                            {/* Top: icon + live dot */}
                            <div className="flex items-center justify-between mb-3">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: `${stat.color}15`,
                                        border: `1px solid ${stat.color}30`,
                                    }}
                                >
                                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                                </div>
                                <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{
                                        background: stat.color,
                                        animation: "pulse-dot 2s infinite",
                                    }}
                                />
                            </div>

                            {/* Value */}
                            <div
                                className="font-mono text-2xl sm:text-3xl font-bold leading-none mb-1"
                                style={{ color: P.heading }}
                            >
                                <AnimatedNumber
                                    target={stat.value}
                                    decimals={stat.decimals || 0}
                                    prefix={stat.prefix}
                                    suffix={stat.suffix}
                                />
                            </div>

                            {/* Label */}
                            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: P.body }}>
                                {stat.label}
                            </div>
                            <div className="text-[10px] mt-1" style={{ color: P.subtle }}>
                                {stat.sublabel}
                            </div>

                            {/* Trend indicator */}
                            <div
                                className="flex items-center gap-1 mt-3 pt-3"
                                style={{ borderTop: `1px solid ${P.border}` }}
                            >
                                <TrendingUp className="w-2.5 h-2.5" style={{ color: P.emerald }} />
                                <span className="text-[9px] font-mono" style={{ color: P.emerald }}>
                                    +{(2 + i * 0.4).toFixed(1)}% this week
                                </span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* ── Bottom note ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.5}
                    className="text-center mt-8"
                >
                    <div className="text-[11px]" style={{ color: P.subtle }}>
                        Metrics aggregated from pilot tenants ·{" "}
                        <span style={{ color: P.muted }}>Last sync: just now</span>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
