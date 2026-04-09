"use client";

import { useState, useRef, useCallback } from "react";
import { motion, useInView as fmUseInView, AnimatePresence } from "framer-motion";
import {
    Shield, Fingerprint, GitBranch, Gift, Clock, Users,
    Check, ChevronRight, Wifi,
} from "lucide-react";
import { P, staggerContainer, staggerItem } from "./shared";

// ═══════════════════════════════════════════════════════════════
// 3D TILT CARD — Tracks cursor for perspective transform + spotlight
// ═══════════════════════════════════════════════════════════════

function BentoCard({
    children,
    className = "",
    span = "normal",
}: {
    children: React.ReactNode;
    className?: string;
    span?: "normal" | "wide" | "tall";
}) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [spotlightPos, setSpotlightPos] = useState({ x: 50, y: 50 });
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = (e.clientX - rect.left) / rect.width;
        const cy = (e.clientY - rect.top) / rect.height;
        setTilt({ x: (cy - 0.5) * -10, y: (cx - 0.5) * 10 });
        setSpotlightPos({ x: cx * 100, y: cy * 100 });
    }, []);

    const gridSpan = span === "wide" ? "md:col-span-2" : span === "tall" ? "md:row-span-2" : "";

    return (
        <motion.div
            ref={cardRef}
            variants={staggerItem}
            className={`relative rounded-2xl overflow-hidden group ${gridSpan} ${className}`}
            style={{
                background: P.surface,
                border: `1px solid ${P.border}`,
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                transition: "transform 200ms ease-out, box-shadow 400ms ease",
                willChange: "transform",
                boxShadow: isHovered
                    ? `0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px ${P.borderHover}`
                    : `0 4px 20px rgba(0,0,0,0.15)`,
            }}
            onMouseMove={handleMouseMove}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setTilt({ x: 0, y: 0 }); setIsHovered(false); }}
        >
            <div
                className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"
                style={{
                    background: `radial-gradient(circle 300px at ${spotlightPos.x}% ${spotlightPos.y}%, rgba(59,130,246,0.06), transparent 70%)`,
                }}
            />
            <div className="relative z-10 h-full">{children}</div>
        </motion.div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MICRO-UI 1: BLA Compliance — Staggered checklist with Framer Motion
// ═══════════════════════════════════════════════════════════════

const checklistItems = [
    "Maternity Leave Pre/Post Split",
    "Earned Leave Pro-Rata Calc",
    "Festival Bonus Auto-Generate",
    "PF Ledger Reconciliation",
    "Wage Register (Form XII)",
];

const checkContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.35, delayChildren: 0.3 } },
};

const checkItem = {
    hidden: { opacity: 0, x: -16 },
    visible: {
        opacity: 1, x: 0,
        transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
};

const checkMark = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
        scale: 1, opacity: 1,
        transition: { type: "spring" as const, stiffness: 500, damping: 15, delay: 0.15 },
    },
};

function ComplianceChecklist() {
    const ref = useRef(null);
    const inView = fmUseInView(ref, { once: true, margin: "-40px" });

    return (
        <motion.div
            ref={ref}
            className="space-y-2.5 mt-5"
            variants={checkContainer}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
        >
            {checklistItems.map((label) => (
                <motion.div key={label} variants={checkItem} className="flex items-center gap-3">
                    <motion.div
                        variants={checkMark}
                        className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: P.blue, boxShadow: `0 0 12px ${P.blueDim}` }}
                    >
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </motion.div>
                    <span className="text-xs" style={{ color: P.heading }}>{label}</span>
                </motion.div>
            ))}
        </motion.div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MICRO-UI 2: Biometric Sync — Animated progress bar + device glow
// ═══════════════════════════════════════════════════════════════

