"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Star, Shield, Users, BarChart3, Calendar, Fingerprint, ChevronDown, Play, Zap } from "lucide-react";
import { P, fadeUp, useMouseTilt } from "./shared";

// ═══════════════════════════════════════════════════════════════
// HERO SECTION — Cinematic Entrance
// ═══════════════════════════════════════════════════════════════

export default function HeroCinematic({ onBookDemo }: { onBookDemo: () => void }) {
    return (
        <section
            id="hero"
            className="relative min-h-screen flex items-center pt-28 pb-20 overflow-hidden"
            style={{ background: P.bg }}
        >
            {/* ── Aurora Mesh Background ── */}
            <AuroraMesh />

            {/* ── Perspective Grid ── */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    opacity: 0.03,
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
                    `,
                    backgroundSize: "72px 72px",
                    maskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 70%)",
                    WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black 30%, transparent 70%)",
                }}
            />

            <div className="relative max-w-7xl mx-auto px-6 w-full">
                <div className="max-w-4xl mx-auto text-center">
                    {/* ── Live Badge ── */}
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate="visible"
                        custom={0}
                        className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full mb-10"
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${P.border}`,
                            backdropFilter: "blur(12px)",
                        }}
                    >
                        <div className="flex items-center gap-1.5">
                            <div className="relative">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            </div>
                            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
                        </div>
                        <div className="w-px h-3.5" style={{ background: P.border }} />
                        <span className="text-sm font-medium" style={{ color: "#ADC6FF" }}>
                            🇧🇩 Trusted by 500+ Organizations
                        </span>
                    </motion.div>

                    {/* ── Headline — Staggered Lines ── */}
                    <div className="mb-8">
                        <motion.h1
                            variants={fadeUp} initial="hidden" animate="visible" custom={0.1}
                            className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-bold leading-[1.05] tracking-[-0.035em]"
                            style={{ color: P.heading }}
                        >
                            Stop Bleeding Money
                        </motion.h1>
                        <motion.h1
                            variants={fadeUp} initial="hidden" animate="visible" custom={0.2}
                            className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-bold leading-[1.05] tracking-[-0.035em]"
                        >
                            <span
                                className="bg-clip-text text-transparent"
                                style={{
                                    backgroundImage: "linear-gradient(90deg, #F43F5E, #F59E0B, #10B981, #3B82F6)",
                                    backgroundSize: "200% auto",
                                    animation: "gradient-text 6s linear infinite",
                                }}
                            >
                                On Manual HR
                            </span>
                        </motion.h1>
                    </div>

                    {/* ── Sub-headline ── */}
                    <motion.p
                        variants={fadeUp} initial="hidden" animate="visible" custom={0.3}
                        className="text-lg sm:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
                        style={{ color: P.body }}
                    >
                        Every month without PeopleFlow, your factory loses{" "}
                        <span className="font-semibold text-white">৳2–5 lakh</span> to
                        payroll errors, BLA 2006 non-compliance fines, and ghost attendance.{" "}
                        <span className="font-medium" style={{ color: P.emerald }}>We eliminate 100% of that.</span>
                    </motion.p>

                    {/* ── CTAs ── */}
                    <motion.div
                        variants={fadeUp} initial="hidden" animate="visible" custom={0.4}
                        className="flex flex-wrap justify-center gap-4 mb-16"
                    >
                        <button
                            onClick={onBookDemo}
                            className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-white font-semibold text-base cursor-pointer overflow-hidden"
                            style={{
                                background: P.gradBrand,
                                boxShadow: `0 0 40px ${P.blueDim}, 0 8px 32px rgba(0,0,0,0.4)`,
                                transition: "all 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = `0 0 60px ${P.blueGlow}, 0 8px 40px rgba(0,0,0,0.5)`;
                                e.currentTarget.style.transform = "scale(1.04) translateY(-2px)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = `0 0 40px ${P.blueDim}, 0 8px 32px rgba(0,0,0,0.4)`;
                                e.currentTarget.style.transform = "scale(1) translateY(0)";
                            }}
                        >
                            {/* Shimmer */}
                            <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                                style={{
                                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                                    backgroundSize: "200% 100%",
                                    animation: "shimmer 2s infinite",
                                }}
                            />
                            <span className="relative z-10">Book a Free Demo</span>
                            <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-200" />
                        </button>
                        <Link
                            href="/register"
                            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl font-semibold text-base text-white transition-all duration-300"
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: `1px solid rgba(255,255,255,0.08)`,
                                backdropFilter: "blur(8px)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                            }}
                        >
                            <Play className="w-4 h-4" style={{ color: P.indigo }} />
                            Start Free — 14 Days
                        </Link>
                    </motion.div>

                    {/* ── Social Proof Bar ── */}
                    <motion.div
                        variants={fadeUp} initial="hidden" animate="visible" custom={0.55}
                        className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2.5">
                                {[P.blue, P.indigo, P.emerald, P.violet, P.amber].map((bg, i) => (
                                    <div
                                        key={i}
                                        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                        style={{
                                            background: bg,
                                            border: `2.5px solid ${P.bg}`,
                                            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                        }}
                                    >
                                        {["A", "R", "K", "S", "M"][i]}
                                    </div>
                                ))}
                            </div>
                            <span className="text-sm" style={{ color: P.muted }}>
                                <span className="text-white font-semibold">500+</span> organizations
                            </span>
                        </div>
                        <div className="hidden sm:block w-px h-6" style={{ background: P.border }} />
                        <div className="flex items-center gap-1.5">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                            ))}
                            <span className="text-sm ml-1" style={{ color: P.muted }}>4.9/5 rating</span>
                        </div>
                    </motion.div>
                </div>

                {/* ── 3D Dashboard Mockup ── */}
                <motion.div
                    variants={fadeUp} initial="hidden" animate="visible" custom={0.6}
                    className="mt-20"
                >
                    <DashboardMockup3D />
                </motion.div>

                {/* ── Scroll Indicator ── */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 1 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2"
                >
                    <ChevronDown className="w-5 h-5 animate-bounce" style={{ color: "rgba(255,255,255,0.15)" }} />
                </motion.div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// AURORA MESH — 3 gradient orbs with drift animation
// ═══════════════════════════════════════════════════════════════

function AuroraMesh() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            {/* Orb 1 — Blue */}
            <div
                className="absolute rounded-full"
                style={{
                    width: 900, height: 900,
                    top: "-35%", right: "-10%",
                    background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)",
                    animation: "aurora-1 18s ease-in-out infinite",
                }}
            />
            {/* Orb 2 — Violet */}
            <div
                className="absolute rounded-full"
                style={{
                    width: 750, height: 750,
                    bottom: "-30%", left: "-12%",
                    background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 65%)",
                    animation: "aurora-2 22s ease-in-out infinite",
                }}
            />
            {/* Orb 3 — Indigo */}
            <div
                className="absolute rounded-full"
                style={{
                    width: 600, height: 600,
                    top: "15%", left: "40%",
                    background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 65%)",
                    animation: "aurora-3 26s ease-in-out infinite",
                }}
            />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// 3D DASHBOARD MOCKUP — Tilts with cursor
