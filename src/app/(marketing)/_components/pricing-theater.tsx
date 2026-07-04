"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, X, ArrowRight, Sparkles, Building2, Zap } from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem, useInView, Eyebrow } from "./shared";

// ═══════════════════════════════════════════════════════════════
// PRICING — Tiered BDT + Annual Toggle
// Confident authority: transparent, no hidden fees
// ═══════════════════════════════════════════════════════════════

type Tier = {
    id: string;
    name: string;
    tagline: string;
    monthlyPrice: number; // per employee / month
    annualPrice: number; // per employee / month (with 20% off)
    icon: typeof Zap;
    color: string;
    popular?: boolean;
    features: string[];
    cta: string;
};

const tiers: Tier[] = [
    {
        id: "starter",
        name: "Starter",
        tagline: "For teams getting started",
        monthlyPrice: 2000,
        annualPrice: 1600,
        icon: Zap,
        color: "#60A5FA",
        features: [
            "Up to 50 employees",
            "Employee directory + ESS",
            "Attendance (manual + biometric)",
            "Leave management",
            "Basic payroll engine",
            "Email support",
        ],
        cta: "Start Free Trial",
    },
    {
        id: "pro",
        name: "Pro",
        tagline: "For growing BD businesses",
        monthlyPrice: 3500,
        annualPrice: 2800,
        icon: Sparkles,
        color: "#A78BFA",
        popular: true,
        features: [
            "Up to 1,000 employees",
            "Everything in Starter, plus:",
            "bKash + bank disbursement",
            "Performance & OKR",
            "Recruitment pipeline + AI parser",
            "Custom reports + audit logs",
            "Priority support (4-hr SLA)",
        ],
        cta: "Start Free Trial",
    },
    {
        id: "enterprise",
        name: "Enterprise",
        tagline: "For groups & corporations",
        monthlyPrice: 0, // custom
        annualPrice: 0,
        icon: Building2,
        color: "#10B981",
        features: [
            "Unlimited employees",
            "Everything in Pro, plus:",
            "Multi-tenant group structure",
            "Custom integrations (ERP, biometric)",
            "Dedicated success manager",
            "On-prem deployment option",
            "24/7 phone + WhatsApp support",
            "Custom SLA + contract",
        ],
        cta: "Contact Sales",
    },
];

const matrix = [
    { feature: "Employee directory", starter: true, pro: true, enterprise: true },
    { feature: "Biometric attendance (ZKTeco/ADMS)", starter: true, pro: true, enterprise: true },
    { feature: "BLA 2006 compliant leave", starter: true, pro: true, enterprise: true },
    { feature: "Payroll engine", starter: "basic", pro: "full", enterprise: "full" },
    { feature: "bKash / Nagad disbursement", starter: false, pro: true, enterprise: true },
    { feature: "Bank EFT file generation", starter: false, pro: true, enterprise: true },
    { feature: "Performance + OKR", starter: false, pro: true, enterprise: true },
    { feature: "Recruitment + AI resume parser", starter: false, pro: true, enterprise: true },
    { feature: "Custom reports + audit logs", starter: false, pro: true, enterprise: true },
    { feature: "Multi-tenant group structure", starter: false, pro: false, enterprise: true },
    { feature: "Custom integrations", starter: false, pro: false, enterprise: true },
    { feature: "On-prem deployment", starter: false, pro: false, enterprise: true },
    { feature: "Support SLA", starter: "email", pro: "4-hr", enterprise: "24/7" },
];

