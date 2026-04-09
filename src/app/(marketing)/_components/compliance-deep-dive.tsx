"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useInView as fmUseInView } from "framer-motion";
import { Shield, Baby, CalendarDays, Gift, ChevronRight, Check } from "lucide-react";
import { P, staggerContainer, staggerItem, fadeUp } from "./shared";

// ═══════════════════════════════════════════════════════════════
// STAGE DATA
// ═══════════════════════════════════════════════════════════════

const stages = [
    {
        id: "maternity",
        icon: Baby,
        tag: "Section 45–50",
        tagColor: P.rose,
        title: "Maternity Leave Auto-Split",
        description: "PeopleFlow automatically enforces the BLA 2006 maternity provision: 8 weeks pre-natal + 8 weeks post-natal. No HR intervention required. The system blocks illegal configurations and auto-calculates maternity benefit payments from the employee's average daily wage.",
        highlights: ["16 weeks total entitlement", "Auto pre/post split", "Benefit auto-calculated"],
    },
    {
        id: "earned",
        icon: CalendarDays,
        tag: "Section 117",
        tagColor: P.blue,
        title: "Earned Leave Pro-Rata",
        description: "Every employee earns 1 day of annual leave for every 18 days worked. PeopleFlow calculates this in real-time, accounting for joining date, attendance records, and carryover rules. Zero spreadsheet formulas needed.",
        highlights: ["1 day per 18 days worked", "Joining-date aware", "Auto carryover"],
    },
    {
        id: "bonus",
        icon: Gift,
        tag: "Section 120",
        tagColor: P.amber,
        title: "Festival Bonus Generation",
        description: "Bulk-generate Eid-ul-Fitr, Eid-ul-Adha, Durga Puja, and custom festival bonuses for your entire workforce in one click. Pro-rata calculations for mid-year joiners are fully automatic, with PF deduction applied where applicable.",
        highlights: ["One-click bulk generation", "Pro-rata for joiners", "Auto PF deduction"],
    },
];

// ═══════════════════════════════════════════════════════════════
// MICRO-UI: Maternity Leave Calendar
// ═══════════════════════════════════════════════════════════════

function MaternityCalendar() {
    const ref = useRef(null);
    const inView = fmUseInView(ref, { once: true, margin: "-30px" });

    // Generate simplified calendar weeks
    const preWeeks = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
    const postWeeks = ["W9", "W10", "W11", "W12", "W13", "W14", "W15", "W16"];

    return (
        <div ref={ref} className="space-y-5">
            {/* Pre-natal block */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <motion.div
                        className="w-3 h-3 rounded-full"
                        style={{ background: P.rose }}
                        initial={{ scale: 0 }}
                        animate={inView ? { scale: 1 } : {}}
                        transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.2 }}
                    />
                    <span className="text-xs font-semibold" style={{ color: P.rose }}>Pre-Natal — 8 Weeks</span>
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                    {preWeeks.map((w, i) => (
                        <motion.div
                            key={w}
                            className="rounded-lg aspect-square flex items-center justify-center text-[9px] font-bold"
                            style={{ border: `1px solid ${P.rose}30` }}
                            initial={{ opacity: 0, scale: 0.5, background: "rgba(255,255,255,0.02)" }}
                            animate={inView ? {
                                opacity: 1,
                                scale: 1,
                                background: P.roseDim,
                            } : {}}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
                                delay: 0.3 + i * 0.08,
                            }}
                        >
                            <motion.span
                                initial={{ color: P.ghost }}
                                animate={inView ? { color: P.rose } : {}}
                                transition={{ delay: 0.5 + i * 0.08 }}
                            >
                                {w}
                            </motion.span>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Delivery marker */}
            <motion.div
                className="flex items-center gap-2 px-4 py-2 rounded-lg mx-auto w-fit"
                style={{ background: P.emeraldDim, border: `1px solid ${P.emerald}30` }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 1.0 }}
            >
                <div className="w-2 h-2 rounded-full" style={{ background: P.emerald }} />
                <span className="text-[10px] font-bold" style={{ color: P.emerald }}>
                    Expected Delivery Date
                </span>
            </motion.div>

            {/* Post-natal block */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <motion.div
                        className="w-3 h-3 rounded-full"
                        style={{ background: P.indigo }}
                        initial={{ scale: 0 }}
                        animate={inView ? { scale: 1 } : {}}
                        transition={{ type: "spring", stiffness: 500, damping: 15, delay: 1.2 }}
                    />
                    <span className="text-xs font-semibold" style={{ color: "#A5B4FC" }}>Post-Natal — 8 Weeks</span>
                </div>
                <div className="grid grid-cols-8 gap-1.5">
                    {postWeeks.map((w, i) => (
                        <motion.div
                            key={w}
                            className="rounded-lg aspect-square flex items-center justify-center text-[9px] font-bold"
                            style={{ border: `1px solid ${P.indigo}30` }}
                            initial={{ opacity: 0, scale: 0.5, background: "rgba(255,255,255,0.02)" }}
                            animate={inView ? {
                                opacity: 1,
                                scale: 1,
                                background: P.indigoDim,
                            } : {}}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
                                delay: 1.3 + i * 0.08,
                            }}
                        >
                            <motion.span
                                initial={{ color: P.ghost }}
                                animate={inView ? { color: "#A5B4FC" } : {}}
                                transition={{ delay: 1.5 + i * 0.08 }}
                            >
                                {w}
                            </motion.span>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Summary */}
            <motion.div
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}
                initial={{ opacity: 0, y: 12 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 2.2, duration: 0.5 }}
            >
                <span className="text-xs" style={{ color: P.body }}>Total Maternity Leave</span>
                <span className="text-sm font-bold text-white">112 Days (16 Weeks)</span>
            </motion.div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MICRO-UI: Earned Leave Pro-Rata Calculator