function BiometricStream() {
    const ref = useRef(null);
    const inView = fmUseInView(ref, { once: true, margin: "-40px" });

    const devices = [
        { name: "Gate A", delay: 0.6 },
        { name: "Floor 2", delay: 1.2 },
        { name: "Admin", delay: 1.8 },
    ];

    return (
        <div ref={ref} className="mt-5 space-y-4">
            {/* Progress bar */}
            <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${P.emerald}, #059669)`, boxShadow: `0 0 16px ${P.emeraldDim}` }}
                    initial={{ width: "0%" }}
                    animate={inView ? { width: "100%" } : { width: "0%" }}
                    transition={{ duration: 2.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
                />
            </div>

            {/* Device cards */}
            <div className="grid grid-cols-3 gap-2">
                {devices.map((d) => (
                    <motion.div
                        key={d.name}
                        className="rounded-lg p-2.5 text-center"
                        initial={{ background: "rgba(255,255,255,0.02)", borderColor: P.border }}
                        animate={inView ? {
                            background: P.emeraldDim,
                            borderColor: `${P.emerald}30`,
                        } : {}}
                        transition={{ duration: 0.5, delay: d.delay }}
                        style={{ border: `1px solid ${P.border}` }}
                    >
                        <motion.div
                            initial={{ color: P.ghost }}
                            animate={inView ? { color: P.emerald } : {}}
                            transition={{ duration: 0.3, delay: d.delay }}
                        >
                            <Wifi className="w-3.5 h-3.5 mx-auto mb-1" />
                        </motion.div>
                        <motion.p
                            className="text-[10px] font-medium"
                            initial={{ color: P.ghost }}
                            animate={inView ? { color: P.emerald } : {}}
                            transition={{ duration: 0.3, delay: d.delay }}
                        >
                            {d.name}
                        </motion.p>
                    </motion.div>
                ))}
            </div>

            <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium" style={{ color: P.subtle }}>ZKTeco → Cloud</span>
                <motion.span
                    className="text-xs font-bold"
                    initial={{ opacity: 0 }}
                    animate={inView ? { opacity: 1 } : {}}
                    transition={{ delay: 2.8 }}
                    style={{ color: P.emerald }}
                >
                    SYNCED ✓
                </motion.span>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MICRO-UI 3: Approval Kanban — Cards physically slide across stages
// ═══════════════════════════════════════════════════════════════

function ApprovalKanban() {
    const ref = useRef(null);
    const inView = fmUseInView(ref, { once: true, margin: "-40px" });

    // 4 columns, the request "card" slides across them
    const stages = ["Pending", "L1 Review", "L2 Review", "Approved"];

    return (
        <div ref={ref} className="mt-5 space-y-3">
            {/* Stage headers */}
            <div className="grid grid-cols-4 gap-1.5">
                {stages.map((s, i) => (
                    <div
                        key={s}
                        className="rounded-md py-1.5 text-center text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: "rgba(255,255,255,0.03)", color: P.subtle, border: `1px solid ${P.border}` }}
                    >
                        {s}
                    </div>
                ))}
            </div>

            {/* Kanban lanes with sliding card */}
            <div className="relative h-16 rounded-lg overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}>
                {/* Lane dividers */}
                <div className="absolute inset-0 grid grid-cols-4">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="border-r" style={{ borderColor: P.border }} />
                    ))}
                </div>

                {/* The sliding request card */}
                <motion.div
                    className="absolute top-2 left-1 w-[calc(25%-8px)] h-12 rounded-lg p-2 flex flex-col justify-center"
                    style={{
                        background: `linear-gradient(135deg, ${P.indigo}20, ${P.violet}15)`,
                        border: `1px solid ${P.indigo}30`,
                        boxShadow: `0 4px 16px ${P.indigoDim}`,
                    }}
                    initial={{ x: 0 }}
                    animate={inView ? {
                        x: ["0%", "0%", "110%", "110%", "220%", "220%", "330%"],
                    } : { x: 0 }}
                    transition={{
                        duration: 4,
                        ease: "easeInOut",
                        times: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
                        delay: 0.4,
                    }}
                >
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: P.indigo }}>R</div>
                        <span className="text-[9px] font-semibold text-white truncate">Annual Leave</span>
                    </div>
                    <span className="text-[8px] mt-0.5" style={{ color: "#A5B4FC" }}>Rahim · 3 Days</span>
                </motion.div>

                {/* Approved checkmark appears in last column */}
                <motion.div
                    className="absolute top-1/2 -translate-y-1/2 right-[4%]"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={inView ? { scale: 1, opacity: 1 } : {}}
                    transition={{ type: "spring", stiffness: 400, damping: 12, delay: 4.6 }}
                >
                    <div
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: P.emerald, boxShadow: `0 0 16px ${P.emeraldDim}` }}
                    >
                        <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MICRO-UI 4: Festival Bonus — SVG Progress Ring with animated stroke
