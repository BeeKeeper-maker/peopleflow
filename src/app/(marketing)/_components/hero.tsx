"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play, ChevronDown, TrendingUp, Users, Clock, CheckCircle2, Sparkles } from "lucide-react";
import { P, fadeUp, fadeIn, Eyebrow } from "./shared";

// ═══════════════════════════════════════════════════════════════
// HERO — Dashboard Showcase with Live Animated Data
// Linear/Vercel-inspired: confident authority, live product preview
// ═══════════════════════════════════════════════════════════════

export default function HeroCinematic({ onBookDemo }: { onBookDemo: () => void }) {
    return (
        <section
            id="hero"
            className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-16 overflow-hidden"
            style={{ background: P.bg }}
        >
            {/* ── Background: Aurora Mesh ── */}
            <AuroraMesh />

            {/* ── Background: Perspective Grid ── */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    opacity: 0.025,
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
                    `,
                    backgroundSize: "64px 64px",
                    maskImage: "radial-gradient(ellipse 80% 60% at 50% 35%, black 25%, transparent 75%)",
                    WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 35%, black 25%, transparent 75%)",
                }}
            />

            <div className="relative w-full max-w-6xl mx-auto px-6">
                {/* ── Live Beta Badge ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={0}
                    className="flex justify-center mb-7"
                >
                    <div
                        className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full"
                        style={{
                            background: "rgba(255,255,255,0.03)",
                            border: `1px solid ${P.border}`,
                            backdropFilter: "blur(12px)",
                        }}
                    >
                        <div className="flex items-center gap-1.5">
                            <div className="relative">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            </div>
                            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.15em]">Live Beta</span>
                        </div>
                        <div className="w-px h-3" style={{ background: P.border }} />
                        <span className="text-[12px] font-medium" style={{ color: "rgba(245,245,247,0.7)" }}>
                            Trusted by pilot teams in Dhaka
                        </span>
                    </div>
                </motion.div>

                {/* ── Eyebrow ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={0.05}
                    className="flex justify-center mb-4"
                >
                    <Eyebrow>
                        <Sparkles className="w-3 h-3" />
                        Bangladesh HRMS Platform
                    </Eyebrow>
                </motion.div>

                {/* ── Headline ── */}
                <motion.h1
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={0.1}
                    className="font-display text-center text-[2.75rem] sm:text-6xl lg:text-7xl xl:text-[5.25rem] font-bold leading-[1.02] tracking-[-0.04em] max-w-4xl mx-auto"
                    style={{ color: P.heading }}
                >
                    The HR platform
                    <br />
                    <span
                        className="bg-clip-text text-transparent"
                        style={{
                            backgroundImage: P.gradText,
                            backgroundSize: "200% auto",
                            animation: "gradient-text 6s linear infinite",
                        }}
                    >
                        built for Bangladesh.
                    </span>
                </motion.h1>

                {/* ── Sub-headline ── */}
                <motion.p
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={0.2}
                    className="text-center text-base sm:text-lg lg:text-xl max-w-2xl mx-auto mt-6 leading-relaxed"
                    style={{ color: P.body }}
                >
                    Payroll, attendance, leave, and compliance — automated for Bangladeshi teams.
                    <span className="block mt-1.5 text-[13px] sm:text-sm font-medium" style={{ color: P.muted }}>
                        বাংলাদেশের জন্য তৈরি — BLA 2006 compliant · bKash disbursement · Bengali UI
                    </span>
                </motion.p>

                {/* ── CTAs ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={0.3}
                    className="flex flex-wrap justify-center gap-3 mt-9"
                >
                    <Link
                        href="/register"
                        className="group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-[14px] cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.03]"
                        style={{
                            background: P.gradBrand,
                            boxShadow: `0 0 28px ${P.blueDim}, 0 6px 20px rgba(0,0,0,0.4)`,
                        }}
                    >
                        <span className="relative z-10">Start Free Trial</span>
                        <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                    </Link>
                    <button
                        onClick={onBookDemo}
                        className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-[14px] text-white cursor-pointer transition-all duration-300"
                        style={{
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${P.borderHover}`,
                            backdropFilter: "blur(8px)",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                            e.currentTarget.style.borderColor = P.borderActive;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                            e.currentTarget.style.borderColor = P.borderHover;
                        }}
                    >
                        <Play className="w-3.5 h-3.5" style={{ color: P.blueBright }} />
                        Watch 2-min Demo
                    </button>
                </motion.div>

                {/* ── Trust Microcopy ── */}
                <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    animate="visible"
                    custom={0.45}
                    className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-7 text-[12px]"
                    style={{ color: P.muted }}
                >
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: P.emerald }} />
                        14-day free trial
                    </div>
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: P.emerald }} />
                        No credit card
                    </div>
                    <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: P.emerald }} />
                        Setup in 10 minutes
                    </div>
                </motion.div>

                {/* ── Live Dashboard Showcase ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    custom={0.55}
                    className="mt-14"
                >
                    <LiveDashboard />
                </motion.div>

                {/* ── Scroll Indicator ── */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.6, duration: 0.8 }}
                    className="flex justify-center mt-12"
                >
                    <div className="flex flex-col items-center gap-2" style={{ color: P.subtle }}>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-medium">Scroll</span>
                        <ChevronDown className="w-4 h-4 animate-bounce" />
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// AURORA MESH — Subtle gradient orbs
// ═══════════════════════════════════════════════════════════════

