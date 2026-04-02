"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
    Shield,
    GitBranch,
    Wifi,
    Gift,
    Clock,
    Lock,
    ChevronRight,
    Check,
    ArrowRight,
    Menu,
    X,
    Users,
    BarChart3,
    Calendar,
    Zap,
    Star,
    Fingerprint,
    Building2,
    Globe,
    TrendingUp,
    Award,
    Sparkles,
    Play,
    ChevronDown,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   PeopleFlow — Enterprise Landing Page v2.5
   Aesthetic: Vercel/Linear Dark × Gradient Mesh × Micro-Animations
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Intersection Observer Hook ────────────────────────────────────────────
function useInView(threshold = 0.1) {
    const ref = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [threshold]);

    return { ref, isInView };
}

// ── Animated Counter ──────────────────────────────────────────────────────
function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const started = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started.current) {
                started.current = true;
                let current = 0;
                const step = target / 40;
                const interval = setInterval(() => {
                    current += step;
                    if (current >= target) {
                        setCount(target);
                        clearInterval(interval);
                    } else {
                        setCount(Math.floor(current));
                    }
                }, 30);
            }
        }, { threshold: 0.3 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target]);

    return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ── Color Palette ─────────────────────────────────────────────────────────
const P = {
    bg: "#06060B",
    surface: "#0C0C14",
    border: "rgba(255,255,255,0.06)",
    muted: "#71717A",
    accent1: "#3B82F6",  // Blue
    accent2: "#6366F1",  // Indigo
    accent3: "#8B5CF6",  // Violet
    accent4: "#10B981",  // Emerald
    accent5: "#F59E0B",  // Amber
    accent6: "#F43F5E",  // Rose
};

// ── Navigation ────────────────────────────────────────────────────────────
function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { label: "Features", href: "#features" },
        { label: "Why PeopleFlow", href: "#why" },
        { label: "Pricing", href: "#pricing" },
    ];

    return (
        <nav
            id="nav-main"
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
                scrolled
                    ? "py-3 bg-[#06060B]/85 backdrop-blur-2xl border-b border-white/[0.04] shadow-[0_1px_40px_rgba(0,0,0,0.3)]"
                    : "py-5 bg-transparent"
            }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 group">
                    <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_35px_rgba(99,102,241,0.6)] transition-all duration-300">
                        <Zap className="w-4.5 h-4.5 text-white" />
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <span className="text-lg font-bold text-white tracking-tight">
                        People<span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">Flow</span>
                    </span>
                </Link>

                {/* Desktop Nav */}
                <div className="hidden md:flex items-center gap-1">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            className="px-4 py-2 rounded-lg text-sm text-[#A1A1AA] hover:text-white hover:bg-white/[0.04] transition-all duration-200"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>

                {/* Desktop CTAs */}
                <div className="hidden md:flex items-center gap-3">
                    <Link
                        href="/login"
                        className="px-4 py-2 rounded-lg text-sm text-[#A1A1AA] hover:text-white transition-colors duration-200"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="/register"
                        className="relative text-sm px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all duration-300 hover:scale-[1.03] overflow-hidden group"
                    >
                        <span className="relative z-10">Start Free Trial</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </Link>
                </div>

                {/* Mobile Toggle */}
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="md:hidden text-white p-2 rounded-lg hover:bg-white/5"
                    aria-label="Toggle menu"
                >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-[#06060B]/98 backdrop-blur-2xl border-t border-white/[0.04]">
                    <div className="px-6 py-6 flex flex-col gap-2">
                        {navLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className="text-[#A1A1AA] hover:text-white text-base py-3 px-4 rounded-lg hover:bg-white/5 transition-all"
                            >
                                {link.label}
                            </a>
                        ))}
                        <div className="pt-4 flex flex-col gap-3 border-t border-white/[0.04] mt-2">
                            <Link href="/login" className="text-[#A1A1AA] hover:text-white py-3 px-4 rounded-lg">
                                Sign In
                            </Link>
                            <Link
                                href="/register"
                                className="text-center px-5 py-3.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold"
                            >
                                Start Free Trial
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}

