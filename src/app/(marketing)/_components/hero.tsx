"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
    ArrowRight, Star, Shield, Users, BarChart3, Calendar,
    Fingerprint, ChevronDown, Play, Zap, Check, Wifi
} from "lucide-react";
import { P } from "./shared";

export default function HeroSection({ onBookDemo }: { onBookDemo: () => void }) {
    return (
        <section
            id="hero"
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
            <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`, backgroundSize: "64px 64px" }} />

            <div className="relative max-w-7xl mx-auto px-6 w-full">
                <div className="max-w-4xl mx-auto text-center">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                        className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm mb-10"
                    >
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                            <span className="text-xs font-semibold text-[#10B981] uppercase tracking-wider">Live</span>
                        </div>
                        <div className="w-px h-3.5 bg-white/10" />
                        <span className="text-sm text-[#ADC6FF] font-medium">
                            🇧🇩 500+ Orgs Trust PeopleFlow
                        </span>
                    </motion.div>

                    {/* Headline — Psychological Shift */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, delay: 0.1 }}
                        className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-bold leading-[1.05] tracking-[-0.03em] text-white mb-8"
                    >
                        Stop Bleeding Money{" "}
                        <br className="hidden sm:block" />
                        <span className="relative">
                            <span className="bg-gradient-to-r from-[#F43F5E] via-[#F59E0B] to-[#10B981] bg-clip-text text-transparent">
                                On Manual HR
                            </span>
                            <svg className="absolute -bottom-2 left-0 w-full h-3 opacity-30" viewBox="0 0 300 12" fill="none">
                                <path d="M2 10C50 3 100 3 150 6C200 9 250 4 298 7" stroke="url(#ug)" strokeWidth="3" strokeLinecap="round" />
                                <defs><linearGradient id="ug" x1="0" x2="300" y1="0" y2="0"><stop stopColor="#F43F5E" /><stop offset="1" stopColor="#10B981" /></linearGradient></defs>
                            </svg>
                        </span>
                    </motion.h1>

                    {/* Subheadline — Cost of Inaction */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, delay: 0.2 }}
                        className="text-lg sm:text-xl text-[#9CA3AF] leading-relaxed max-w-2xl mx-auto mb-12"
                    >
                        Every month without PeopleFlow, your factory loses <span className="text-white font-semibold">৳2-5 lakh</span> to
                        payroll errors, BLA 2006 non-compliance fines, and ghost attendance.{" "}
                        <span className="text-[#10B981] font-medium">We eliminate 100% of that.</span>
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, delay: 0.3 }}
                        className="flex flex-wrap justify-center gap-4 mb-16"
                    >
                        <button
                            onClick={onBookDemo}
                            className="group relative inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold text-base shadow-[0_0_40px_rgba(59,130,246,0.35)] hover:shadow-[0_0_60px_rgba(59,130,246,0.55)] transition-all duration-400 hover:scale-[1.04] cursor-pointer"
                        >
                            Book a Free Demo
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-200" />
                        </button>
                        <Link
                            href="/register"
                            className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] text-white font-semibold text-base hover:bg-white/[0.08] hover:border-white/[0.18] transition-all duration-300 backdrop-blur-sm"
                        >
                            <Play className="w-4 h-4 text-[#6366F1]" />
                            Start Free — 14 Days
                        </Link>
                    </motion.div>

                    {/* Social Proof */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2.5">
                                {["linear-gradient(135deg, #3B82F6, #2563EB)", "linear-gradient(135deg, #6366F1, #4F46E5)", "linear-gradient(135deg, #10B981, #059669)", "linear-gradient(135deg, #8B5CF6, #7C3AED)", "linear-gradient(135deg, #F59E0B, #D97706)"].map((bg, i) => (
                                    <div key={i} className="w-9 h-9 rounded-full border-[2.5px] border-[#06060B] flex items-center justify-center text-xs font-bold text-white shadow-lg" style={{ background: bg }}>
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
                    </motion.div>
                </div>

                {/* Dashboard Preview */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, delay: 0.5 }}
                    className="mt-20"
                >
                    <DashboardPreview />
                </motion.div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
                    <ChevronDown className="w-5 h-5 text-white/20" />
                </div>
            </div>
        </section>
    );
}

function DashboardPreview() {
    return (
        <div className="relative max-w-5xl mx-auto">
            <div className="absolute -inset-8 bg-gradient-to-br from-[#3B82F6]/15 via-[#6366F1]/10 to-[#8B5CF6]/8 rounded-[2rem] blur-3xl" />
            <div className="relative rounded-2xl bg-[#0C0C14] border border-white/[0.08] shadow-[0_30px_100px_rgba(0,0,0,0.5)] overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 bg-[#0A0A12] border-b border-white/[0.05]">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                        <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                        <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                    </div>
                    <div className="flex-1 flex justify-center">
                        <div className="px-4 py-1 rounded-md bg-white/[0.04] border border-white/[0.06] text-xs text-[#52525B]">
                            hr.ailearnersbd.com/dashboard
                        </div>
                    </div>
                </div>
                <div className="p-6 grid grid-cols-4 gap-4">
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
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                        <p className="text-xs font-medium text-white mb-3">Quick Actions</p>
                        {["Process Payroll", "Approve Leave", "Sync Devices"].map((action, i) => (
                            <div key={action} className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer mb-1">
                                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: [P.accent1, P.accent4, P.accent5][i] + "20" }}>
                                    <div className="w-2 h-2 rounded-full" style={{ background: [P.accent1, P.accent4, P.accent5][i] }} />
                                </div>
                                <span className="text-xs text-[#A1A1AA]">{action}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
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