export default function PricingTheater({ onBookDemo }: { onBookDemo: () => void }) {
    const { ref, isInView } = useInView(0.05);
    const [annual, setAnnual] = useState(true);

    return (
        <section
            id="pricing"
            ref={ref}
            className="relative py-24"
            style={{ background: P.bg }}
        >
            <div className="max-w-6xl mx-auto px-6">
                {/* ── Header ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="text-center mb-10"
                >
                    <Eyebrow>
                        <Sparkles className="w-3 h-3" />
                        Pricing
                    </Eyebrow>
                    <h2
                        className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] mt-4 mb-3"
                        style={{ color: P.heading }}
                    >
                        Pricing that scales
                        <span
                            className="bg-clip-text text-transparent ml-2"
                            style={{ backgroundImage: P.gradText }}
                        >
                            with your team.
                        </span>
                    </h2>
                    <p className="text-[15px] max-w-xl mx-auto" style={{ color: P.body }}>
                        Transparent BDT pricing · No hidden fees · 14-day free trial
                    </p>
                </motion.div>

                {/* ── Billing toggle ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.1}
                    className="flex justify-center items-center gap-3 mb-10"
                >
                    <span
                        className="text-[13px] font-semibold transition-colors"
                        style={{ color: !annual ? P.heading : P.muted }}
                    >
                        Monthly
                    </span>
                    <button
                        onClick={() => setAnnual(!annual)}
                        className="relative w-12 h-6 rounded-full cursor-pointer transition-colors"
                        style={{
                            background: annual ? P.gradBrand : P.border,
                        }}
                    >
                        <motion.div
                            className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
                            animate={{ left: annual ? 26 : 2 }}
                            transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        />
                    </button>
                    <span
                        className="text-[13px] font-semibold transition-colors"
                        style={{ color: annual ? P.heading : P.muted }}
                    >
                        Annual
                    </span>
                    <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                        style={{
                            background: P.emeraldDim,
                            color: P.emerald,
                            border: `1px solid ${P.emeraldDim}`,
                        }}
                    >
                        Save 20%
                    </span>
                </motion.div>

                {/* ── Tier cards ── */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="grid md:grid-cols-3 gap-4 mb-16"
                >
                    {tiers.map((tier) => (
                        <TierCard key={tier.id} tier={tier} annual={annual} onBookDemo={onBookDemo} />
                    ))}
                </motion.div>

                {/* ── Feature matrix ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.3}
                >
                    <h3
                        className="font-display text-xl font-bold text-center mb-6 tracking-tight"
                        style={{ color: P.heading }}
                    >
                        Compare every feature
                    </h3>
                    <div
                        className="rounded-2xl overflow-hidden"
                        style={{
                            background: P.surface,
                            border: `1px solid ${P.border}`,
                        }}
                    >
                        {/* Header row */}
                        <div
                            className="grid grid-cols-4 px-5 py-4"
                            style={{ borderBottom: `1px solid ${P.border}` }}
                        >
                            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: P.muted }}>
                                Feature
                            </div>
                            {tiers.map((tier) => (
                                <div key={tier.id} className="text-center">
                                    <div
                                        className="text-[13px] font-bold font-display"
                                        style={{ color: tier.popular ? tier.color : P.heading }}
                                    >
                                        {tier.name}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Body rows */}
                        {matrix.map((row, i) => (
                            <div
                                key={row.feature}
                                className="grid grid-cols-4 px-5 py-3 items-center"
                                style={{
                                    borderBottom: i === matrix.length - 1 ? "none" : `1px solid ${P.border}`,
                                    background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                                }}
                            >
                                <div className="text-[12px]" style={{ color: P.body }}>
                                    {row.feature}
                                </div>
                                <MatrixCell value={row.starter} color="#60A5FA" />
                                <MatrixCell value={row.pro} color="#A78BFA" highlight />
                                <MatrixCell value={row.enterprise} color="#10B981" />
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

function TierCard({ tier, annual, onBookDemo }: { tier: Tier; annual: boolean; onBookDemo: () => void }) {
    const price = annual ? tier.annualPrice : tier.monthlyPrice;

    return (
        <motion.div
            variants={staggerItem}
            className="relative rounded-2xl p-6 h-full flex flex-col"
            style={{
                background: tier.popular ? "linear-gradient(180deg, rgba(99,102,241,0.05), transparent)" : P.surface,
                border: `1px solid ${tier.popular ? `${tier.color}40` : P.border}`,
                boxShadow: tier.popular ? `0 0 32px ${tier.color}15` : "none",
            }}
        >
            {tier.popular && (
                <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
                    style={{ background: P.gradBrand }}
                >
                    Most Popular
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-3">
                <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{
                        background: `${tier.color}15`,
                        border: `1px solid ${tier.color}30`,
                    }}
                >
                    <tier.icon className="w-4 h-4" style={{ color: tier.color }} />
                </div>
                <div>
                    <div className="font-display text-[18px] font-bold" style={{ color: P.heading }}>
                        {tier.name}
                    </div>
                    <div className="text-[10px]" style={{ color: P.muted }}>
                        {tier.tagline}
                    </div>
                </div>
            </div>

            {/* Price */}
            <div className="mb-5">
                {price === 0 ? (
                    <div className="font-display text-3xl font-bold" style={{ color: P.heading }}>
                        Custom
                    </div>
                ) : (
                    <div className="flex items-baseline gap-1">
                        <span className="font-display text-3xl font-bold" style={{ color: P.heading }}>
                            ৳{price.toLocaleString()}
                        </span>
                        <span className="text-[12px]" style={{ color: P.muted }}>
                            /emp/mo
                        </span>
                    </div>
                )}
                {annual && price > 0 && (
                    <div className="text-[10px] mt-1" style={{ color: P.emerald }}>
                        Billed annually · Save 20%
                    </div>
                )}
            </div>

            {/* CTA */}
            <button
                onClick={tier.id === "enterprise" ? onBookDemo : undefined}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-300 mb-5"
                style={{
                    background: tier.popular ? P.gradBrand : "rgba(255,255,255,0.04)",
                    color: tier.popular ? "white" : P.heading,
                    border: `1px solid ${tier.popular ? "transparent" : P.borderHover}`,
                    boxShadow: tier.popular ? `0 0 20px ${tier.color}30` : "none",
                }}
                onMouseEnter={(e) => {
                    if (!tier.popular) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                        e.currentTarget.style.borderColor = P.borderActive;
                    }
                }}
                onMouseLeave={(e) => {
                    if (!tier.popular) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                        e.currentTarget.style.borderColor = P.borderHover;
                    }
                }}
            >
                {tier.cta}
                <ArrowRight className="inline-block w-3 h-3 ml-1.5" />
            </button>

            {/* Features */}
            <ul className="space-y-2.5 flex-1">
                {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                        <Check
                            className="w-3.5 h-3.5 shrink-0 mt-0.5"
                            style={{ color: tier.color }}
                        />
                        <span className="text-[12px] leading-relaxed" style={{ color: P.body }}>
                            {feature}
                        </span>
                    </li>
                ))}
            </ul>
        </motion.div>
    );
}

function MatrixCell({ value, color, highlight }: { value: boolean | string; color: string; highlight?: boolean }) {
    if (typeof value === "boolean") {
        return (
            <div className="flex justify-center">
                {value ? (
                    <Check className="w-4 h-4" style={{ color }} />
                ) : (
                    <X className="w-4 h-4" style={{ color: P.subtle }} />
                )}
            </div>
        );
    }
    return (
        <div className="text-center">
            <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{
                    background: `${color}15`,
                    color,
                    border: `1px solid ${color}30`,
                }}
            >
                {value}
            </span>
        </div>
    );
}