function AuroraMesh() {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
            <div
                className="absolute"
                style={{
                    top: "-10%", left: "15%", width: "550px", height: "550px",
                    background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 70%)",
                    filter: "blur(80px)",
                    animation: "aurora-1 22s ease-in-out infinite",
                }}
            />
            <div
                className="absolute"
                style={{
                    top: "5%", right: "10%", width: "500px", height: "500px",
                    background: "radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%)",
                    filter: "blur(80px)",
                    animation: "aurora-2 26s ease-in-out infinite",
                }}
            />
            <div
                className="absolute"
                style={{
                    top: "45%", left: "40%", width: "600px", height: "600px",
                    background: "radial-gradient(circle, rgba(99,102,241,0.10), transparent 70%)",
                    filter: "blur(100px)",
                    animation: "aurora-3 30s ease-in-out infinite",
                }}
            />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// LIVE DASHBOARD — Animated product showcase
// ═══════════════════════════════════════════════════════════════

function LiveDashboard() {
    return (
        <div className="relative">
            {/* Glow under dashboard */}
            <div
                className="absolute -inset-x-8 -bottom-8 h-32 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at center, ${P.blueDim}, transparent 70%)`,
                    filter: "blur(40px)",
                }}
            />

            <div
                className="relative rounded-2xl overflow-hidden"
                style={{
                    background: P.surface,
                    border: `1px solid ${P.border}`,
                    boxShadow: "0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
            >
                {/* ── Browser Chrome ── */}
                <div
                    className="flex items-center gap-2 px-4 py-3"
                    style={{ borderBottom: `1px solid ${P.border}`, background: "rgba(0,0,0,0.2)" }}
                >
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FF5F57" }} />
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#FEBC2E" }} />
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#28C840" }} />
                    </div>
                    <div className="flex-1 flex justify-center">
                        <div
                            className="px-3 py-1 rounded-md text-[11px] font-mono"
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                color: P.muted,
                                border: `1px solid ${P.border}`,
                            }}
                        >
                            app.peopleflow.com.bd/dashboard
                        </div>
                    </div>
                </div>

                {/* ── Dashboard Body ── */}
                <div className="grid grid-cols-12 min-h-[400px]">
                    {/* Sidebar */}
                    <aside
                        className="hidden lg:flex col-span-2 flex-col py-4 px-3 gap-1"
                        style={{ borderRight: `1px solid ${P.border}` }}
                    >
                        {[
                            { label: "Dashboard", active: true },
                            { label: "Employees", active: false },
                            { label: "Attendance", active: false },
                            { label: "Leave", active: false },
                            { label: "Payroll", active: false },
                            { label: "Reports", active: false },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                                style={{
                                    color: item.active ? P.heading : P.muted,
                                    background: item.active ? "rgba(59,130,246,0.10)" : "transparent",
                                }}
                            >
                                {item.label}
                            </div>
                        ))}
                    </aside>

                    {/* Main */}
                    <div className="col-span-12 lg:col-span-10 p-5">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.15em] font-semibold" style={{ color: P.muted }}>
                                    Overview
                                </div>
                                <div className="text-[16px] font-semibold font-display" style={{ color: P.heading }}>
                                    Good morning, Rashida
                                </div>
                            </div>
                            <div
                                className="px-2 py-1 rounded-md text-[10px] font-mono"
                                style={{
                                    background: P.emeraldDim,
                                    color: P.emerald,
                                    border: `1px solid ${P.emeraldDim}`,
                                }}
                            >
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle" style={{ animation: "pulse-dot 2s infinite" }} />
                                Live · {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </div>
                        </div>

                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            <KpiCard icon={Users} label="Active Employees" value={<LiveCounter target={2847} />} trend="+12 this week" />
                            <KpiCard icon={CheckCircle2} label="Present Today" value={<LiveCounter target={2614} />} trend="91.8% attendance" />
                            <KpiCard icon={Clock} label="Pending Approvals" value={<LiveCounter target={8} />} trend="3 urgent" />
                            <KpiCard icon={TrendingUp} label="Payroll (Month)" value={<><span style={{ color: P.emerald }}>৳</span><LiveCounter target={4.2} decimals={1} /><span style={{ color: P.muted }}>Cr</span></>} trend="On schedule" />
                        </div>

                        {/* Activity Feed + Mini Chart */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <ActivityFeed />
                            <AttendanceChart />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ icon: Icon, label, value, trend }: { icon: React.ElementType; label: string; value: React.ReactNode; trend: string }) {
    return (
        <div
            className="rounded-lg p-3"
            style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${P.border}`,
            }}
        >
            <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="w-3 h-3" style={{ color: P.blueBright }} />
                <span className="text-[10px] font-medium" style={{ color: P.muted }}>{label}</span>
            </div>
            <div className="font-mono text-[18px] font-semibold leading-none" style={{ color: P.heading }}>
                {value}
            </div>
            <div className="text-[9px] mt-1.5" style={{ color: P.subtle }}>{trend}</div>
        </div>
    );
}

function LiveCounter({ target, decimals = 0 }: { target: number; decimals?: number }) {
    const [value, setValue] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                const start = performance.now();
                const duration = 1800;
                const animate = (now: number) => {
                    const progress = Math.min((now - start) / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    setValue(target * eased);
                    if (progress < 1) requestAnimationFrame(animate);
                    else setValue(target);
                };
                requestAnimationFrame(animate);
                observer.disconnect();
            }
        }, { threshold: 0.3 });
        observer.observe(el);
        return () => observer.disconnect();
    }, [target]);

    const formatted = decimals > 0 ? value.toFixed(decimals) : Math.floor(value).toLocaleString();
    return <span ref={ref}>{formatted}</span>;
}

function ActivityFeed() {
    const [items, setItems] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setItems((prev) => (prev + 1) % 4);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    const events = [
        { name: "Karim Hassan", action: "checked in", time: "8:42 AM", color: P.emerald },
        { name: "Ayesha Rahman", action: "leave approved", time: "8:35 AM", color: P.blueBright },
        { name: "Mohammad Ali", action: "payslip generated", time: "8:28 AM", color: P.violet },
        { name: "Fatima Begum", action: "expense submitted", time: "8:15 AM", color: P.amber },
    ];

    return (
        <div
            className="rounded-lg p-3.5"
            style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${P.border}`,
            }}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-semibold" style={{ color: P.heading }}>Live Activity</div>
                <div className="text-[9px] font-mono" style={{ color: P.emerald }}>● streaming</div>
            </div>
            <div className="space-y-2.5">
                {events.slice(0, 3).map((event, i) => (
                    <motion.div
                        key={`${event.name}-${items}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: i === 0 ? 1 : 0.7 - i * 0.15, x: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.05 }}
                        className="flex items-center gap-2"
                    >
                        <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ background: event.color }}
                        >
                            {event.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate" style={{ color: P.heading }}>
                                {event.name}
                            </div>
                            <div className="text-[9px]" style={{ color: P.muted }}>
                                {event.action}
                            </div>
                        </div>
                        <div className="text-[9px] font-mono" style={{ color: P.subtle }}>
                            {event.time}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function AttendanceChart() {
    const [heights] = useState(() => Array.from({ length: 14 }, () => 40 + Math.random() * 60));

    return (
        <div
            className="rounded-lg p-3.5"
            style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${P.border}`,
            }}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] font-semibold" style={{ color: P.heading }}>Attendance — 14 days</div>
                <div className="text-[9px] font-mono" style={{ color: P.emerald }}>↑ 91.8% avg</div>
            </div>
            <div className="flex items-end justify-between gap-1 h-[88px]">
                {heights.map((h, i) => (
                    <motion.div
                        key={i}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.6, delay: 0.6 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                        className="flex-1 rounded-t"
                        style={{
                            background: i === heights.length - 1
                                ? P.gradBrand
                                : `linear-gradient(to top, ${P.blueDim}, rgba(59,130,246,0.4))`,
                        }}
                    />
                ))}
            </div>
            <div className="flex justify-between mt-1.5 text-[8px] font-mono" style={{ color: P.subtle }}>
                <span>Jun 20</span>
                <span>Jul 4</span>
            </div>
        </div>
    );
}
