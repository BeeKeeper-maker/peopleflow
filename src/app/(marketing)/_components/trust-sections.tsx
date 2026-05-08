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
            title: "Manual Compliance Review Risk",
            description: "Bangladesh leave, maternity, and overtime rules need careful review. Spreadsheets make those checks harder to audit consistently.",
            color: "#F43F5E",
        },
        {
            icon: Ban,
            title: "Payroll Leakage Exposure",
            description: "Ghost attendance, incorrect overtime, and PF calculation mistakes can create avoidable payroll leakage without structured review.",
            color: "#F59E0B",
        },
        {
            icon: Clock,
            title: "Manual HR Review Load",
            description: "HR teams often cross-reference biometric logs, late deductions, and leave approvals manually before payroll close.",
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
                        Manual HR Operations{" "}
                        <span className="bg-linear-to-r from-[#F43F5E] to-[#F59E0B] bg-clip-text text-transparent">Create Risk</span>
                    </h2>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-6">
                    {costs.map((cost, index) => (
                        <motion.div
                            key={cost.title}
                            initial={{ opacity: 0, y: 30 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.7, delay: index * 0.15 }}
                            className="group relative rounded-2xl bg-white/2 border border-white/6 p-7 hover:border-opacity-20 transition-all duration-500"
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
        { icon: Shield, label: "Compliance-Oriented", sub: "Configurable HR review flows", color: "#3B82F6" },
        { icon: Lock, label: "Tenant-Aware Access", sub: "Scoped roles and APIs", color: "#8B5CF6" },
        { icon: TrendingUp, label: "Beta Monitoring", sub: "Health and worker checks", color: "#10B981" },
        { icon: Globe, label: "Deployment Guidance", sub: "Coolify runbook support", color: "#F59E0B" },
    ];

    return (
        <section ref={ref} className="py-16 border-y border-white/4" style={{ background: P.surface }}>
            <div className="max-w-6xl mx-auto px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {badges.map((badge, i) => (
                        <motion.div
                            key={badge.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={isInView ? { opacity: 1, scale: 1 } : {}}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="flex flex-col items-center text-center p-5 rounded-xl bg-white/2 border border-white/4 hover:border-white/10 transition-all duration-300 group"
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
        { value: 4, suffix: "", label: "Core HR Modules", icon: Building2 },
        { value: 12, suffix: "+", label: "Beta Workflows", icon: Users },
        { value: 2, suffix: "", label: "Worker Processes", icon: TrendingUp },
        { value: 1, suffix: "", label: "Coolify Runbook", icon: Globe },
    ];

    return (
        <section ref={ref} className={`py-20 border-y border-white/4 transition-all duration-1000 ${isInView ? "opacity-100" : "opacity-0"}`}
            style={{ background: `linear-gradient(180deg, ${P.bg}, ${P.surface}, ${P.bg})` }}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {stats.map((stat, i) => (
                        <div key={stat.label} className="text-center group" style={{ transitionDelay: `${i * 100}ms` }}>
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/4 border border-white/6 mb-4 group-hover:border-[#3B82F6]/30 group-hover:bg-[#3B82F6]/5 transition-all duration-300">
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
