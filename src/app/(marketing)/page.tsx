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
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   PeopleFlow Marketing Landing Page
   Aesthetic: Stripe-meets-Linear | Dark-mode | Glassmorphism | Blue/Indigo
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
    { label: "Pricing", href: "#pricing" },
    { label: "About", href: "#about" },
    { label: "Contact", href: "#contact" },
  ];

  return (
    <nav
      id="nav-main"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "py-3 bg-[#0A0A0F]/80 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.05)]"
          : "py-5 bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#6366F1] flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)] group-hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-shadow duration-300">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">
            PeopleFlow
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-[#A1A1AA] hover:text-white transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm text-[#A1A1AA] hover:text-white transition-colors"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="text-sm px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-medium hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all duration-300 hover:scale-[1.02]"
          >
            Book a Demo
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-white p-2"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#0A0A0F]/95 backdrop-blur-xl border-t border-white/5 animate-fade-in">
          <div className="px-6 py-6 flex flex-col gap-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-[#A1A1AA] hover:text-white text-base py-2 transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <Link href="/login" className="text-[#A1A1AA] hover:text-white py-2">
                Login
              </Link>
              <Link
                href="/register"
                className="text-center px-5 py-3 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-medium"
              >
                Book a Demo
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
  const { ref, isInView } = useInView(0.1);

  return (
    <section
      id="hero"
      ref={ref}
      className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden"
    >
      {/* Background Gradient Orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full bg-[#3B82F6]/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#6366F1]/6 blur-[100px]" />
        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full bg-[#8B5CF6]/4 blur-[80px]" />
      </div>

      {/* Grid Pattern Background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left: Copy */}
        <div
          className={`transition-all duration-1000 ${
            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm mb-8">
            <span className="text-base">🇧🇩</span>
            <span className="text-sm text-[#ADC6FF] font-medium">
              Built for Bangladesh
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.08] tracking-tight text-white mb-6">
            Enterprise HR,
            <br />
            Engineered for{" "}
            <span className="bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">
              Bangladesh
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-[#A1A1AA] leading-relaxed max-w-lg mb-10">
            The only HRMS with BLA 2006 compliance, automated festival bonuses,
            and 3-tier biometric resilience. Built for RMG, Corporate, and NGO
            sectors.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold text-base shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] transition-all duration-300 hover:scale-[1.03]"
            >
              Book a Demo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/15 text-white font-semibold text-base hover:bg-white/5 hover:border-white/25 transition-all duration-300"
            >
              View Pricing
            </a>
          </div>

          {/* Social Proof Micro */}
          <div className="flex items-center gap-3 mt-10 text-sm text-[#71717A]">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-[#0A0A0F] flex items-center justify-center text-xs font-bold"
                  style={{
                    background: [
                      "linear-gradient(135deg, #3B82F6, #6366F1)",
                      "linear-gradient(135deg, #6366F1, #8B5CF6)",
                      "linear-gradient(135deg, #10B981, #059669)",
                      "linear-gradient(135deg, #F59E0B, #D97706)",
                    ][i],
                  }}
                >
                  {["A", "R", "K", "S"][i]}
                </div>
              ))}
            </div>
            <span>
              Trusted by <span className="text-white font-medium">500+</span>{" "}
              organizations
            </span>
          </div>
        </div>

        {/* Right: Dashboard Mockup */}
        <div
          className={`relative transition-all duration-1000 delay-200 ${
            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          }`}
        >
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}

// ── Floating Dashboard Mockup ─────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="relative">
      {/* Glow behind card */}
      <div className="absolute -inset-4 bg-gradient-to-br from-[#3B82F6]/20 to-[#6366F1]/15 rounded-3xl blur-2xl" />

      {/* Main Card */}
      <div className="relative rounded-2xl bg-[#1C1C24]/90 backdrop-blur-xl border border-white/10 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-[#71717A]">Dashboard</p>
            <p className="text-white font-semibold">March 2026</p>
          </div>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
            <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
            <div className="w-3 h-3 rounded-full bg-[#10B981]/60" />
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {
              label: "Total Employees",
              value: "1,247",
              change: "+12%",
              icon: Users,
              color: "#3B82F6",
            },
            {
              label: "Attendance Rate",
              value: "96.8%",
              change: "+2.4%",
              icon: BarChart3,
              color: "#10B981",
            },
            {
              label: "Payroll Processed",
              value: "৳48.2M",
              change: "On Time",
              icon: Calendar,
              color: "#8B5CF6",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4"
            >
              <m.icon
                className="w-5 h-5 mb-2"
                style={{ color: m.color }}
              />
              <p className="text-xl font-bold text-white">{m.value}</p>
              <p className="text-xs text-[#71717A] mt-1">{m.label}</p>
              <span
                className="text-xs font-medium mt-2 inline-block"
                style={{ color: m.color }}
              >
                {m.change}
              </span>
            </div>
          ))}
        </div>

        {/* Mini Chart Placeholder */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-[#A1A1AA]">Monthly Payroll Trend</p>
            <span className="text-xs text-[#3B82F6]">View All</span>
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {[40, 65, 55, 75, 60, 85, 70, 90, 80, 95, 88, 92].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all duration-500"
                style={{
                  height: `${h}%`,
                  background:
                    i === 11
                      ? "linear-gradient(to top, #3B82F6, #6366F1)"
                      : "rgba(255,255,255,0.06)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Floating Badge */}
      <div className="absolute -top-4 -right-4 px-4 py-2 rounded-xl bg-[#10B981]/20 border border-[#10B981]/30 backdrop-blur-sm flex items-center gap-2 animate-float">
        <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
        <span className="text-xs font-medium text-[#10B981]">
          All Shifts Active
        </span>
      </div>

      {/* Floating Approval */}
      <div className="absolute -bottom-4 -left-4 px-4 py-2 rounded-xl bg-[#6366F1]/20 border border-[#6366F1]/30 backdrop-blur-sm flex items-center gap-2 animate-float-delayed">
        <Shield className="w-3 h-3 text-[#ADC6FF]" />
        <span className="text-xs font-medium text-[#ADC6FF]">
          3 Pending Approvals
        </span>
      </div>
    </div>
  );
}

// ── Trust Banner ──────────────────────────────────────────────────────────
function TrustBanner() {
  const { ref, isInView } = useInView(0.2);

  const logos = [
    "ACI Group",
    "BRAC",
    "Square Group",
    "Walton",
    "Grameenphone",
    "BEXIMCO",
  ];

  return (
    <section
      id="about"
      ref={ref}
      className={`py-16 border-y border-white/[0.04] transition-all duration-1000 ${
        isInView ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-sm text-[#71717A] mb-8 tracking-wide uppercase">
          Trusted by 500+ Organizations Across Bangladesh
        </p>
        <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-6">
          {logos.map((name) => (
            <div
              key={name}
              className="text-[#52525B] text-lg font-semibold tracking-tight opacity-40 hover:opacity-70 transition-opacity duration-300 cursor-default"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features Grid ─────────────────────────────────────────────────────────
function FeaturesSection() {
  const { ref, isInView } = useInView(0.1);

  const features = [
    {
      icon: Shield,
      title: "BLA 2006 Compliance",
      description:
        "Automated maternity pre/post split, earned leave pro-rata, and festival bonus calculations per Bangladesh Labor Act.",
      color: "#3B82F6",
      bgColor: "rgba(59, 130, 246, 0.1)",
    },
    {
      icon: GitBranch,
      title: "Stateful Approval Engine",
      description:
        "Multi-level approval workflows with full audit trail. Never lose an approval between server restarts.",
      color: "#6366F1",
      bgColor: "rgba(99, 102, 241, 0.1)",
    },
    {
      icon: Wifi,
      title: "3-Tier Biometric Defense",
      description:
        "Offline-resilient attendance with queue, retry, and alert systems. Works when devices go offline.",
      color: "#10B981",
      bgColor: "rgba(16, 185, 129, 0.1)",
    },
    {
      icon: Gift,
      title: "Automated Festival Bonuses",
      description:
        "Bulk Eid/Puja bonus generation with pro-rata, eligibility checks, and payroll auto-inclusion.",
      color: "#F59E0B",
      bgColor: "rgba(245, 158, 11, 0.1)",
    },
    {
      icon: Clock,
      title: "Tiered Late Deductions",
      description:
        "Grace, Warning, Half-day, Full-day progressive tiers. Configurable per organization.",
      color: "#F43F5E",
      bgColor: "rgba(244, 63, 94, 0.1)",
    },
    {
      icon: Lock,
      title: "Deep RBAC Permissions",
      description:
        "Department-scoped, time-bounded delegation. Beyond flat roles — real enterprise access control.",
      color: "#8B5CF6",
      bgColor: "rgba(139, 92, 246, 0.1)",
    },
  ];

  return (
    <section id="features" ref={ref} className="py-24 sm:py-32 relative">
      {/* Background Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#3B82F6]/4 blur-[150px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-1000 ${
            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6">
            <Star className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-sm text-[#ADC6FF] font-medium">
              Bangladesh-Specific Superpowers
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
            Built Different.{" "}
            <span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">
              Built Better.
            </span>
          </h2>
          <p className="text-[#A1A1AA] text-lg">
            Every feature is stress-tested against the brutal realities of
            Bangladesh&#39;s RMG, Corporate, and NGO sectors.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-7 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-500 cursor-default ${
                isInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{
                transitionDelay: isInView ? `${index * 100}ms` : "0ms",
              }}
            >
              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ background: feature.bgColor }}
              >
                <feature.icon
                  className="w-5 h-5"
                  style={{ color: feature.color }}
                />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                {feature.description}
              </p>

              {/* Hover Arrow */}
              <ChevronRight
                className="w-4 h-4 text-[#52525B] group-hover:text-white group-hover:translate-x-1 transition-all duration-300 mt-4"
              />
            </div>
          ))}
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
      description: "Perfect for small businesses getting started",
      features: [
        "Up to 50 employees",
        "Core HR & Attendance",
        "Basic Payroll Processing",
        "Leave Management",
        "Email Support",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Growth",
      price: annual ? "6,399" : "7,999",
      period: "/mo",
      description: "For growing companies that need more power",
      features: [
        "Up to 200 employees",
        "Everything in Starter",
        "Advanced Payroll with PF",
        "Approval Workflows",
        "Festival Bonus Engine",
        "API Access",
        "Priority Support",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations with custom needs",
      features: [
        "Unlimited employees",
        "Everything in Growth",
        "Biometric Integration",
        "Custom BLA Compliance",
        "Deep RBAC Permissions",
        "Dedicated Account Manager",
        "SLA Guarantee",
        "On-premise Option",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  return (
    <section id="pricing" ref={ref} className="py-24 sm:py-32 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#3B82F6]/[0.02] to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-12 transition-all duration-1000 ${
            isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
            Simple, Transparent{" "}
            <span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">
              Pricing
            </span>
          </h2>
          <p className="text-[#A1A1AA] text-lg mb-8">
            No hidden fees. No per-employee surcharges. Scale at your own pace.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 rounded-full bg-white/5 border border-white/10">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                !annual
                  ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white shadow-lg"
                  : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                annual
                  ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white shadow-lg"
                  : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs text-[#10B981]">-20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-7 transition-all duration-500 ${
                plan.popular
                  ? "bg-gradient-to-b from-[#3B82F6]/[0.08] to-[#6366F1]/[0.04] border-2 border-[#3B82F6]/30 scale-[1.02] shadow-[0_0_60px_rgba(59,130,246,0.15)]"
                  : "bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12]"
              } ${
                isInView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
              }`}
              style={{
                transitionDelay: isInView ? `${index * 150}ms` : "0ms",
              }}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}

              <h3 className="text-lg font-semibold text-white mb-1">
                {plan.name}
              </h3>
              <p className="text-sm text-[#71717A] mb-5">{plan.description}</p>

              {/* Price */}
              <div className="flex items-baseline gap-1 mb-6">
                {plan.price !== "Custom" && (
                  <span className="text-[#3B82F6] text-lg font-semibold">৳</span>
                )}
                <span className="text-4xl font-bold text-white">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-[#71717A] text-sm">{plan.period}</span>
                )}
              </div>

              {/* CTA */}
              <Link
                href={plan.name === "Enterprise" ? "#contact" : "/register"}
                className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all duration-300 mb-7 ${
                  plan.popular
                    ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:scale-[1.02]"
                    : "bg-white/5 text-white border border-white/10 hover:bg-white/10"
                }`}
              >
                {plan.cta}
              </Link>

              {/* Features */}
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                      style={{
                        color: plan.popular ? "#3B82F6" : "#52525B",
                      }}
                    />
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
      id="contact"
      ref={ref}
      className={`py-24 sm:py-32 transition-all duration-1000 ${
        isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="max-w-4xl mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/20 via-[#6366F1]/15 to-[#8B5CF6]/10" />
          <div className="absolute inset-0 bg-[#0A0A0F]/50 backdrop-blur-sm" />

          {/* Content */}
          <div className="relative text-center px-8 py-16 sm:py-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-4">
              Ready to Transform
              <br />
              <span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">
                Your HR?
              </span>
            </h2>
            <p className="text-[#A1A1AA] text-lg max-w-md mx-auto mb-8">
              Join 500+ organizations across Bangladesh who have modernized
              their HR operations with PeopleFlow.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold text-base shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_50px_rgba(59,130,246,0.6)] transition-all duration-300 hover:scale-[1.03]"
              >
                Start Free Trial
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/15 text-white font-semibold text-base hover:bg-white/5 hover:border-white/25 transition-all duration-300"
              >
                View Pricing
              </a>
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
        { label: "Changelog", href: "#" },
        { label: "Roadmap", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About", href: "#about" },
        { label: "Careers", href: "#" },
        { label: "Contact", href: "#contact" },
        { label: "Blog", href: "#" },
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
    {
      title: "Connect",
      links: [
        { label: "LinkedIn", href: "#" },
        { label: "Facebook", href: "#" },
        { label: "Twitter", href: "#" },
        { label: "GitHub", href: "#" },
      ],
    },
  ];

  return (
    <footer className="border-t border-white/[0.04] pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#6366F1] flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-white">
                PeopleFlow
              </span>
            </Link>
            <p className="text-sm text-[#71717A] leading-relaxed">
              Enterprise-grade HR Management System engineered for Bangladesh&#39;s
              unique regulatory landscape.
            </p>
          </div>

          {/* Link Columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-4">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[#71717A] hover:text-white transition-colors duration-200"
                    >
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
            Made with ❤️ in Dhaka, Bangladesh
          </p>
        </div>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Page Composition
// ═══════════════════════════════════════════════════════════════════════════
export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <TrustBanner />
      <FeaturesSection />
      <PricingSection />
      <CTASection />
      <Footer />

      {/* Custom Animations */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 5s ease-in-out infinite;
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
}