// ═══════════════════════════════════════════════════════════════

function DashboardMockup3D() {
    const { ref, tilt } = useMouseTilt(6);

    return (
        <div className="relative max-w-5xl mx-auto" ref={ref}>
            {/* Ambient glow behind the dashboard */}
            <div
                className="absolute -inset-10 rounded-[3rem] blur-3xl pointer-events-none"
                style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(99,102,241,0.08), rgba(139,92,246,0.06))" }}
            />

            {/* Main Card — with 3D tilt */}
            <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                    background: P.surface,
                    border: `1px solid ${P.border}`,
                    boxShadow: `0 40px 100px rgba(0,0,0,0.5), 0 0 0 1px ${P.border}`,
                    transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                    transition: "transform 150ms ease-out",
                    willChange: "transform",
                }}
            >
                {/* ── Title Bar ── */}
                <div
                    className="flex items-center gap-2 px-5 py-3.5"
                    style={{ background: "#0A0A12", borderBottom: `1px solid ${P.border}` }}
                >
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                    </div>
                    <div className="flex-1 flex justify-center">
                        <div
                            className="px-4 py-1 rounded-md text-xs"
                            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${P.border}`, color: P.subtle }}
                        >
                            hr.ailearnersbd.com/dashboard
                        </div>
                    </div>
                </div>

                {/* ── Cards Grid ── */}
                <div className="p-6 grid grid-cols-4 gap-4">
                    {[
                        { label: "Total Employees", value: "1,247", change: "+12%", icon: Users, color: P.blue },
                        { label: "Attendance Rate", value: "96.8%", change: "+2.4%", icon: BarChart3, color: P.emerald },
                        { label: "Payroll Processed", value: "৳48.2M", change: "On Time", icon: Calendar, color: P.violet },
                        { label: "Active Devices", value: "24", change: "All Live", icon: Fingerprint, color: P.amber },
                    ].map((m) => (
                        <div
                            key={m.label}
                            className="rounded-xl p-4 transition-colors duration-200"
                            style={{
                                background: "rgba(255,255,255,0.02)",
                                border: `1px solid ${P.border}`,
                            }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <m.icon className="w-5 h-5" style={{ color: m.color }} />
                                <span
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    style={{ color: m.color, background: `${m.color}15` }}
                                >
                                    {m.change}
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-white">{m.value}</p>
                            <p className="text-xs mt-1" style={{ color: P.subtle }}>{m.label}</p>
                        </div>
                    ))}

                    {/* ── Chart Area ── */}
                    <div
                        className="col-span-3 rounded-xl p-5"
                        style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <p className="text-sm font-medium text-white">Payroll Trend</p>
                                <p className="text-xs" style={{ color: P.subtle }}>Last 12 months</p>
                            </div>
                            <div className="flex gap-3 text-xs" style={{ color: P.subtle }}>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: P.blue }} />Gross</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: P.emerald }} />Net</span>
                            </div>
                        </div>
                        <div className="flex items-end gap-2 h-28">
                            {[35, 55, 45, 65, 50, 70, 60, 80, 68, 85, 75, 92].map((h, i) => (
                                <div key={i} className="flex-1 flex flex-col gap-0.5">
                                    <div
                                        className="rounded-t-sm transition-all duration-500"
                                        style={{
                                            height: `${h}%`,
                                            background: i === 11
                                                ? `linear-gradient(to top, ${P.blue}, ${P.indigo})`
                                                : `${P.blue}20`,
                                            transitionDelay: `${i * 50}ms`,
                                        }}
                                    />
                                    <div
                                        className="rounded-t-sm"
                                        style={{
                                            height: `${h * 0.7}%`,
                                            background: i === 11
                                                ? `linear-gradient(to top, ${P.emerald}, #059669)`
                                                : `${P.emerald}15`,
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Quick Actions ── */}
                    <div
                        className="rounded-xl p-4"
                        style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}` }}
                    >
                        <p className="text-xs font-medium text-white mb-3">Quick Actions</p>
                        {[
                            { label: "Process Payroll", color: P.blue },
                            { label: "Approve Leave", color: P.emerald },
                            { label: "Sync Devices", color: P.amber },
                        ].map((action) => (
                            <div
                                key={action.label}
                                className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors cursor-pointer mb-1"
                                style={{ background: "transparent" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                                <div
                                    className="w-5 h-5 rounded flex items-center justify-center"
                                    style={{ background: `${action.color}15` }}
                                >
                                    <div className="w-2 h-2 rounded-full" style={{ background: action.color }} />
                                </div>
                                <span className="text-xs" style={{ color: P.body }}>{action.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Floating Status Badge — Top Right ── */}
            <div
                className="absolute -top-4 -right-4 px-4 py-2.5 rounded-xl flex items-center gap-2"
                style={{
                    background: `${P.emeraldDim}`,
                    border: `1px solid ${P.emerald}30`,
                    backdropFilter: "blur(16px)",
                    animation: "float 6s ease-in-out infinite",
                    boxShadow: `0 10px 40px rgba(16,185,129,0.12)`,
                }}
            >
                <div className="relative">
                    <div className="w-2 h-2 rounded-full" style={{ background: P.emerald }} />
                    <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ background: P.emerald }} />
                </div>
                <span className="text-xs font-semibold" style={{ color: P.emerald }}>All Systems Active</span>
            </div>

            {/* ── Floating Compliance Badge — Bottom Left ── */}
            <div
                className="absolute -bottom-4 -left-4 px-4 py-2.5 rounded-xl flex items-center gap-2"
                style={{
                    background: P.indigoDim,
                    border: `1px solid ${P.indigo}30`,
                    backdropFilter: "blur(16px)",
                    animation: "float 6s ease-in-out infinite 2s",
                    boxShadow: `0 10px 40px rgba(99,102,241,0.12)`,
                }}
            >
                <Shield className="w-3.5 h-3.5" style={{ color: "#A5B4FC" }} />
                <span className="text-xs font-semibold" style={{ color: "#A5B4FC" }}>BLA 2006 Compliant</span>
            </div>
        </div>
    );
}
