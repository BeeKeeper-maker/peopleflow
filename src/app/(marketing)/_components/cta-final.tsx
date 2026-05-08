"use client";

import { motion } from "framer-motion";
import { ArrowRight, Zap, Shield, Clock } from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem } from "./shared";

// ═══════════════════════════════════════════════════════════════
// FINAL CTA — High-Urgency Conversion Close
// ═══════════════════════════════════════════════════════════════

export default function CTAFinal({ onBookDemo }: { onBookDemo: () => void }) {
    return (
        <section className="relative py-32 overflow-hidden">
            {/* Full aurora background */}
            <div className="absolute inset-0" style={{ background: P.bg }} />

            {/* Orb 1 */}
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 700, height: 700,
                    top: "-30%", right: "-5%",
                    background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 65%)",
                    animation: "aurora-1 18s ease-in-out infinite",
                }}
            />
            {/* Orb 2 */}
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 600, height: 600,
                    bottom: "-25%", left: "-8%",
                    background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 65%)",
                    animation: "aurora-2 22s ease-in-out infinite",
                }}
            />
            {/* Orb 3 */}
            <div
                className="absolute rounded-full pointer-events-none"
                style={{
                    width: 500, height: 500,
                    top: "20%", left: "35%",
                    background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 60%)",
                    animation: "aurora-3 26s ease-in-out infinite",
                }}
            />

            <div className="relative max-w-4xl mx-auto px-6 text-center">
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                >
                    {/* Badge */}
                    <motion.div variants={staggerItem} className="flex justify-center mb-8">
                        <div
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
                            style={{ background: P.roseDim, border: `1px solid ${P.rose}20` }}
                        >
                            <Clock className="w-3.5 h-3.5" style={{ color: P.rose }} />
                            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: P.rose }}>
                                Prepare for Beta
                            </span>
                        </div>
                    </motion.div>

                    {/* Headline */}
                    <motion.h2
                        variants={staggerItem}
                        className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
                        style={{ color: P.heading }}
                    >
                        Bring Structure to{" "}
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: P.gradDanger }}
                        >
                            HR Operations
                        </span>
                    </motion.h2>

                    <motion.p
                        variants={staggerItem}
                        className="text-lg sm:text-xl max-w-2xl mx-auto mb-12 leading-relaxed"
                        style={{ color: P.body }}
                    >
                        Replace spreadsheet-heavy review with tenant-aware workflows for payroll,
                        leave, attendance, approvals, and audit-ready operational checks.
                    </motion.p>

                    {/* CTAs */}
                    <motion.div
                        variants={staggerItem}
                        className="flex flex-wrap justify-center gap-4 mb-14"
                    >
                        <button
                            onClick={onBookDemo}
                            className="group relative inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl text-white font-semibold text-base cursor-pointer overflow-hidden"
                            style={{
                                background: P.gradBrand,
                                boxShadow: `0 0 40px ${P.blueDim}, 0 8px 32px rgba(0,0,0,0.4)`,
                                transition: "all 400ms ease",
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
                            <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                                style={{
                                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                                    backgroundSize: "200% 100%",
                                    animation: "shimmer 2s infinite",
                                }}
                            />
                            <span className="relative z-10">Book Your Free Demo</span>
                            <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-200" />
                        </button>
                    </motion.div>

                    {/* Trust micro-badges */}
                    <motion.div
                        variants={staggerItem}
                        className="flex flex-wrap justify-center gap-6"
                    >
                        {[
                            { icon: Shield, text: "Compliance-oriented workflows" },
                            { icon: Zap, text: "14-day Free Trial" },
                            { icon: Clock, text: "Guided beta setup" },
                        ].map((b) => (
                            <div key={b.text} className="flex items-center gap-2">
                                <b.icon className="w-4 h-4" style={{ color: P.subtle }} />
                                <span className="text-sm" style={{ color: P.muted }}>{b.text}</span>
                            </div>
                        ))}
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