// ── Hero Section ──────────────────────────────────────────────────────────
function HeroSection() {
    const { ref, isInView } = useInView(0.05);

    return (
        <section
            id="hero"
            ref={ref}
            className="relative min-h-[100vh] flex items-center pt-28 pb-24 overflow-hidden"
            style={{ background: `radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 60%), ${P.bg}` }}
        >
            {/* Animated Gradient Mesh */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-30%] right-[-15%] w-[800px] h-[800px] rounded-full opacity-30 animate-[pulse_8s_ease-in-out_infinite]"
                    style={{ background: "radial-gradient(circle, rgba(59,130,246,0.15), transparent 70%)" }} />
                <div className="absolute bottom-[-30%] left-[-15%] w-[700px] h-[700px] rounded-full opacity-25 animate-[pulse_10s_ease-in-out_infinite_1s]"
                    style={{ background: "radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)" }} />
                <div className="absolute top-[20%] left-[50%] w-[500px] h-[500px] rounded-full opacity-20 animate-[pulse_12s_ease-in-out_infinite_2s]"
                    style={{ background: "radial-gradient(circle, rgba(99,102,241,0.1), transparent 70%)" }} />
            </div>

            {/* Fine Grid */}
            <div
                className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
                    backgroundSize: "64px 64px",
                }}
            />

            <div className="relative max-w-7xl mx-auto px-6 w-full">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Badge */}
                    <div
                        className={`inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm mb-10 transition-all duration-1000 ${
                            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                        }`}
                    >
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                            <span className="text-xs font-semibold text-[#10B981] uppercase tracking-wider">Live</span>
                        </div>
                        <div className="w-px h-3.5 bg-white/10" />
                        <span className="text-sm text-[#ADC6FF] font-medium">
                            🇧🇩 The #1 HRMS Built for Bangladesh
                        </span>
                    </div>

                    {/* Headline */}
                    <h1
                        className={`text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-bold leading-[1.05] tracking-[-0.03em] text-white mb-8 transition-all duration-1000 delay-100 ${
                            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        }`}
                    >
                        Your People Deserve{" "}
                        <br className="hidden sm:block" />
                        <span className="relative">
                            <span className="bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">
                                Enterprise HR
                            </span>
                            <svg className="absolute -bottom-2 left-0 w-full h-3 opacity-30" viewBox="0 0 300 12" fill="none">
                                <path d="M2 10C50 3 100 3 150 6C200 9 250 4 298 7" stroke="url(#ug)" strokeWidth="3" strokeLinecap="round" />
                                <defs><linearGradient id="ug" x1="0" x2="300" y1="0" y2="0"><stop stopColor="#3B82F6" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
                            </svg>
                        </span>
                    </h1>

                    {/* Subheadline */}
                    <p
                        className={`text-lg sm:text-xl text-[#9CA3AF] leading-relaxed max-w-2xl mx-auto mb-12 transition-all duration-1000 delay-200 ${
                            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        }`}
                    >
                        BLA 2006 compliant payroll. Biometric attendance that syncs from any office.
                        Multi-level approval workflows. All in one beautiful platform built for
                        Bangladesh&apos;s RMG, Corporate, and NGO sectors.
                    </p>

                    {/* CTAs */}
                    <div
                        className={`flex flex-wrap justify-center gap-4 mb-16 transition-all duration-1000 delay-300 ${
                            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        }`}
                    >
                        <Link
                            href="/register"
                            className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold text-base shadow-[0_0_40px_rgba(59,130,246,0.35)] hover:shadow-[0_0_60px_rgba(59,130,246,0.55)] transition-all duration-400 hover:scale-[1.04]"
                        >
                            Start Free — 14 Days
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-200" />
                        </Link>
                        <a
                            href="#features"
                            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white font-semibold text-base hover:bg-white/[0.08] hover:border-white/[0.18] transition-all duration-300 backdrop-blur-sm"
                        >
                            <Play className="w-4 h-4 text-[#6366F1]" />
                            See How It Works
                        </a>
                    </div>

                    {/* Social Proof */}
                    <div
                        className={`flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 transition-all duration-1000 delay-400 ${
                            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2.5">
                                {[
                                    "linear-gradient(135deg, #3B82F6, #2563EB)",
                                    "linear-gradient(135deg, #6366F1, #4F46E5)",
                                    "linear-gradient(135deg, #10B981, #059669)",
                                    "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                                    "linear-gradient(135deg, #F59E0B, #D97706)",
                                ].map((bg, i) => (
                                    <div
                                        key={i}
                                        className="w-9 h-9 rounded-full border-[2.5px] border-[#06060B] flex items-center justify-center text-xs font-bold text-white shadow-lg"
                                        style={{ background: bg }}
                                    >
                                        {["A", "R", "K", "S", "M"][i]}
                                    </div>
                                ))}
                            </div>
                            <span className="text-sm text-[#71717A]">
                                Trusted by <span className="text-white font-semibold">500+</span> orgs
                            </span>
                        </div>
                        <div className="hidden sm:block w-px h-6 bg-white/10" />
                        <div className="flex items-center gap-1.5">
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} className="w-4 h-4 fill-[#F59E0B] text-[#F59E0B]" />
                            ))}
                            <span className="text-sm text-[#71717A] ml-1">4.9/5 rating</span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Preview */}
                <div
                    className={`mt-20 transition-all duration-1000 delay-500 ${
                        isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"
                    }`}
                >
                    <DashboardPreview />
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
                    <ChevronDown className="w-5 h-5 text-white/20" />
                </div>
            </div>
        </section>
    );
}

// ── Dashboard Preview ─────────────────────────────────────────────────────
function DashboardPreview() {
    return (
        <div className="relative max-w-5xl mx-auto">
            {/* Glow */}
            <div className="absolute -inset-8 bg-gradient-to-br from-[#3B82F6]/15 via-[#6366F1]/10 to-[#8B5CF6]/8 rounded-[2rem] blur-3xl" />

            {/* Browser Frame */}
            <div className="relative rounded-2xl bg-[#0C0C14] border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Title Bar */}
                <div className="flex items-center gap-2 px-5 py-3.5 bg-[#0A0A12] border-b border-white/[0.05]">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                    </div>
                    <div className="flex-1 flex justify-center">
                        <div className="px-4 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-[#52525B]">
                            drdf.ailearnersbd.com/dashboard
                        </div>
                    </div>
                </div>

                {/* Dashboard Content */}
                <div className="p-6 grid grid-cols-4 gap-4">
                    {/* Stat Cards */}
                    {[
                        { label: "Total Employees", value: "1,247", change: "+12%", icon: Users, color: "#3B82F6" },
                        { label: "Attendance Rate", value: "96.8%", change: "+2.4%", icon: BarChart3, color: "#10B981" },
                        { label: "Payroll Processed", value: "৳48.2M", change: "On Time", icon: Calendar, color: "#8B5CF6" },
                        { label: "Active Devices", value: "24", change: "All Live", icon: Fingerprint, color: "#F59E0B" },
                    ].map((m) => (
                        <div key={m.label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 hover:bg-white/[0.05] transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <m.icon className="w-5 h-5" style={{ color: m.color }} />
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: m.color, background: `${m.color}15` }}>{m.change}</span>
                            </div>
                            <p className="text-2xl font-bold text-white">{m.value}</p>
                            <p className="text-xs text-[#52525B] mt-1">{m.label}</p>
                        </div>
                    ))}

                    {/* Chart Area */}
                    <div className="col-span-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <p className="text-sm font-medium text-white">Payroll Trend</p>
                                <p className="text-xs text-[#52525B]">Last 12 months</p>
                            </div>
                            <div className="flex gap-3 text-xs text-[#52525B]">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#3B82F6]" />Gross</span>
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#10B981]" />Net</span>
                            </div>
                        </div>
                        <div className="flex items-end gap-2 h-24">
                            {[35, 55, 45, 65, 50, 70, 60, 80, 68, 85, 75, 92].map((h, i) => (
                                <div key={i} className="flex-1 flex flex-col gap-0.5">
                                    <div className="rounded-t-sm" style={{ height: `${h}%`, background: i === 11 ? "linear-gradient(to top, #3B82F6, #6366F1)" : "rgba(59,130,246,0.15)" }} />
                                    <div className="rounded-t-sm" style={{ height: `${h * 0.7}%`, background: i === 11 ? "linear-gradient(to top, #10B981, #059669)" : "rgba(16,185,129,0.1)" }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar Widget */}
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                        <p className="text-xs font-medium text-white mb-3">Quick Actions</p>
                        {["Process Payroll", "Approve Leave", "Sync Devices"].map((action, i) => (
                            <div key={action} className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer mb-1">
                                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: [P.accent1, P.accent4, P.accent5][i] + "20" }}>
                                    {[Calendar, Check, Wifi][i] && <div className="w-2 h-2 rounded-full" style={{ background: [P.accent1, P.accent4, P.accent5][i] }} />}
                                </div>
                                <span className="text-xs text-[#A1A1AA]">{action}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Floating Badges */}
            <div className="absolute -top-5 -right-5 px-4 py-2.5 rounded-xl bg-[#10B981]/15 border border-[#10B981]/25 backdrop-blur-xl flex items-center gap-2 animate-[float_6s_ease-in-out_infinite] shadow-[0_10px_40px_rgba(16,185,129,0.15)]">
                <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="text-xs font-semibold text-[#10B981]">All Systems Active</span>
            </div>
            <div className="absolute -bottom-5 -left-5 px-4 py-2.5 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/25 backdrop-blur-xl flex items-center gap-2 animate-[float_6s_ease-in-out_infinite_2s] shadow-[0_10px_40px_rgba(99,102,241,0.15)]">
                <Shield className="w-3.5 h-3.5 text-[#A5B4FC]" />
                <span className="text-xs font-semibold text-[#A5B4FC]">BLA 2006 Compliant</span>
            </div>
        </div>
    );
}

// ── Stats Banner ──────────────────────────────────────────────────────────
function StatsBanner() {
    const { ref, isInView } = useInView(0.2);

    const stats = [
        { value: 500, suffix: "+", label: "Organizations", icon: Building2 },
        { value: 50000, suffix: "+", label: "Employees Managed", icon: Users },
        { value: 99, suffix: ".9%", label: "Uptime SLA", icon: TrendingUp },
        { value: 24, suffix: "/7", label: "Support Access", icon: Globe },
    ];

    return (
        <section
            ref={ref}
            className={`py-20 border-y border-white/[0.04] transition-all duration-1000 ${
                isInView ? "opacity-100" : "opacity-0"
            }`}
            style={{ background: `linear-gradient(180deg, ${P.bg}, ${P.surface}, ${P.bg})` }}
        >
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {stats.map((stat, i) => (
                        <div key={stat.label} className="text-center group" style={{ transitionDelay: `${i * 100}ms` }}>
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-4 group-hover:border-[#3B82F6]/30 group-hover:bg-[#3B82F6]/5 transition-all duration-300">
                                <stat.icon className="w-5 h-5 text-[#52525B] group-hover:text-[#3B82F6] transition-colors" />
                            </div>
                            <p className="text-3xl sm:text-4xl font-bold text-white mb-1">
                                <AnimatedNumber target={stat.value} suffix={stat.suffix} />
                            </p>
                            <p className="text-sm text-[#71717A]">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── Features Section ──────────────────────────────────────────────────────
function FeaturesSection() {
    const { ref, isInView } = useInView(0.05);

    const features = [
        {
            icon: Shield,
            title: "BLA 2006 Auto-Compliance",
            description: "Maternity pre/post split, earned leave pro-rata, festival bonus calculations. Every payslip is legally bulletproof.",
            color: "#3B82F6",
            tag: "Compliance",
        },
        {
            icon: Fingerprint,
            title: "Zero-Friction Biometric Sync",
            description: "Cloud-to-LAN bridge syncs ZKTeco attendance data every 5 minutes. One-click setup, no IT team required.",
            color: "#10B981",
            tag: "New",
        },
        {
            icon: GitBranch,
            title: "Stateful Approval Engine",
            description: "Multi-level workflows with audit trail. Survives server restarts. Supports branching, delegation, and escalation.",
            color: "#6366F1",
            tag: "Workflow",
        },
        {
            icon: Gift,
            title: "Festival Bonus Engine",
            description: "Bulk Eid/Puja bonus generation with pro-rata calculations, eligibility checks, and automatic payroll inclusion.",
            color: "#F59E0B",
            tag: "Payroll",
        },
        {
            icon: Clock,
            title: "Tiered Late Deductions",
            description: "Grace → Warning → Half-day → Full-day progressive tiers. Fully configurable per shift and organization.",
            color: "#F43F5E",
            tag: "Attendance",
        },
        {
            icon: Lock,
            title: "Deep RBAC Permissions",
            description: "Department-scoped, time-bounded delegation. Beyond flat roles — enterprise access control that actually works.",
            color: "#8B5CF6",
            tag: "Security",
        },
    ];

    return (
        <section id="features" ref={ref} className="py-28 sm:py-36 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-30 pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06), transparent 70%)" }} />

            <div className="relative max-w-7xl mx-auto px-6">
                {/* Header */}
                <div className={`text-center max-w-2xl mx-auto mb-20 transition-all duration-1000 ${
                    isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] mb-7">
                        <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                        <span className="text-sm text-[#ADC6FF] font-medium">Bangladesh-Specific Superpowers</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white tracking-tight leading-[1.15] mb-5">
                        Features That Win{" "}
                        <span className="bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">
                            Market Dominance
                        </span>
                    </h2>
                    <p className="text-[#9CA3AF] text-lg leading-relaxed">
                        Every feature is stress-tested against Bangladesh&apos;s most demanding RMG, Corporate, and NGO requirements.
                    </p>
                </div>

                {/* Feature Grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {features.map((feature, index) => (
                        <div
                            key={feature.title}
                            className={`group relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-7 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-500 cursor-default ${
                                isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                            }`}
                            style={{ transitionDelay: isInView ? `${index * 80}ms` : "0ms" }}
                        >
                            {/* Tag */}
                            <div className="absolute top-5 right-5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border"
                                    style={{ color: feature.color, borderColor: `${feature.color}30`, background: `${feature.color}08` }}>
                                    {feature.tag}
                                </span>
                            </div>

                            {/* Icon */}
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg"
                                style={{ background: `${feature.color}12`, boxShadow: `0 0 0 1px ${feature.color}15` }}>
                                <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                            </div>

                            {/* Content */}
                            <h3 className="text-lg font-semibold text-white mb-2.5">{feature.title}</h3>
                            <p className="text-sm text-[#9CA3AF] leading-relaxed">{feature.description}</p>

                            {/* Hover Arrow */}
                            <div className="mt-5 flex items-center gap-1.5 text-[#52525B] group-hover:text-white transition-all duration-300">
                                <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Learn more</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── Why PeopleFlow Section ────────────────────────────────────────────────
function WhySection() {
    const { ref, isInView } = useInView(0.1);

    const reasons = [
        {
            title: "Born in Bangladesh",
            description: "Not a \"localized\" foreign product. Every business rule, every UI label, every compliance check is built from scratch for BD regulations.",
            icon: "🇧🇩",
        },
        {
            title: "One-Click Biometric Setup",
            description: "Your HR admin downloads a script, enters the device IP, and attendance data flows to the cloud. No VPN, no port forwarding, no IT team.",
            icon: "⚡",
        },
        {
            title: "Payroll That Never Fails",
            description: "Provident Fund, gratuity, tax, festival bonuses — automatically calculated per BLA 2006. Generate bank files in seconds.",
            icon: "💰",
        },
    ];

    return (
        <section id="why" ref={ref} className="py-28 relative" style={{ background: `linear-gradient(180deg, ${P.surface}, ${P.bg})` }}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    {/* Left */}
                    <div className={`transition-all duration-1000 ${isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] mb-7">
                            <Award className="w-3.5 h-3.5 text-[#6366F1]" />
                            <span className="text-sm text-[#ADC6FF] font-medium">Why Market Leaders Choose Us</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white tracking-tight leading-[1.15] mb-6">
                            Not Another Generic{" "}
                            <span className="bg-gradient-to-r from-[#F43F5E] to-[#F59E0B] bg-clip-text text-transparent">HR Tool</span>
                        </h2>
                        <p className="text-[#9CA3AF] text-lg leading-relaxed mb-10">
                            International HRMS platforms charge premium prices, then make you &quot;configure&quot; everything.
                            PeopleFlow works out of the box for Bangladesh.
                        </p>

                        <div className="space-y-6">
                            {reasons.map((reason, i) => (
                                <div key={reason.title} className={`flex items-start gap-4 transition-all duration-700 ${
                                    isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                                }`} style={{ transitionDelay: `${i * 150}ms` }}>
                                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-lg shrink-0">
                                        {reason.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-white mb-1">{reason.title}</h3>
                                        <p className="text-sm text-[#9CA3AF] leading-relaxed">{reason.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Visual */}
                    <div className={`transition-all duration-1000 delay-200 ${isInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
                        <div className="relative rounded-2xl bg-gradient-to-br from-[#3B82F6]/[0.06] to-[#8B5CF6]/[0.04] border border-white/[0.08] p-8">
                            <div className="space-y-4">
                                {/* Comparison */}
                                {[
                                    { label: "Setup Time", us: "5 minutes", them: "2-3 weeks", usColor: "#10B981", themColor: "#F43F5E" },
                                    { label: "BD Compliance", us: "Built-in", them: "Manual Config", usColor: "#10B981", themColor: "#F59E0B" },
                                    { label: "Biometric Sync", us: "One-Click", them: "IT Required", usColor: "#10B981", themColor: "#F43F5E" },
                                    { label: "Festival Bonuses", us: "Automated", them: "Spreadsheet", usColor: "#10B981", themColor: "#F43F5E" },
                                    { label: "Bangla UI", us: "Native", them: "Partial", usColor: "#10B981", themColor: "#F59E0B" },
                                ].map((row) => (
                                    <div key={row.label} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                        <span className="text-sm text-[#71717A] w-32 shrink-0">{row.label}</span>
                                        <div className="flex-1 flex items-center gap-2">
                                            <Check className="w-4 h-4" style={{ color: row.usColor }} />
                                            <span className="text-sm font-medium" style={{ color: row.usColor }}>{row.us}</span>
                                        </div>
                                        <div className="flex-1 flex items-center gap-2 opacity-50">
                                            <X className="w-4 h-4" style={{ color: row.themColor }} />
                                            <span className="text-sm" style={{ color: row.themColor }}>{row.them}</span>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between text-xs text-[#52525B] px-4 pt-2">
                                    <span></span>
                                    <span className="text-[#3B82F6] font-semibold">PeopleFlow</span>
                                    <span>Others</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ── Pricing Section ───────────────────────────────────────────────────────
function PricingSection() {
    const [annual, setAnnual] = useState(false);
    const { ref, isInView } = useInView(0.1);

    const plans = [
        {
            name: "Starter",
            price: annual ? "2,399" : "2,999",
            period: "/mo",
            description: "For small teams getting started",
            features: ["Up to 50 employees", "Core HR & Attendance", "Basic Payroll", "Leave Management", "Email Support"],
            cta: "Get Started",
            popular: false,
        },
        {
            name: "Growth",
            price: annual ? "6,399" : "7,999",
            period: "/mo",
            description: "For growing companies that need power",
            features: ["Up to 200 employees", "Everything in Starter", "Advanced Payroll + PF", "Approval Workflows", "Festival Bonus Engine", "Biometric Sync", "Priority Support"],
            cta: "Start Free Trial",
            popular: true,
        },
        {
            name: "Enterprise",
            price: "Custom",
            period: "",
            description: "For large organizations",
            features: ["Unlimited employees", "Everything in Growth", "Multi-Branch Support", "Custom BLA Compliance", "Deep RBAC Permissions", "Dedicated Account Manager", "SLA & On-premise"],
            cta: "Contact Sales",
            popular: false,
        },
    ];

    return (
        <section id="pricing" ref={ref} className="py-28 sm:py-36 relative">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.04), transparent 60%)" }} />

            <div className="relative max-w-7xl mx-auto px-6">
                {/* Header */}
                <div className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-1000 ${
                    isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}>
                    <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white tracking-tight leading-[1.15] mb-5">
                        Transparent,{" "}
                        <span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">Fair Pricing</span>
                    </h2>
                    <p className="text-[#9CA3AF] text-lg mb-10">
                        No hidden fees. No per-employee surcharges. Scale at your own pace.
                    </p>

                    {/* Toggle */}
                    <div className="inline-flex items-center p-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
                        <button
                            onClick={() => setAnnual(false)}
                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                                !annual ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white shadow-lg" : "text-[#71717A] hover:text-white"
                            }`}
                        >
                            Monthly
                        </button>
                        <button
                            onClick={() => setAnnual(true)}
                            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                                annual ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white shadow-lg" : "text-[#71717A] hover:text-white"
                            }`}
                        >
                            Annual <span className="ml-1 text-xs text-[#10B981]">-20%</span>
                        </button>
                    </div>
                </div>

                {/* Cards */}
                <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {plans.map((plan, index) => (
                        <div
                            key={plan.name}
                            className={`relative rounded-2xl p-8 transition-all duration-500 ${
                                plan.popular
                                    ? "bg-gradient-to-b from-[#3B82F6]/[0.08] to-[#6366F1]/[0.04] border-2 border-[#3B82F6]/30 scale-[1.03] shadow-[0_0_80px_rgba(59,130,246,0.12)]"
                                    : "bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12]"
                            } ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                            style={{ transitionDelay: isInView ? `${index * 120}ms` : "0ms" }}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-xs font-bold text-white shadow-lg">
                                    Most Popular
                                </div>
                            )}
                            <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                            <p className="text-sm text-[#71717A] mb-6">{plan.description}</p>
                            <div className="flex items-baseline gap-1 mb-7">
                                {plan.price !== "Custom" && <span className="text-[#3B82F6] text-lg font-bold">৳</span>}
                                <span className="text-4xl font-bold text-white">{plan.price}</span>
                                {plan.period && <span className="text-[#71717A] text-sm">{plan.period}</span>}
                            </div>
                            <Link
                                href={plan.name === "Enterprise" ? "#" : "/register"}
                                className={`block w-full text-center py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 mb-8 ${
                                    plan.popular
                                        ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:scale-[1.02]"
                                        : "bg-white/[0.05] text-white border border-white/[0.1] hover:bg-white/[0.1]"
                                }`}
                            >
                                {plan.cta}
                            </Link>
                            <ul className="space-y-3.5">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: plan.popular ? "#3B82F615" : "#FFFFFF08" }}>
                                            <Check className="w-3 h-3" style={{ color: plan.popular ? "#3B82F6" : "#52525B" }} />
                                        </div>
                                        <span className="text-sm text-[#A1A1AA]">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── CTA Section ───────────────────────────────────────────────────────────
function CTASection() {
    const { ref, isInView } = useInView(0.2);

    return (
        <section
            ref={ref}
            className={`py-28 transition-all duration-1000 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
            <div className="max-w-4xl mx-auto px-6">
                <div className="relative rounded-3xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/20 via-[#6366F1]/15 to-[#8B5CF6]/10" />
                    <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.15), transparent 60%)` }} />
                    <div className="absolute inset-0 bg-[#06060B]/60 backdrop-blur-sm" />

                    <div className="relative text-center px-8 py-20 sm:py-24">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] mb-8">
                            <Zap className="w-4 h-4 text-[#F59E0B]" />
                            <span className="text-sm text-white/80 font-medium">14-day free trial — no credit card required</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5">
                            Ready to Transform{" "}
                            <span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">Your HR?</span>
                        </h2>
                        <p className="text-[#9CA3AF] text-lg max-w-md mx-auto mb-10">
                            Join 500+ organizations across Bangladesh who have upgraded to enterprise-grade HR.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <Link
                                href="/register"
                                className="group inline-flex items-center gap-2.5 px-9 py-4 rounded-2xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold text-base shadow-[0_0_40px_rgba(59,130,246,0.4)] hover:shadow-[0_0_60px_rgba(59,130,246,0.6)] transition-all duration-300 hover:scale-[1.04]"
                            >
                                Start Free Trial
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

// ── Footer ────────────────────────────────────────────────────────────────
function Footer() {
    const columns = [
        {
            title: "Product",
            links: [
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "Integrations", href: "#" },
                { label: "Changelog", href: "#" },
            ],
        },
        {
            title: "Company",
            links: [
                { label: "About Us", href: "#" },
                { label: "Careers", href: "/careers" },
                { label: "Blog", href: "#" },
                { label: "Contact", href: "#" },
            ],
        },
        {
            title: "Legal",
            links: [
                { label: "Privacy Policy", href: "#" },
                { label: "Terms of Service", href: "#" },
                { label: "Data Processing", href: "#" },
            ],
        },
    ];

    return (
        <footer className="border-t border-white/[0.04] pt-16 pb-10" style={{ background: P.bg }}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
                    {/* Brand */}
                    <div className="col-span-2">
                        <Link href="/" className="flex items-center gap-2.5 mb-5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center">
                                <Zap className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-lg font-bold text-white">PeopleFlow</span>
                        </Link>
                        <p className="text-sm text-[#71717A] leading-relaxed max-w-xs mb-6">
                            Enterprise HR Management, engineered for Bangladesh. BLA 2006 compliant payroll, biometric attendance, and multi-level approvals.
                        </p>
                        <div className="flex gap-4">
                            {["Twitter", "LinkedIn", "GitHub"].map((social) => (
                                <a key={social} href="#" className="text-[#52525B] hover:text-white text-xs transition-colors">{social}</a>
                            ))}
                        </div>
                    </div>

                    {/* Link Columns */}
                    {columns.map((col) => (
                        <div key={col.title}>
                            <h4 className="text-sm font-semibold text-white mb-5">{col.title}</h4>
                            <ul className="space-y-3">
                                {col.links.map((link) => (
                                    <li key={link.label}>
                                        <a href={link.href} className="text-sm text-[#71717A] hover:text-white transition-colors duration-200">
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-[#52525B]">
                        © {new Date().getFullYear()} PeopleFlow. All rights reserved.
                    </p>
                    <p className="text-sm text-[#52525B]">
                        Made with ❤️ in Bangladesh 🇧🇩
                    </p>
                </div>
            </div>
        </footer>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function MarketingPage() {
    return (
        <main className="min-h-screen" style={{ background: P.bg, color: "white" }}>
            <style jsx global>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-12px); }
                }
            `}</style>
            <Navbar />
            <HeroSection />
            <StatsBanner />
            <FeaturesSection />
            <WhySection />
            <PricingSection />
            <CTASection />
            <Footer />
        </main>
    );
}