// ═══════════════════════════════════════════════════════════════

function BonusRing() {
    const ref = useRef(null);
    const inView = fmUseInView(ref, { once: true, margin: "-40px" });

    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const target = 0.87; // 87%

    const bonuses = [
        { label: "Eid-ul-Fitr", value: "৳12.4L", done: true },
        { label: "Eid-ul-Adha", value: "৳11.8L", done: true },
        { label: "Durga Puja", value: "Pending", done: false },
    ];

    return (
        <div ref={ref} className="mt-5 flex items-center gap-5">
            {/* SVG Ring */}
            <div className="relative w-28 h-28 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {/* Background track */}
                    <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
                    {/* Animated fill */}
                    <motion.circle
                        cx="50" cy="50" r={radius} fill="none"
                        stroke="url(#bonusGradient)"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={inView ? { strokeDashoffset: circumference * (1 - target) } : { strokeDashoffset: circumference }}
                        transition={{ duration: 2, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                    />
                    <defs>
                        <linearGradient id="bonusGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={P.amber} />
                            <stop offset="100%" stopColor="#D97706" />
                        </linearGradient>
                    </defs>
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                        className="text-xl font-black text-white"
                        initial={{ opacity: 0 }}
                        animate={inView ? { opacity: 1 } : {}}
                        transition={{ delay: 1.5 }}
                    >
                        87%
                    </motion.span>
                    <span className="text-[9px]" style={{ color: P.subtle }}>Complete</span>
                </div>
            </div>

            {/* Bonus list */}
            <div className="space-y-2.5 flex-1">
                {bonuses.map((b, i) => (
                    <motion.div
                        key={b.label}
                        className="flex items-center justify-between"
                        initial={{ opacity: 0, x: 12 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.5, delay: 0.6 + i * 0.3 }}
                    >
                        <span className="text-[11px]" style={{ color: P.body }}>{b.label}</span>
                        <span
                            className="text-[11px] font-semibold"
                            style={{ color: b.done ? P.amber : P.subtle }}
                        >
                            {b.value}
                        </span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MICRO-UI 5: Late Deduction — Actual bars that grow with Framer Motion
// ═══════════════════════════════════════════════════════════════

function LateDeductionChart() {
    const ref = useRef(null);
    const inView = fmUseInView(ref, { once: true, margin: "-40px" });

    const tiers = [
        { label: "1–3", deduction: "0%", targetH: 14, color: P.emerald },
        { label: "4–6", deduction: "25%", targetH: 40, color: P.amber },
        { label: "7–9", deduction: "50%", targetH: 64, color: "#F97316" },
        { label: "10+", deduction: "100%", targetH: 88, color: P.rose },
    ];

    return (
        <div ref={ref} className="mt-5">
            {/* Bar chart */}
            <div className="flex items-end gap-3 h-28 mb-3">
                {tiers.map((tier, i) => (
                    <div key={tier.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        {/* Deduction label */}
                        <motion.span
                            className="text-[10px] font-bold"
                            initial={{ opacity: 0, y: 8 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.4, delay: 0.3 + i * 0.2 }}
                            style={{ color: tier.color }}
                        >
                            {tier.deduction}
                        </motion.span>
                        {/* The actual growing bar */}
                        <motion.div
                            className="w-full rounded-t-md"
                            style={{
                                background: `linear-gradient(to top, ${tier.color}, ${tier.color}90)`,
                                boxShadow: `0 0 12px ${tier.color}25`,
                            }}
                            initial={{ height: 0 }}
                            animate={inView ? { height: tier.targetH } : { height: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 80,
                                damping: 12,
                                delay: 0.4 + i * 0.2,
                            }}
                        />
                    </div>
                ))}
            </div>
            {/* Labels */}
            <div className="flex gap-3">
                {tiers.map((tier) => (
                    <span key={tier.label} className="flex-1 text-center text-[9px] font-medium" style={{ color: P.subtle }}>
                        {tier.label} late
                    </span>
                ))}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MICRO-UI 6: RBAC — Expandable role chips with AnimatePresence
// ═══════════════════════════════════════════════════════════════

const roles = [
    { name: "Super Admin", color: P.rose, perms: ["All Modules", "User Mgmt", "Billing", "Audit Logs"] },
    { name: "HR Admin", color: P.blue, perms: ["Employees", "Leaves", "Payroll", "Reports"] },
    { name: "Manager", color: P.indigo, perms: ["Team View", "Approvals", "Attendance"] },
    { name: "Employee", color: P.emerald, perms: ["Self-Service", "Payslips", "Leaves"] },
];

function RBACChips() {
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div className="mt-5 space-y-2">
            {roles.map((role) => (
                <div key={role.name}>
                    <button
                        onClick={() => setExpanded(expanded === role.name ? null : role.name)}
                        className="w-full flex items-center justify-between p-2.5 rounded-lg cursor-pointer"
                        style={{
                            background: expanded === role.name ? `${role.color}08` : "rgba(255,255,255,0.02)",
                            border: `1px solid ${expanded === role.name ? `${role.color}25` : P.border}`,
                            transition: "all 300ms ease",
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <motion.div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ background: role.color }}
                                animate={expanded === role.name ? { scale: [1, 1.4, 1] } : {}}
                                transition={{ duration: 0.4 }}
                            />
                            <span className="text-[11px] font-medium text-white">{role.name}</span>
                        </div>
                        <motion.div
                            animate={{ rotate: expanded === role.name ? 90 : 0 }}
                            transition={{ duration: 0.25 }}
                        >
                            <ChevronRight className="w-3 h-3" style={{ color: P.subtle }} />
                        </motion.div>
                    </button>

                    <AnimatePresence>
                        {expanded === role.name && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                                className="overflow-hidden"
                            >
                                <motion.div
                                    className="flex flex-wrap gap-1.5 pt-2 pl-5 pb-1"
                                    initial="hidden"
                                    animate="visible"
                                    variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
                                >
                                    {role.perms.map((perm) => (
                                        <motion.span
                                            key={perm}
                                            className="px-2 py-1 rounded-md text-[10px] font-medium"
                                            style={{
                                                background: `${role.color}10`,
                                                color: role.color,
                                                border: `1px solid ${role.color}20`,
                                            }}
                                            variants={{
                                                hidden: { opacity: 0, scale: 0.7, y: 6 },
                                                visible: { opacity: 1, scale: 1, y: 0 },
                                            }}
                                            transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                        >
                                            {perm}
                                        </motion.span>
                                    ))}
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// FEATURE DATA
// ═══════════════════════════════════════════════════════════════

const features: {
    icon: typeof Shield;
    tag: string;
    tagColor: string;
    title: string;
    description: string;
    span: "normal" | "wide" | "tall";
    MicroUI: () => React.JSX.Element;
}[] = [
    {
        icon: Shield, tag: "COMPLIANCE", tagColor: P.blue,
        title: "BLA 2006 Auto-Compliance",
        description: "Maternity pre/post split, earned leave pro-rata, festival bonus calculations. Every payslip is legally bulletproof.",
        span: "wide", MicroUI: ComplianceChecklist,
    },
    {
        icon: Fingerprint, tag: "ATTENDANCE", tagColor: P.emerald,
        title: "Zero-Friction Biometric",
        description: "Cloud-to-LAN bridge. ZKTeco syncs every 5 min. One-click setup, no IT required.",
        span: "normal", MicroUI: BiometricStream,
    },
    {
        icon: GitBranch, tag: "WORKFLOW", tagColor: P.indigo,
        title: "Multi-Level Approval Engine",
        description: "Configurable L1→L2→L3 chains with auto-escalation, delegation, and SLA enforcement.",
        span: "normal", MicroUI: ApprovalKanban,
    },
    {
        icon: Gift, tag: "PAYROLL", tagColor: P.amber,
        title: "Festival Bonus Engine",
        description: "Bulk generate Eid, Puja, and custom bonuses. Pro-rata for joiners, automatic PF deduction.",
        span: "normal", MicroUI: BonusRing,
    },
    {
        icon: Clock, tag: "POLICY", tagColor: "#F97316",
        title: "Smart Late Deduction",
        description: "Configurable tiered slabs. 1–3 lates = grace, 10+ = full-day deduction. Runs automatically.",
        span: "normal", MicroUI: LateDeductionChart,
    },
    {
        icon: Users, tag: "SECURITY", tagColor: P.violet,
        title: "Deep RBAC + Row-Level Security",
        description: "4-tier role hierarchy with granular permissions. Branch-level data isolation out of the box.",
        span: "wide", MicroUI: RBACChips,
    },
];

// ═══════════════════════════════════════════════════════════════
// MAIN BENTO GRID
// ═══════════════════════════════════════════════════════════════

export default function BentoFeatures() {
    return (
        <section id="features" className="relative py-28 overflow-hidden" style={{ background: P.bg }}>
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(99,102,241,0.03) 0%, transparent 65%)" }}
            />

            <div className="relative max-w-7xl mx-auto px-6">
                {/* Header */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    className="text-center mb-16"
                >
                    <motion.div variants={staggerItem}>
                        <div
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                            style={{ background: P.indigoDim, border: `1px solid ${P.indigo}20` }}
                        >
                            <span className="text-sm">🚀</span>
                            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#A5B4FC" }}>
                                Bangladesh-Specific Superpowers
                            </span>
                        </div>
                    </motion.div>
                    <motion.h2
                        variants={staggerItem}
                        className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
                        style={{ color: P.heading }}
                    >
                        Six Engines That{" "}
                        <span className="bg-clip-text text-transparent" style={{ backgroundImage: P.gradBrand }}>
                            Run Your HR
                        </span>
                    </motion.h2>
                    <motion.p variants={staggerItem} className="text-lg max-w-2xl mx-auto" style={{ color: P.body }}>
                        Every engine is stress-tested against Bangladesh{"'"}s most demanding RMG, Corporate, and NGO requirements.
                    </motion.p>
                </motion.div>

                {/* Bento Grid */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-30px" }}
                    className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-auto"
                    style={{ gridAutoFlow: "dense" }}
                >
                    {features.map((f) => (
                        <BentoCard key={f.title} span={f.span}>
                            <div className="p-7 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <div
                                        className="w-11 h-11 rounded-xl flex items-center justify-center"
                                        style={{ background: `${f.tagColor}12`, border: `1px solid ${f.tagColor}20` }}
                                    >
                                        <f.icon className="w-5 h-5" style={{ color: f.tagColor }} />
                                    </div>
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md"
                                        style={{ color: f.tagColor, background: `${f.tagColor}10`, border: `1px solid ${f.tagColor}15` }}
                                    >
                                        {f.tag}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold mb-2" style={{ color: P.heading }}>{f.title}</h3>
                                <p className="text-sm leading-relaxed" style={{ color: P.muted }}>{f.description}</p>
                                <div className="mt-auto pt-2">
                                    <f.MicroUI />
                                </div>
                            </div>
                        </BentoCard>
                    ))}
                </motion.div>
            </div>

            <div
                className="max-w-5xl mx-auto mt-24 h-px"
                style={{ background: `linear-gradient(to right, transparent, ${P.border}, transparent)` }}
            />
        </section>
    );
}
