"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Zap, ArrowRight, Building2, Crown } from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem } from "./shared";

// ═══════════════════════════════════════════════════════════════
// PRICING THEATER — Conversion Table
// ═══════════════════════════════════════════════════════════════

const plans = [
    {
        id: "starter",
        name: "Starter",
        tagline: "For small teams getting started",
        monthly: 2999,
        annually: 2499,
        icon: Zap,
        color: P.blue,
        cta: "Start Free Trial",
        ctaStyle: "outline" as const,
        features: [
            "Up to 50 employees",
            "3 admin users",
            "1 branch",
            "Core HR & Attendance",
            "Basic Payroll",
            "Leave Management",
            "500 MB storage",
            "Email Support",
        ],
    },
    {
        id: "growth",
        name: "Growth",
        tagline: "For growing companies that need power",
        monthly: 7999,
        annually: 6499,
        icon: Crown,
        color: P.indigo,
        popular: true,
        cta: "Start Free Trial",
        ctaStyle: "filled" as const,
        features: [
            "Up to 200 employees",
            "10 admin users",
            "5 branches",
            "Everything in Starter",
            "Advanced Payroll + PF Ledger",
            "Approval Workflows",
            "Festival Bonus Engine",
            "Biometric Sync (5 devices)",
            "2 GB storage",
            "Priority Support",
        ],
    },
    {
        id: "enterprise",
        name: "Enterprise",
        tagline: "For large organizations & factories",
        monthly: null,
        annually: null,
        icon: Building2,
        color: P.violet,
        cta: "Book a Demo",
        ctaStyle: "outline" as const,
        features: [
            "Unlimited employees",
            "Unlimited admins",
            "Unlimited branches",
            "Everything in Growth",
            "Custom BLA Compliance Rules",
            "Deep RBAC + Row-Level Security",
            "Unlimited devices & storage",
            "Dedicated Account Manager",
            "SLA & On-premise Options",
            "API Access",
        ],
    },
];