// ═══════════════════════════════════════════════════════════════

function EarnedLeaveCalculator() {
    const ref = useRef(null);
    const inView = fmUseInView(ref, { once: true, margin: "-30px" });

    const rows = [
        { label: "Days Worked (YTD)", target: 247, color: P.blue },
        { label: "Leave Earned", target: 13, color: P.indigo },
        { label: "Leave Taken", target: 4, color: P.amber },
        { label: "Available Balance", target: 9, color: P.emerald },
    ];

    return (
        <div ref={ref} className="space-y-5">
            {/* Formula display */}
            <motion.div
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.2 }}
            >
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: P.subtle }}>BLA Formula</p>
                <div className="flex items-center gap-2 flex-wrap">
                    <motion.span
                        className="px-3 py-1.5 rounded-lg text-sm font-mono font-bold"
                        style={{ background: P.blueDim, color: P.blue, border: `1px solid ${P.blue}20` }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={inView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ type: "spring", delay: 0.4 }}
                    >
                        Days Worked
                    </motion.span>
                    <motion.span
                        className="text-lg font-bold"
                        style={{ color: P.subtle }}
                        initial={{ opacity: 0 }}
                        animate={inView ? { opacity: 1 } : {}}
                        transition={{ delay: 0.6 }}
                    >
                        ÷
                    </motion.span>
                    <motion.span
                        className="px-3 py-1.5 rounded-lg text-sm font-mono font-bold"
                        style={{ background: P.indigoDim, color: P.indigo, border: `1px solid ${P.indigo}20` }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={inView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ type: "spring", delay: 0.7 }}
                    >
                        18
                    </motion.span>
                    <motion.span
                        className="text-lg font-bold"
                        style={{ color: P.subtle }}
                        initial={{ opacity: 0 }}
                        animate={inView ? { opacity: 1 } : {}}
                        transition={{ delay: 0.8 }}
                    >
                        =
                    </motion.span>
                    <motion.span
                        className="px-3 py-1.5 rounded-lg text-sm font-mono font-bold"
                        style={{ background: P.emeraldDim, color: P.emerald, border: `1px solid ${P.emerald}20` }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={inView ? { opacity: 1, scale: 1 } : {}}
                        transition={{ type: "spring", delay: 0.9 }}
                    >
                        Leave Earned
                    </motion.span>
                </div>
            </motion.div>

            {/* Computed rows with animated numbers */}
            <div className="space-y-2.5">
                {rows.map((row, i) => (
                    <motion.div
                        key={row.label}
                        className="flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}
                        initial={{ opacity: 0, x: -20 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.5, delay: 1.1 + i * 0.15 }}
                    >
                        <span className="text-xs" style={{ color: P.body }}>{row.label}</span>
                        <CountUpNumber target={row.target} color={row.color} inView={inView} delay={1.3 + i * 0.15} />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

/** Inline count-up driven by Framer Motion */
function CountUpNumber({ target, color, inView, delay }: { target: number; color: string; inView: boolean; delay: number }) {
    const [val, setVal] = useState(0);
    const started = useRef(false);

    useEffect(() => {
        if (!inView || started.current) return;
        started.current = true;
        const startTime = performance.now();
        const delayMs = delay * 1000;
        const duration = 800;
        const frame = (now: number) => {
            const elapsed = now - startTime - delayMs;
            if (elapsed < 0) { requestAnimationFrame(frame); return; }
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setVal(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }, [inView, target, delay]);

    return (
        <span className="text-base font-bold tabular-nums" style={{ color }}>
            {val}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════
// MICRO-UI: Festival Bonus Bulk Generator
// ═══════════════════════════════════════════════════════════════

function BonusGenerator() {
    const ref = useRef(null);
    const inView = fmUseInView(ref, { once: true, margin: "-30px" });

    const bonuses = [
        { name: "Eid-ul-Fitr 2026", employees: 1247, amount: "৳12.4L", status: "Processed" },
        { name: "Eid-ul-Adha 2026", employees: 1247, amount: "৳11.8L", status: "Processed" },
        { name: "Durga Puja 2026", employees: 312, amount: "৳2.9L", status: "Generating..." },
    ];

    const radius = 38;
    const circumference = 2 * Math.PI * radius;

    return (
        <div ref={ref} className="space-y-4">
            {/* Bulk generation summary */}
            <div className="grid grid-cols-2 gap-4">
                {/* Progress ring */}
                <motion.div
                    className="flex flex-col items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 0.3 }}
                >
                    <div className="relative w-24 h-24">
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                            <motion.circle
                                cx="50" cy="50" r={radius} fill="none"
                                stroke="url(#bonusGenGrad)"
                                strokeWidth="8" strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={inView ? { strokeDashoffset: circumference * 0.13 } : {}}
                                transition={{ duration: 2.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.5 }}
                            />
                            <defs>
                                <linearGradient id="bonusGenGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor={P.amber} />
                                    <stop offset="100%" stopColor="#D97706" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <motion.span
                                className="text-lg font-black text-white"
                                initial={{ opacity: 0 }}
                                animate={inView ? { opacity: 1 } : {}}
                                transition={{ delay: 2.0 }}
                            >
                                87%
                            </motion.span>
                            <span className="text-[8px]" style={{ color: P.subtle }}>Complete</span>
                        </div>
                    </div>
                </motion.div>

                {/* Stats */}
                <div className="flex flex-col justify-center space-y-2">
                    {[
                        { label: "Total Disbursed", value: "৳27.1L" },
                        { label: "Employees", value: "1,247" },
                        { label: "Avg. Per Employee", value: "৳21,731" },
                    ].map((s, i) => (
                        <motion.div
                            key={s.label}
                            initial={{ opacity: 0, x: 12 }}
                            animate={inView ? { opacity: 1, x: 0 } : {}}
                            transition={{ delay: 0.8 + i * 0.2 }}
                        >
                            <p className="text-[9px]" style={{ color: P.subtle }}>{s.label}</p>
                            <p className="text-sm font-bold text-white">{s.value}</p>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Bonus rows */}
            <div className="space-y-2">
                {bonuses.map((b, i) => (
                    <motion.div
                        key={b.name}
                        className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ delay: 1.4 + i * 0.2 }}
                    >
                        <div className="flex items-center gap-2.5">
                            <motion.div
                                className="w-5 h-5 rounded-md flex items-center justify-center"
                                style={{
                                    background: i < 2 ? P.emeraldDim : P.amberDim,
                                    border: `1px solid ${i < 2 ? `${P.emerald}30` : `${P.amber}30`}`,
                                }}
                                initial={{ scale: 0 }}
                                animate={inView ? { scale: 1 } : {}}
                                transition={{ type: "spring", stiffness: 500, damping: 15, delay: 1.6 + i * 0.2 }}
                            >
                                {i < 2 ? (
                                    <Check className="w-3 h-3" style={{ color: P.emerald }} />
                                ) : (
                                    <motion.div
                                        className="w-2 h-2 rounded-full"
                                        style={{ background: P.amber }}
                                        animate={{ opacity: [1, 0.3, 1] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    />
                                )}
                            </motion.div>
                            <div>
                                <p className="text-[11px] font-medium text-white">{b.name}</p>
                                <p className="text-[9px]" style={{ color: P.subtle }}>{b.employees} employees · {b.amount}</p>
                            </div>
                        </div>
                        <span
                            className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                                color: i < 2 ? P.emerald : P.amber,
                                background: i < 2 ? P.emeraldDim : P.amberDim,
                            }}
                        >
                            {b.status}
                        </span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPLIANCE DEEP-DIVE
// ═══════════════════════════════════════════════════════════════

const microUIs = {
    maternity: MaternityCalendar,
    earned: EarnedLeaveCalculator,
    bonus: BonusGenerator,
} as const;

export default function ComplianceDeepDive() {
    const [activeStage, setActiveStage] = useState(0);
    const sectionRef = useRef(null);
    const inView = fmUseInView(sectionRef, { once: true, margin: "-80px" });

    const current = stages[activeStage];
    const MicroUI = microUIs[current.id as keyof typeof microUIs];

    return (
        <section
            ref={sectionRef}
            id="compliance"
            className="relative py-28 overflow-hidden"
            style={{ background: P.bg }}
        >
            {/* Ambient glow */}
            <div
                className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(244,63,94,0.03) 0%, transparent 70%)" }}
            />

            <div className="relative max-w-7xl mx-auto px-6">
                {/* Header */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    className="text-center mb-20"
                >
                    <motion.div variants={staggerItem}>
                        <div
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                            style={{ background: P.roseDim, border: `1px solid ${P.rose}20` }}
                        >
                            <Shield className="w-3.5 h-3.5" style={{ color: P.rose }} />
                            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: P.rose }}>
                                BLA 2006 Deep-Dive
                            </span>
                        </div>
                    </motion.div>
                    <motion.h2
                        variants={staggerItem}
                        className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
                        style={{ color: P.heading }}
                    >
                        Compliance,{" "}
                        <span className="bg-clip-text text-transparent" style={{ backgroundImage: P.gradDanger }}>
                            Automated at the Core
                        </span>
                    </motion.h2>
                    <motion.p variants={staggerItem} className="text-lg max-w-2xl mx-auto" style={{ color: P.body }}>
                        Every calculation is auto-enforced by the BLA 2006 rules engine.
                        Zero manual formulas. Zero compliance risk.
                    </motion.p>
                </motion.div>

                {/* 2-Column Layout: Selector (left) + UI (right) */}
                <div className="grid lg:grid-cols-5 gap-8 items-start">
                    {/* ── LEFT: Stage Selector ── */}
                    <div className="lg:col-span-2 space-y-3">
                        {stages.map((stage, i) => (
                            <motion.button
                                key={stage.id}
                                onClick={() => setActiveStage(i)}
                                className="w-full text-left p-5 rounded-2xl cursor-pointer relative overflow-hidden group"
                                style={{
                                    background: activeStage === i ? P.elevated : P.surface,
                                    border: `1px solid ${activeStage === i ? stage.tagColor + "30" : P.border}`,
                                    transition: "all 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                                }}
                                initial={{ opacity: 0, x: -20 }}
                                animate={inView ? { opacity: 1, x: 0 } : {}}
                                transition={{ delay: 0.3 + i * 0.1 }}
                                whileHover={{ x: 4 }}
                            >
                                {/* Active indicator glow */}
                                {activeStage === i && (
                                    <motion.div
                                        className="absolute inset-0 pointer-events-none"
                                        style={{ background: `radial-gradient(ellipse at 0% 50%, ${stage.tagColor}08, transparent 60%)` }}
                                        layoutId="stageGlow"
                                        transition={{ type: "spring", stiffness: 200, damping: 25 }}
                                    />
                                )}

                                <div className="relative">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                                            style={{
                                                background: `${stage.tagColor}12`,
                                                border: `1px solid ${stage.tagColor}20`,
                                            }}
                                        >
                                            <stage.icon className="w-5 h-5" style={{ color: stage.tagColor }} />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: stage.tagColor }}>
                                                {stage.tag}
                                            </span>
                                            <h3 className="text-sm font-bold" style={{ color: P.heading }}>{stage.title}</h3>
                                        </div>
                                        <ChevronRight
                                            className="w-4 h-4 transition-transform duration-300"
                                            style={{
                                                color: activeStage === i ? stage.tagColor : P.ghost,
                                                transform: activeStage === i ? "translateX(2px)" : "translateX(0)",
                                            }}
                                        />
                                    </div>

                                    {/* Description */}
                                    <AnimatePresence mode="wait">
                                        {activeStage === i && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className="overflow-hidden"
                                            >
                                                <p className="text-xs leading-relaxed mt-1 mb-3" style={{ color: P.muted }}>
                                                    {stage.description}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {stage.highlights.map((h) => (
                                                        <span
                                                            key={h}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium"
                                                            style={{ background: `${stage.tagColor}10`, color: stage.tagColor, border: `1px solid ${stage.tagColor}15` }}
                                                        >
                                                            <Check className="w-2.5 h-2.5" />
                                                            {h}
                                                        </span>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.button>
                        ))}
                    </div>

                    {/* ── RIGHT: Interactive UI ── */}
                    <div className="lg:col-span-3">
                        <div
                            className="rounded-2xl p-6 sm:p-8 min-h-[420px]"
                            style={{ background: P.surface, border: `1px solid ${P.border}` }}
                        >
                            {/* UI header */}
                            <div className="flex items-center gap-2 mb-6">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF5F57" }} />
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28C840" }} />
                                </div>
                                <span className="text-[10px] font-medium ml-2" style={{ color: P.subtle }}>
                                    PeopleFlow → {current.title}
                                </span>
                            </div>

                            {/* Animated UI swap */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={current.id}
                                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -20, scale: 0.97 }}
                                    transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                                >
                                    <MicroUI />
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section divider */}
            <div
                className="max-w-5xl mx-auto mt-24 h-px"
                style={{ background: `linear-gradient(to right, transparent, ${P.border}, transparent)` }}
            />
        </section>
    );
}
