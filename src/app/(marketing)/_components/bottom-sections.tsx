"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Award, Check, X, ArrowRight, Zap } from "lucide-react";
import { useInView, P } from "./shared";

// ── Why PeopleFlow ────────────────────────────────────────────
export function WhySection() {
    const { ref, isInView } = useInView(0.1);
    const reasons = [
        { title: "Born in Bangladesh", description: "Not a \"localized\" foreign product. Every business rule, every compliance check is built from scratch for BD regulations.", icon: "🇧🇩" },
        { title: "One-Click Biometric Setup", description: "Your HR admin downloads a script, enters the device IP, and attendance data flows to the cloud. No VPN, no port forwarding.", icon: "⚡" },
        { title: "Payroll That Never Fails", description: "Provident Fund, gratuity, tax, festival bonuses — automatically calculated per BLA 2006. Generate bank files in seconds.", icon: "💰" },
    ];

    return (
        <section id="why" ref={ref} className="py-28 relative" style={{ background: `linear-gradient(180deg, ${P.surface}, ${P.bg})` }}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <motion.div initial={{ opacity: 0, x: -30 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.8 }}>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] mb-7">
                            <Award className="w-3.5 h-3.5 text-[#6366F1]" />
                            <span className="text-sm text-[#ADC6FF] font-medium">Why Market Leaders Choose Us</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white tracking-tight leading-[1.15] mb-6">
                            Not Another Generic{" "}
                            <span className="bg-gradient-to-r from-[#F43F5E] to-[#F59E0B] bg-clip-text text-transparent">HR Tool</span>
                        </h2>
                        <p className="text-[#9CA3AF] text-lg leading-relaxed mb-10">
                            International HRMS platforms charge premium prices, then make you &quot;configure&quot; everything. PeopleFlow works out of the box.
                        </p>
                        <div className="space-y-6">
                            {reasons.map((r, i) => (
                                <motion.div key={r.title} initial={{ opacity: 0, y: 15 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: i * 0.15 }} className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-lg shrink-0">{r.icon}</div>
                                    <div>
                                        <h3 className="text-base font-semibold text-white mb-1">{r.title}</h3>
                                        <p className="text-sm text-[#9CA3AF] leading-relaxed">{r.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: 30 }} animate={isInView ? { opacity: 1, x: 0 } : {}} transition={{ duration: 0.8, delay: 0.2 }}>
                        <div className="relative rounded-2xl bg-gradient-to-br from-[#3B82F6]/[0.06] to-[#8B5CF6]/[0.04] border border-white/[0.08] p-8">
                            <div className="space-y-4">
                                {[
                                    { label: "Setup Time", us: "5 minutes", them: "2-3 weeks", g: true, b: false },
                                    { label: "BD Compliance", us: "Built-in", them: "Manual Config", g: true, b: false },
                                    { label: "Biometric Sync", us: "One-Click", them: "IT Required", g: true, b: false },
                                    { label: "Festival Bonuses", us: "Automated", them: "Spreadsheet", g: true, b: false },
                                    { label: "Bangla UI", us: "Native", them: "Partial", g: true, b: false },
                                ].map((row) => (
                                    <div key={row.label} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                        <span className="text-sm text-[#71717A] w-32 shrink-0">{row.label}</span>
                                        <div className="flex-1 flex items-center gap-2"><Check className="w-4 h-4 text-[#10B981]" /><span className="text-sm font-medium text-[#10B981]">{row.us}</span></div>
                                        <div className="flex-1 flex items-center gap-2 opacity-50"><X className="w-4 h-4 text-[#F43F5E]" /><span className="text-sm text-[#F43F5E]">{row.them}</span></div>
                                    </div>
                                ))}
                                <div className="flex justify-between text-xs text-[#52525B] px-4 pt-2">
                                    <span></span>
                                    <span className="text-[#3B82F6] font-semibold">PeopleFlow</span>
                                    <span>Others</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

// ── Pricing Section ───────────────────────────────────────────
export function PricingSection({ onBookDemo }: { onBookDemo: () => void }) {
    const [annual, setAnnual] = useState(false);
    const { ref, isInView } = useInView(0.1);

    const plans = [
        {
            name: "Starter", price: annual ? "2,399" : "2,999", period: "/mo",
            description: "For small teams getting started",
            features: ["Up to 50 employees", "3 admin users", "1 branch", "Core HR & Attendance", "Basic Payroll", "Leave Management", "500 MB storage", "Email Support"],
            cta: "Start Free Trial", ctaLink: "/register", popular: false,
        },
        {
            name: "Growth", price: annual ? "6,399" : "7,999", period: "/mo",
            description: "For growing companies that need power",
            features: ["Up to 200 employees", "10 admin users", "5 branches", "Everything in Starter", "Advanced Payroll + PF Ledger", "Approval Workflows", "Festival Bonus Engine", "Biometric Sync (5 devices)", "2 GB storage", "Priority Support"],
            cta: "Start Free Trial", ctaLink: "/register", popular: true,
        },
        {
            name: "Enterprise", price: "Custom", period: "",
            description: "For large organizations & factories",
            features: ["Unlimited employees", "Unlimited admins", "Unlimited branches", "Everything in Growth", "Custom BLA Compliance Rules", "Deep RBAC + Row-Level Security", "Unlimited devices & storage", "Dedicated Account Manager", "SLA & On-premise Options", "API Access"],
            cta: "Book a Demo", ctaLink: "#", popular: false, isEnterprise: true,
        },
    ];

    return (
        <section id="pricing" ref={ref} className="py-28 sm:py-36 relative">
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.04), transparent 60%)" }} />
            <div className="relative max-w-7xl mx-auto px-6">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8 }} className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-white tracking-tight leading-[1.15] mb-5">
                        Transparent,{" "}
                        <span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">Fair Pricing</span>
                    </h2>
                    <p className="text-[#9CA3AF] text-lg mb-10">No hidden fees. No per-employee surcharges. Scale at your own pace.</p>
                    <div className="inline-flex items-center p-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
                        <button onClick={() => setAnnual(false)} className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer ${!annual ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white shadow-lg" : "text-[#71717A] hover:text-white"}`}>Monthly</button>
                        <button onClick={() => setAnnual(true)} className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer ${annual ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white shadow-lg" : "text-[#71717A] hover:text-white"}`}>Annual <span className="ml-1 text-xs text-[#10B981]">-20%</span></button>
                    </div>
                </motion.div>

                <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {plans.map((plan, index) => (
                        <motion.div key={plan.name} initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay: index * 0.12 }}
                            className={`relative rounded-2xl p-8 transition-all duration-500 ${plan.popular ? "bg-gradient-to-b from-[#3B82F6]/[0.08] to-[#6366F1]/[0.04] border-2 border-[#3B82F6]/30 scale-[1.03] shadow-[0_0_80px_rgba(59,130,246,0.12)]" : "bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12]"}`}>
                            {plan.popular && <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-xs font-bold text-white shadow-lg">Most Popular</div>}
                            <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                            <p className="text-sm text-[#71717A] mb-6">{plan.description}</p>
                            <div className="flex items-baseline gap-1 mb-7">
                                {plan.price !== "Custom" && <span className="text-[#3B82F6] text-lg font-bold">৳</span>}
                                <span className="text-4xl font-bold text-white">{plan.price}</span>
                                {plan.period && <span className="text-[#71717A] text-sm">{plan.period}</span>}
                            </div>
                            {"isEnterprise" in plan && plan.isEnterprise ? (
                                <button onClick={onBookDemo} className="block w-full text-center py-3.5 rounded-xl font-semibold text-sm bg-white/[0.05] text-white border border-white/[0.1] hover:bg-white/[0.1] transition-all duration-300 mb-8 cursor-pointer">
                                    {plan.cta}
                                </button>
                            ) : (
                                <Link href={plan.ctaLink} className={`block w-full text-center py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 mb-8 ${plan.popular ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:scale-[1.02]" : "bg-white/[0.05] text-white border border-white/[0.1] hover:bg-white/[0.1]"}`}>
                                    {plan.cta}
                                </Link>
                            )}
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
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ── CTA Section ───────────────────────────────────────────────
export function CTASection({ onBookDemo }: { onBookDemo: () => void }) {
    const { ref, isInView } = useInView(0.2);
    return (
        <section ref={ref}>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.8 }} className="py-28">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="relative rounded-3xl overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#3B82F6]/20 via-[#6366F1]/15 to-[#8B5CF6]/10" />
                        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.15), transparent 60%)" }} />
                        <div className="absolute inset-0 bg-[#06060B]/60 backdrop-blur-sm" />
                        <div className="relative text-center px-8 py-20 sm:py-24">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.1] mb-8">
                                <Zap className="w-4 h-4 text-[#F59E0B]" />
                                <span className="text-sm text-white/80 font-medium">14-day free trial — no credit card required</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-5">
                                Ready to Stop the{" "}
                                <span className="bg-gradient-to-r from-[#F43F5E] to-[#F59E0B] bg-clip-text text-transparent">Bleeding?</span>
                            </h2>
                            <p className="text-[#9CA3AF] text-lg max-w-md mx-auto mb-10">
                                Join 500+ organizations who transformed their HR from a cost center to a growth engine.
                            </p>
                            <div className="flex flex-wrap justify-center gap-4">
                                <button onClick={onBookDemo} className="group inline-flex items-center gap-2.5 px-9 py-4 rounded-2xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold text-base shadow-[0_0_40px_rgba(59,130,246,0.4)] hover:shadow-[0_0_60px_rgba(59,130,246,0.6)] transition-all duration-300 hover:scale-[1.04] cursor-pointer">
                                    Book a Free Demo
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <Link href="/register" className="inline-flex items-center gap-2.5 px-9 py-4 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white font-semibold hover:bg-white/[0.1] transition-all duration-300">
                                    Start Free Trial
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}

// ── Footer ────────────────────────────────────────────────────
export function Footer() {
    const columns = [
        { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Integrations", href: "#" }, { label: "Changelog", href: "#" }] },
        { title: "Company", links: [{ label: "About Us", href: "#" }, { label: "Careers", href: "/careers" }, { label: "Blog", href: "#" }, { label: "Contact", href: "#" }] },
        { title: "Legal", links: [{ label: "Privacy Policy", href: "#" }, { label: "Terms of Service", href: "#" }, { label: "Data Processing", href: "#" }] },
    ];
    return (
        <footer className="border-t border-white/[0.04] pt-16 pb-10" style={{ background: P.bg }}>
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
                    <div className="col-span-2">
                        <Link href="/" className="flex items-center gap-2.5 mb-5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div>
                            <span className="text-lg font-bold text-white">PeopleFlow</span>
                        </Link>
                        <p className="text-sm text-[#71717A] leading-relaxed max-w-xs mb-6">Enterprise HR Management, engineered for Bangladesh. BLA 2006 compliant payroll, biometric attendance, and multi-level approvals.</p>
                        <div className="flex gap-4">{["Twitter", "LinkedIn", "GitHub"].map((s) => (<a key={s} href="#" className="text-[#52525B] hover:text-white text-xs transition-colors">{s}</a>))}</div>
                    </div>
                    {columns.map((col) => (
                        <div key={col.title}>
                            <h4 className="text-sm font-semibold text-white mb-5">{col.title}</h4>
                            <ul className="space-y-3">{col.links.map((link) => (<li key={link.label}><a href={link.href} className="text-sm text-[#71717A] hover:text-white transition-colors duration-200">{link.label}</a></li>))}</ul>
                        </div>
                    ))}
                </div>
                <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-[#52525B]">© {new Date().getFullYear()} PeopleFlow. All rights reserved.</p>
                    <p className="text-sm text-[#52525B]">Made with ❤️ in Bangladesh 🇧🇩</p>
                </div>
            </div>
        </footer>
    );
}