function PricingCard({
    plan,
    isAnnual,
    onBookDemo,
}: {
    plan: typeof plans[number];
    isAnnual: boolean;
    onBookDemo: () => void;
}) {
    const price = isAnnual ? plan.annually : plan.monthly;
    const isPopular = "popular" in plan && plan.popular;

    return (
        <motion.div
            variants={staggerItem}
            className="relative rounded-2xl overflow-hidden group flex flex-col"
            style={{
                background: P.surface,
                border: `1px solid ${isPopular ? `${plan.color}30` : P.border}`,
                transition: "all 400ms ease",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = `0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px ${plan.color}20`;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
            }}
        >
            {/* Popular badge */}
            {isPopular && (
                <div
                    className="absolute top-0 left-0 right-0 h-1"
                    style={{ background: `linear-gradient(90deg, ${P.indigo}, ${P.violet})` }}
                />
            )}

            {/* Shimmer border for popular */}
            {isPopular && (
                <div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{
                        padding: "1px",
                        background: `linear-gradient(135deg, ${P.indigo}40, transparent 40%, transparent 60%, ${P.violet}40)`,
                        backgroundSize: "300% 300%",
                        animation: "shimmer 4s ease-in-out infinite",
                        mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        maskComposite: "exclude",
                        WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                        WebkitMaskComposite: "xor",
                    }}
                />
            )}

            <div className="relative p-7 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                    {isPopular && (
                        <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                            style={{ color: P.indigo, background: P.indigoDim, border: `1px solid ${P.indigo}20` }}
                        >
                            Most Popular
                        </span>
                    )}
                </div>
                <p className="text-xs mb-6" style={{ color: P.subtle }}>{plan.tagline}</p>

                {/* Price */}
                <div className="mb-7">
                    {price ? (
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-medium" style={{ color: P.subtle }}>৳</span>
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={price}
                                    className="text-4xl font-black text-white"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    {price.toLocaleString()}
                                </motion.span>
                            </AnimatePresence>
                            <span className="text-sm" style={{ color: P.subtle }}>/mo</span>
                        </div>
                    ) : (
                        <span className="text-4xl font-black text-white">Custom</span>
                    )}
                    {isAnnual && price && (
                        <motion.p
                            className="text-xs mt-1"
                            style={{ color: P.emerald }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            Save ৳{((plan.monthly! - plan.annually!) * 12).toLocaleString()}/year
                        </motion.p>
                    )}
                </div>

                {/* CTA */}
                <button
                    onClick={plan.id === "enterprise" ? onBookDemo : undefined}
                    className="w-full py-3 rounded-xl font-semibold text-sm mb-7 cursor-pointer relative overflow-hidden group/btn"
                    style={{
                        background: plan.ctaStyle === "filled" ? P.gradBrand : "transparent",
                        border: plan.ctaStyle === "filled" ? "none" : `1px solid ${P.border}`,
                        color: "white",
                        boxShadow: plan.ctaStyle === "filled" ? `0 0 32px ${P.blueDim}` : "none",
                        transition: "all 300ms ease",
                    }}
                    onMouseEnter={(e) => {
                        if (plan.ctaStyle === "outline") {
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                        } else {
                            e.currentTarget.style.boxShadow = `0 0 48px ${P.blueGlow}`;
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (plan.ctaStyle === "outline") {
                            e.currentTarget.style.borderColor = P.border;
                            e.currentTarget.style.background = "transparent";
                        } else {
                            e.currentTarget.style.boxShadow = `0 0 32px ${P.blueDim}`;
                        }
                    }}
                >
                    {plan.ctaStyle === "filled" && (
                        <div
                            className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-700"
                            style={{
                                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                                backgroundSize: "200% 100%",
                                animation: "shimmer 2s infinite",
                            }}
                        />
                    )}
                    <span className="relative z-10">{plan.cta}</span>
                </button>

                {/* Features */}
                <div className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                        <div key={f} className="flex items-start gap-2.5">
                            <Check
                                className="w-4 h-4 shrink-0 mt-0.5"
                                style={{ color: isPopular ? plan.color : P.emerald }}
                                strokeWidth={2.5}
                            />
                            <span className="text-sm" style={{ color: P.body }}>{f}</span>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

export default function PricingTheater({ onBookDemo }: { onBookDemo: () => void }) {
    const [isAnnual, setIsAnnual] = useState(false);

    return (
        <section id="pricing" className="relative py-28 overflow-hidden" style={{ background: P.bg }}>
            <div className="relative max-w-7xl mx-auto px-6">
                {/* Header */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    className="text-center mb-12"
                >
                    <motion.div variants={staggerItem}>
                        <div
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                            style={{ background: P.emeraldDim, border: `1px solid ${P.emerald}20` }}
                        >
                            <Zap className="w-3.5 h-3.5" style={{ color: P.emerald }} />
                            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: P.emerald }}>
                                Simple Pricing
                            </span>
                        </div>
                    </motion.div>
                    <motion.h2
                        variants={staggerItem}
                        className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
                        style={{ color: P.heading }}
                    >
                        Invest in Your{" "}
                        <span className="bg-clip-text text-transparent" style={{ backgroundImage: P.gradBrand }}>
                            Workforce
                        </span>
                    </motion.h2>
                    <motion.p variants={staggerItem} className="text-lg max-w-xl mx-auto mb-10" style={{ color: P.body }}>
                        Every plan includes a 14-day free trial. No credit card required.
                    </motion.p>

                    {/* Monthly / Annual Toggle */}
                    <motion.div variants={staggerItem} className="flex items-center justify-center gap-3">
                        <span className="text-sm font-medium" style={{ color: isAnnual ? P.subtle : "white" }}>Monthly</span>
                        <button
                            onClick={() => setIsAnnual(!isAnnual)}
                            className="relative w-14 h-7 rounded-full cursor-pointer transition-colors duration-300"
                            style={{
                                background: isAnnual ? P.indigo : "rgba(255,255,255,0.08)",
                                border: `1px solid ${isAnnual ? `${P.indigo}60` : P.border}`,
                            }}
                        >
                            <motion.div
                                className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white"
                                animate={{ x: isAnnual ? 26 : 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
                            />
                        </button>
                        <span className="text-sm font-medium" style={{ color: isAnnual ? "white" : P.subtle }}>
                            Annual
                        </span>
                        {isAnnual && (
                            <motion.span
                                className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ color: P.emerald, background: P.emeraldDim }}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: "spring", stiffness: 400 }}
                            >
                                Save ~17%
                            </motion.span>
                        )}
                    </motion.div>
                </motion.div>

                {/* Cards */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-30px" }}
                    className="grid md:grid-cols-3 gap-6 items-stretch"
                >
                    {plans.map((plan) => (
                        <PricingCard key={plan.id} plan={plan} isAnnual={isAnnual} onBookDemo={onBookDemo} />
                    ))}
                </motion.div>
            </div>

            <div
                className="max-w-5xl mx-auto mt-24 h-px"
                style={{ background: `linear-gradient(to right, transparent, ${P.border}, transparent)` }}
            />
        </section>
    );
}
