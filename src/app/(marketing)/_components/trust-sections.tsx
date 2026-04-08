"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Building2, Users, TrendingUp, Globe, AlertTriangle, Ban, Clock } from "lucide-react";
import { useInView, AnimatedNumber, P } from "./shared";

// ── Cost of Inaction Section ──────────────────────────────────
export function CostOfInaction() {
    const { ref, isInView } = useInView(0.1);

    const costs = [
        {
            icon: AlertTriangle,
            title: "৳50,000+ / Year in BLA Fines",
            description: "Section 289 of BLA 2006 mandates specific leave, maternity, and overtime calculations. Manual payroll gets them wrong. Inspectors notice.",
            color: "#F43F5E",
        },
        {
            icon: Ban,
            title: "3-8% Payroll Leakage",
            description: "Ghost attendance, incorrect overtime, miscalculated PF contributions — spreadsheet-based HR leaks money every single month.",
            color: "#F59E0B",
        },
        {
            icon: Clock,
            title: "40+ HR Hours Wasted Monthly",
            description: "Your HR team manually cross-references biometric logs, calculates late deductions, and processes leave approvals. That ends today.",
            color: "#8B5CF6",
        },
    ];

    return (
        <section ref={ref} className="py-24 relative" style={{ background: `linear-gradient(180deg, ${P.bg}, #0A0410, ${P.bg})` }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 20%, rgba(244,63,94,0.05), transparent 60%)" }} />
            <div className="relative max-w-6xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-16"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#F43F5E]/10 border border-[#F43F5E]/20 mb-7">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#F43F5E]" />
                        <span className="text-sm text-[#F43F5E] font-semibold">The Cost of Doing Nothing</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white tracking-tight leading-[1.15] mb-5">
                        Every Month Without PeopleFlow{" "}
                        <span className="bg-gradient-to-r from-[#F43F5E] to-[#F59E0B] bg-clip-text text-transparent">Costs You</span>
                    </h2>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-6">
                    {costs.map((cost, index) => (
                        <motion.div
                            key={cost.title}
                            initial={{ opacity: 0, y: 30 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.7, delay: index * 0.15 }}
                            className="group relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-7 hover:border-opacity-20 transition-all duration-500"
                            style={{ borderColor: `${cost.color}15` }}
                        >
                            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{ background: `radial-gradient(circle at 50% 0%, ${cost.color}08, transparent 70%)` }} />
                            <div className="relative">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                                    style={{ background: `${cost.color}12`, boxShadow: `0 0 0 1px ${cost.color}15` }}>
                                    <cost.icon className="w-5 h-5" style={{ color: cost.color }} />
                                </div>
                                <h3 className="text-lg font-bold mb-3" style={{ color: cost.color }}>{cost.title}</h3>
                                <p className="text-sm text-[#9CA3AF] leading-relaxed">{cost.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── Enterprise Trust Badges ───────────────────────────────────
export function TrustBadges() {
    const { ref, isInView } = useInView(0.2);

    const badges = [
        { icon: Shield, label: "BLA 2006 Compliant", sub: "Full Labor Act Coverage", color: "#3B82F6" },
        { icon: Lock, label: "Bank-Grade Encryption", sub: "AES-256 + TLS 1.3", color: "#8B5CF6" },
        { icon: TrendingUp, label: "99.9% Uptime SLA", sub: "Enterprise Availability", color: "#10B981" },
        { icon: Globe, label: "SOC 2 Ready", sub: "Audit-Grade Security", color: "#F59E0B" },
    ];

    return (
        <section ref={ref} className="py-16 border-y border-white/[0.04]" style={{ background: P.surface }}>
            <div className="max-w-6xl mx-auto px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {badges.map((badge, i) => (
                        <motion.div
                            key={badge.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={isInView ? { opacity: 1, scale: 1 } : {}}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="flex flex-col items-center text-center p-5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1] transition-all duration-300 group"
                        >
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                                style={{ background: `${badge.color}12` }}>
                                <badge.icon className="w-5 h-5" style={{ color: badge.color }} />
                            </div>
                            <p className="text-sm font-semibold text-white mb-0.5">{badge.label}</p>
                            <p className="text-xs text-[#52525B]">{badge.sub}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── Stats Banner ──────────────────────────────────────────────
export function StatsBanner() {
    const { ref, isInView } = useInView(0.2);
    const stats = [
        { value: 500, suffix: "+", label: "Organizations", icon: Building2 },
        { value: 50000, suffix: "+", label: "Employees Managed", icon: Users },
        { value: 99, suffix: ".9%", label: "Uptime SLA", icon: TrendingUp },
        { value: 24, suffix: "/7", label: "Support Access", icon: Globe },
    ];

    return (
        <section ref={ref} className={`py-20 border-y border-white/[0.04] transition-all duration-1000 ${isInView ? "opacity-100" : "opacity-0"}`}
            style={{ background: `linear-gradient(180deg, ${P.bg}, ${P.surface}, ${P.bg})` }}>
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
