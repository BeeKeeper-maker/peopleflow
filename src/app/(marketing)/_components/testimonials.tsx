"use client";

import { motion } from "framer-motion";
import { Quote, MessageSquareText } from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem } from "./shared";

// ═══════════════════════════════════════════════════════════════
// TESTIMONIALS — Social Proof Carousel
// ═══════════════════════════════════════════════════════════════

const testimonials = [
    {
        name: "Beta HR Lead",
        role: "HR Operations",
        company: "RMG pilot team",
        quote: "The payroll, leave, and attendance workflows match the review steps we need for a controlled HRMS rollout.",
        avatar: "HR",
        color: P.blue,
    },
    {
        name: "People Ops Manager",
        role: "People Operations",
        company: "Corporate pilot team",
        quote: "The employee records, approval flows, and dashboards give our team a clearer operating picture than spreadsheets.",
        avatar: "PO",
        color: P.emerald,
    },
    {
        name: "Finance Reviewer",
        role: "Finance",
        company: "Payroll pilot team",
        quote: "The salary structure and festival bonus workflows are promising for reducing manual payroll review effort.",
        avatar: "FR",
        color: P.indigo,
    },
    {
        name: "Operations Director",
        role: "Operations",
        company: "Factory pilot team",
        quote: "The compliance-oriented screens make it easier to review leave, attendance, and payroll decisions before approval.",
        avatar: "OD",
        color: P.violet,
    },
    {
        name: "Factory Manager",
        role: "Line Management",
        company: "Manufacturing pilot team",
        quote: "The approval workflow gives managers a structured path for leave requests and escalation review.",
        avatar: "FM",
        color: P.amber,
    },
    {
        name: "HR Reviewer",
        role: "Human Resources",
        company: "Enterprise pilot team",
        quote: "The Bangladesh-focused leave and policy setup is useful for beta validation with real HR administrators.",
        avatar: "HR",
        color: P.rose,
    },
];

function TestimonialCard({ t }: { t: typeof testimonials[number] }) {
    return (
        <div
            className="shrink-0 w-[380px] rounded-2xl p-6 mx-3 group relative overflow-hidden"
            style={{
                background: P.surface,
                border: `1px solid ${P.border}`,
                backdropFilter: "blur(16px)",
                transition: "all 400ms ease",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${t.color}30`;
                e.currentTarget.style.boxShadow = `0 16px 48px rgba(0,0,0,0.2), 0 0 0 1px ${t.color}15`;
                e.currentTarget.style.transform = "translateY(-3px)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = P.border;
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
            }}
        >
            {/* Hover glow */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
                style={{ background: `radial-gradient(ellipse at 30% 0%, ${t.color}06, transparent 60%)` }}
            />

            <div className="relative">
                {/* Quote icon */}
                <Quote className="w-8 h-8 mb-4 opacity-20" style={{ color: t.color }} />

                {/* Quote text */}
                <p className="text-sm leading-relaxed mb-6" style={{ color: P.body }}>
                    &ldquo;{t.quote}&rdquo;
                </p>

                {/* Author */}
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: t.color }}
                    >
                        {t.avatar}
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white">{t.name}</p>
                        <p className="text-xs" style={{ color: P.subtle }}>{t.role}, {t.company}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Testimonials() {
    const doubled = [...testimonials, ...testimonials];

    return (
        <section className="relative py-28 overflow-hidden" style={{ background: P.bg }}>
            {/* Header */}
            <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                className="text-center mb-16 px-6"
            >
                <motion.div variants={staggerItem}>
                    <div
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                        style={{ background: P.amberDim, border: `1px solid ${P.amber}20` }}
                    >
                        <MessageSquareText className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: P.amber }}>
                            Beta Feedback
                        </span>
                    </div>
                </motion.div>
                <motion.h2
                    variants={staggerItem}
                    className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
                    style={{ color: P.heading }}
                >
                    What Pilot Teams{" "}
                    <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #F59E0B, #D97706)" }}>
                        Are Reviewing
                    </span>
                </motion.h2>
                <motion.p variants={staggerItem} className="text-lg max-w-xl mx-auto" style={{ color: P.body }}>
                    Early beta feedback is helping validate Bangladesh-focused HR workflows before wider release.
                </motion.p>
            </motion.div>

            {/* Carousel */}
            <div className="relative">
                {/* Left fade */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-40 z-10 pointer-events-none"
                    style={{ background: `linear-gradient(to right, ${P.bg}, transparent)` }}
                />
                {/* Right fade */}
                <div
                    className="absolute right-0 top-0 bottom-0 w-40 z-10 pointer-events-none"
                    style={{ background: `linear-gradient(to left, ${P.bg}, transparent)` }}
                />

                <div
                    className="flex"
                    style={{
                        animation: "marquee 50s linear infinite",
                        width: "fit-content",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = "paused"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = "running"; }}
                >
                    {doubled.map((t, i) => (
                        <TestimonialCard key={`${t.name}-${i}`} t={t} />
                    ))}
                </div>
            </div>
        </section>
    );
}
