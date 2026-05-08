"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, Clock, ArrowRight } from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem, AnimatedNumber, useInView } from "./shared";

// ═══════════════════════════════════════════════════════════════
// PAIN SECTION — "Cost of Inaction" FOMO Engine
// ═══════════════════════════════════════════════════════════════

const dangers = [
    {
        icon: AlertTriangle,
        title: "Compliance Evidence Risk",
        stat: 3,
        statPrefix: "",
        statSuffix: " checks",
        description: "Bangladesh leave, maternity, and wage calculations need careful review. Manual records make compliance evidence harder to prepare.",
        detail: "Leave, wage, and attendance records need traceable review.",
        accentFrom: "#F43F5E",
        accentTo: "#E11D48",
        dimBg: "rgba(244,63,94,0.06)",
        dimBorder: "rgba(244,63,94,0.12)",
        glowColor: "rgba(244,63,94,0.15)",
    },
    {
        icon: TrendingDown,
        title: "Payroll Leakage Exposure",
        stat: 4,
        statPrefix: "",
        statSuffix: " controls",
        description: "Ghost attendance, manual overtime mistakes, and buddy-punching can create avoidable payroll leakage without structured review.",
        detail: "Actual impact depends on workforce size and controls.",
        accentFrom: "#F59E0B",
        accentTo: "#D97706",
        dimBg: "rgba(245,158,11,0.06)",
        dimBorder: "rgba(245,158,11,0.12)",
        glowColor: "rgba(245,158,11,0.15)",
    },
    {
        icon: Clock,
        title: "Manual HR Review Load",
        stat: 5,
        statPrefix: "",
        statSuffix: " records",
        description: "HR teams often spend substantial time reconciling spreadsheets, PF ledgers, biometric logs, and manual approval trails.",
        detail: "A structured beta rollout can measure the time saved.",
        accentFrom: "#8B5CF6",
        accentTo: "#7C3AED",
        dimBg: "rgba(139,92,246,0.06)",
        dimBorder: "rgba(139,92,246,0.12)",
        glowColor: "rgba(139,92,246,0.15)",
    },
];

function DangerCard({
    danger,
    index,
}: {
    danger: typeof dangers[number];
    index: number;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <motion.div
            variants={staggerItem}
            className="relative group rounded-2xl overflow-hidden"
            style={{
                background: P.surface,
                border: `1px solid ${danger.dimBorder}`,
                transition: "all 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
            onMouseEnter={(e) => {
                setHovered(true);
                e.currentTarget.style.borderColor = danger.accentFrom + "40";
                e.currentTarget.style.boxShadow = `0 20px 60px ${danger.glowColor}, 0 0 0 1px ${danger.dimBorder}`;
                e.currentTarget.style.transform = "translateY(-4px)";
            }}
            onMouseLeave={(e) => {
                setHovered(false);
                e.currentTarget.style.borderColor = danger.dimBorder;
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
            }}
        >
            {/* Hover glow background */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${danger.glowColor}, transparent 70%)`,
                }}
            />

            <div className="relative p-8">
                {/* Icon with pulsing ring */}
                <div className="relative w-14 h-14 mb-6">
                    <div
                        className="absolute inset-0 rounded-2xl"
                        style={{
                            background: danger.dimBg,
                            border: `1px solid ${danger.dimBorder}`,
                        }}
                    />
                    {/* Pulse ring */}
                    <div
                        className="absolute -inset-1.5 rounded-2xl"
                        style={{
                            border: `1.5px solid ${danger.accentFrom}30`,
                            animation: "pulse-ring 3s ease-in-out infinite",
                            animationDelay: `${index * 0.6}s`,
                        }}
                    />
                    <div className="relative w-full h-full flex items-center justify-center">
                        <danger.icon
                            className="w-6 h-6 transition-colors duration-300"
                            style={{ color: danger.accentFrom }}
                        />
                    </div>
                </div>

                {/* Title */}
                <h3
                    className="text-xl font-bold mb-3 transition-colors duration-300"
                    style={{ color: P.heading }}
                >
                    {danger.title}
                </h3>

                {/* Animated Stat */}
                <div
                    className="text-4xl font-black mb-4 transition-all duration-500"
                    style={{
                        background: `linear-gradient(135deg, ${danger.accentFrom}, ${danger.accentTo})`,
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        backgroundClip: "text",
                    }}
                >
                    <AnimatedNumber
                        target={danger.stat}
                        prefix={danger.statPrefix}
                        suffix={danger.statSuffix}
                    />
                </div>

                {/* Description */}
                <p
                    className="text-sm leading-relaxed mb-4"
                    style={{ color: P.body }}
                >
                    {danger.description}
                </p>

                {/* Detail tag */}
                <div
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                    style={{
                        background: danger.dimBg,
                        color: danger.accentFrom,
                        border: `1px solid ${danger.dimBorder}`,
                    }}
                >
                    {danger.detail}
                </div>
            </div>
        </motion.div>
    );
}

export default function PainSection() {
    const { ref, isInView } = useInView(0.1);

    return (
        <section
            ref={ref}
            id="pain"
            className="relative py-28 overflow-hidden"
            style={{ background: P.bg }}
        >
            {/* Subtle red ambient */}
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
                style={{
                    background: "radial-gradient(ellipse, rgba(244,63,94,0.04) 0%, transparent 70%)",
                }}
            />

            <div className="relative max-w-7xl mx-auto px-6">
                {/* Header */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    custom={0}
                    className="text-center mb-6"
                >
                    <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                        style={{
                            background: P.roseDim,
                            border: `1px solid rgba(244,63,94,0.15)`,
                        }}
                    >
                        <AlertTriangle className="w-3.5 h-3.5" style={{ color: P.rose }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: P.rose }}>
                            The Cost of Waiting
                        </span>
                    </div>
                </motion.div>

                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    custom={0.1}
                    className="text-center mb-16"
                >
                    <h2
                        className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
                        style={{ color: P.heading }}
                    >
                        Manual HR Reviews{" "}
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: P.gradDanger }}
                        >
                            Create Risk
                        </span>
                    </h2>
                    <p className="text-lg max-w-2xl mx-auto" style={{ color: P.body }}>
                        Spreadsheet-heavy HR makes it harder to keep payroll, leave, attendance,
                        and approval evidence consistent across teams.
                    </p>
                </motion.div>

                {/* Danger Cards Grid */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-30px" }}
                    className="grid md:grid-cols-3 gap-6 mb-16"
                >
                    {dangers.map((danger, i) => (
                        <DangerCard key={danger.title} danger={danger} index={i} />
                    ))}
                </motion.div>

                {/* Bottom conversion nudge */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    custom={0.3}
                    className="flex items-center justify-center gap-3"
                >
                    <div
                        className="h-px flex-1 max-w-24"
                        style={{ background: `linear-gradient(to right, transparent, ${P.border})` }}
                    />
                    <p className="text-sm font-medium" style={{ color: P.muted }}>
                        PeopleFlow gives beta teams a structured path to reduce this risk
                    </p>
                    <ArrowRight className="w-4 h-4" style={{ color: P.emerald }} />
                    <div
                        className="h-px flex-1 max-w-24"
                        style={{ background: `linear-gradient(to left, transparent, ${P.border})` }}
                    />
                </motion.div>
            </div>
        </section>
    );
}
