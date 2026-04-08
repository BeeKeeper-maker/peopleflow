"use client";

import { motion } from "framer-motion";
import { Shield, GitBranch, Fingerprint, Gift, Clock, Lock, Sparkles, ChevronRight } from "lucide-react";
import { useInView, P } from "./shared";

export default function BentoFeatures() {
    const { ref, isInView } = useInView(0.05);

    const features = [
        {
            icon: Shield, title: "BLA 2006 Auto-Compliance", tag: "Compliance", color: "#3B82F6", span: "col-span-1 md:col-span-2",
            description: "Maternity pre/post split, earned leave pro-rata, festival bonus calculations. Every payslip is legally bulletproof — zero manual configuration.",
            visual: (
                <div className="mt-5 grid grid-cols-3 gap-2">
                    {["Maternity Leave", "Earned Leave", "Festival Bonus"].map((item, i) => (
                        <div key={item} className="px-3 py-2 rounded-lg bg-[#3B82F6]/8 border border-[#3B82F6]/15 text-center">
                            <div className="text-[10px] text-[#3B82F6] font-semibold">{item}</div>
                            <div className="text-xs text-white/60 mt-0.5">{["Auto-Split", "Pro-Rata", "Bulk Gen"][i]}</div>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            icon: Fingerprint, title: "Zero-Friction Biometric", tag: "Attendance", color: "#10B981", span: "col-span-1",
            description: "Cloud-to-LAN bridge. ZKTeco syncs every 5 min. One-click setup, no IT required.",
            visual: (
                <div className="mt-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center"><Fingerprint className="w-4 h-4 text-[#10B981]" /></div>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden"><div className="h-full w-3/4 rounded-full bg-gradient-to-r from-[#10B981] to-[#059669] animate-pulse" /></div>
                    <span className="text-[10px] text-[#10B981] font-mono">SYNCED</span>
                </div>
            ),
        },
        {
            icon: GitBranch, title: "Stateful Approval Engine", tag: "Workflow", color: "#6366F1", span: "col-span-1",
            description: "Multi-level workflows with branching, delegation, and escalation. Survives server restarts.",
            visual: (
                <div className="mt-4 flex items-center gap-1.5">
                    {["Requested", "L1 ✓", "L2 ✓", "Done"].map((s, i) => (
                        <div key={s} className="flex items-center gap-1.5">
                            <div className={`px-2 py-1 rounded text-[9px] font-semibold ${i < 3 ? "bg-[#6366F1]/15 text-[#A5B4FC]" : "bg-[#10B981]/15 text-[#10B981]"}`}>{s}</div>
                            {i < 3 && <div className="w-3 h-px bg-white/10" />}
                        </div>
                    ))}
                </div>
            ),
        },
        {
            icon: Gift, title: "Festival Bonus Engine", tag: "Payroll", color: "#F59E0B", span: "col-span-1",
            description: "Bulk Eid/Puja bonus with pro-rata calculations and automatic payroll inclusion.",
            visual: (
                <div className="mt-4 p-3 rounded-lg bg-[#F59E0B]/5 border border-[#F59E0B]/10">
                    <div className="flex justify-between text-[10px] mb-1"><span className="text-[#F59E0B]">Eid Bonus 2026</span><span className="text-white/50">৳12.4M</span></div>
                    <div className="h-1.5 rounded-full bg-white/5"><div className="h-full w-[92%] rounded-full bg-gradient-to-r from-[#F59E0B] to-[#D97706]" /></div>
                    <div className="text-[9px] text-white/30 mt-1">1,192 / 1,247 processed</div>
                </div>
            ),
        },
        {
            icon: Clock, title: "Tiered Late Deductions", tag: "Attendance", color: "#F43F5E", span: "col-span-1",
            description: "Grace → Warning → Half-day → Full-day. Fully configurable per shift and org.",
            visual: (
                <div className="mt-4 flex gap-1">
                    {[{ l: "Grace", w: "25%", c: "#10B981" }, { l: "Warn", w: "25%", c: "#F59E0B" }, { l: "½ Day", w: "25%", c: "#F43F5E" }, { l: "Full", w: "25%", c: "#DC2626" }].map((t) => (
                        <div key={t.l} className="flex-1 text-center">
                            <div className="h-6 rounded-t" style={{ background: `${t.c}20` }} />
                            <span className="text-[9px] font-medium" style={{ color: t.c }}>{t.l}</span>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            icon: Lock, title: "Deep RBAC Permissions", tag: "Security", color: "#8B5CF6", span: "col-span-1 md:col-span-2",
            description: "Department-scoped, time-bounded delegation. Beyond flat roles — enterprise access control that actually works. Row-Level Security on Postgres.",
            visual: (
                <div className="mt-5 flex flex-wrap gap-2">
                    {["Super Admin", "HR Admin", "Manager", "Employee", "Auditor"].map((role, i) => (
                        <div key={role} className="px-3 py-1.5 rounded-full text-[10px] font-semibold border" style={{ color: ["#8B5CF6", "#3B82F6", "#10B981", "#71717A", "#F59E0B"][i], borderColor: `${["#8B5CF6", "#3B82F6", "#10B981", "#71717A", "#F59E0B"][i]}25`, background: `${["#8B5CF6", "#3B82F6", "#10B981", "#71717A", "#F59E0B"][i]}08` }}>
                            {role}
                        </div>
                    ))}
                </div>
            ),
        },
    ];

    return (
        <section id="features" ref={ref} className="py-28 sm:py-36 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-30 pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(59,130,246,0.06), transparent 70%)" }} />

            <div className="relative max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8 }}
                    className="text-center max-w-2xl mx-auto mb-20"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] mb-7">
                        <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                        <span className="text-sm text-[#ADC6FF] font-medium">Bangladesh-Specific Superpowers</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white tracking-tight leading-[1.15] mb-5">
                        Six Engines That{" "}
                        <span className="bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">
                            Run Your HR
                        </span>
                    </h2>
                    <p className="text-[#9CA3AF] text-lg leading-relaxed">
                        Every engine is stress-tested against Bangladesh&apos;s most demanding RMG, Corporate, and NGO requirements.
                    </p>
                </motion.div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {features.map((f, index) => (
                        <motion.div
                            key={f.title}
                            initial={{ opacity: 0, y: 30 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: index * 0.08 }}
                            className={`group relative rounded-2xl bg-white/[0.02] border border-white/[0.06] p-7 hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-500 cursor-default ${f.span}`}
                        >
                            <div className="absolute top-5 right-5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border"
                                    style={{ color: f.color, borderColor: `${f.color}30`, background: `${f.color}08` }}>
                                    {f.tag}
                                </span>
                            </div>
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110"
                                style={{ background: `${f.color}12`, boxShadow: `0 0 0 1px ${f.color}15` }}>
                                <f.icon className="w-5 h-5" style={{ color: f.color }} />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                            <p className="text-sm text-[#9CA3AF] leading-relaxed">{f.description}</p>
                            {f.visual}
                            <div className="mt-5 flex items-center gap-1.5 text-[#52525B] group-hover:text-white transition-all duration-300">
                                <span className="text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Learn more</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
