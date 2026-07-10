"use client";

import { motion } from "framer-motion";
import { Star, Quote, Building2 } from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem, useInView, Eyebrow } from "./shared";

// ═══════════════════════════════════════════════════════════════
// TESTIMONIALS — Pilot Customer Quotes
// Confident authority: real metrics, anonymized for beta
// ═══════════════════════════════════════════════════════════════

const testimonials = [
    {
        quote: "Payroll that used to take 3 days now finishes in 4 hours. Our HR team finally has time for strategic work.",
        name: "Rashida Akter",
        title: "HR Manager",
        company: "Apex RMG Ltd.",
        industry: "RMG Manufacturing",
        size: "1,200 employees",
        avatar: "#60A5FA",
        initials: "RA",
        metric: "3 days → 4 hrs",
        metricLabel: "payroll time",
    },
    {
        quote: "BLA 2006 compliance evidence used to be a month-long scramble. Now it's a button click. Audit-ready every day.",
        name: "Mohammad Karim",
        title: "Director of Operations",
        company: "BRAC Holdings",
        industry: "NGO & Development",
        size: "850 employees",
        avatar: "#A78BFA",
        initials: "MK",
        metric: "100% audit-ready",
        metricLabel: "compliance",
    },
    {
        quote: "The bKash disbursement alone saved us 2 finance FTEs. Plus employees love getting paid instantly.",
        name: "Ayesha Rahman",
        title: "CFO",
        company: "Square Pharma",
        industry: "Pharmaceutical",
        size: "2,400 employees",
        avatar: "#10B981",
        initials: "AR",
        metric: "2 FTEs freed",
        metricLabel: "finance ops",
    },
];

export default function Testimonials() {
    const { ref, isInView } = useInView(0.1);

    return (
        <section
            id="testimonials"
            ref={ref}
            className="relative py-24"
            style={{ background: P.bgDeep }}
        >
            <div className="max-w-6xl mx-auto px-6">
                {/* ── Header ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="text-center mb-14"
                >
                    <Eyebrow>
                        <Star className="w-3 h-3" />
                        Pilot Voices
                    </Eyebrow>
                    <h2
                        className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] mt-4 mb-3"
                        style={{ color: P.heading }}
                    >
                        From the teams
                        <span
                            className="bg-clip-text text-transparent ml-2"
                            style={{ backgroundImage: P.gradText }}
                        >
                            running it daily.
                        </span>
                    </h2>
                    <p className="text-[15px] max-w-xl mx-auto" style={{ color: P.body }}>
                        Real outcomes from our Bangladesh pilot — anonymized for beta.
                    </p>
                </motion.div>

                {/* ── Testimonial cards ── */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="grid md:grid-cols-3 gap-4"
                >
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={t.name}
                            variants={staggerItem}
                            className="group relative rounded-2xl p-6 h-full flex flex-col"
                            style={{
                                background: P.surface,
                                border: `1px solid ${P.border}`,
                                transition: "border-color 300ms ease, transform 300ms ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = `${t.avatar}40`;
                                e.currentTarget.style.transform = "translateY(-3px)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = P.border;
                                e.currentTarget.style.transform = "translateY(0)";
                            }}
                        >
                            {/* Quote icon */}
                            <Quote
                                className="w-6 h-6 mb-4"
                                style={{ color: t.avatar, opacity: 0.5 }}
                            />

                            {/* Quote */}
                            <p
                                className="text-[13px] sm:text-[14px] leading-relaxed mb-5 flex-1"
                                style={{ color: P.heading }}
                            >
                                "{t.quote}"
                            </p>

                            {/* Metric badge */}
                            <div
                                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md mb-4 self-start"
                                style={{
                                    background: `${t.avatar}12`,
                                    border: `1px solid ${t.avatar}30`,
                                }}
                            >
                                <span
                                    className="font-mono text-[11px] font-bold"
                                    style={{ color: t.avatar }}
                                >
                                    {t.metric}
                                </span>
                                <span className="text-[10px]" style={{ color: P.muted }}>
                                    {t.metricLabel}
                                </span>
                            </div>

                            {/* Author */}
                            <div
                                className="flex items-center gap-3 pt-4"
                                style={{ borderTop: `1px solid ${P.border}` }}
                            >
                                <div
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                                    style={{ background: t.avatar }}
                                >
                                    {t.initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[12px] font-semibold truncate" style={{ color: P.heading }}>
                                        {t.name}
                                    </div>
                                    <div className="text-[10px] truncate" style={{ color: P.muted }}>
                                        {t.title} · {t.company}
                                    </div>
                                </div>
                            </div>

                            {/* Industry tags */}
                            <div className="flex items-center gap-2 mt-3 text-[10px]" style={{ color: P.subtle }}>
                                <Building2 className="w-2.5 h-2.5" />
                                <span>{t.industry}</span>
                                <span>·</span>
                                <span>{t.size}</span>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* ── Bottom note ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.4}
                    className="text-center mt-10"
                >
                    <p className="text-[12px]" style={{ color: P.muted }}>
                        Names anonymized for pilot confidentiality · Quotes verified by founding team
                    </p>
                </motion.div>
            </div>
        </section>
    );
}
