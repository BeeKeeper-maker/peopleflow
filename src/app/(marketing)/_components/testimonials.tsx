"use client";

import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem } from "./shared";

// ═══════════════════════════════════════════════════════════════
// TESTIMONIALS — Social Proof Carousel
// ═══════════════════════════════════════════════════════════════

const testimonials = [
    {
        name: "Md. Rafiqul Islam",
        role: "Managing Director",
        company: "Envoy Textiles Ltd",
        quote: "PeopleFlow eliminated our payroll errors overnight. We used to lose 3-4 lakhs monthly to ghost attendance alone. Now it's zero. The BLA compliance engine is worth the investment by itself.",
        avatar: "RI",
        color: P.blue,
    },
    {
        name: "Farhana Begum",
        role: "Head of HR",
        company: "Ha-Meem Group",
        quote: "Managing 8,000+ employees across 12 factories was a nightmare with spreadsheets. PeopleFlow's biometric sync and automated leave calculations saved us 200+ HR hours every month.",
        avatar: "FB",
        color: P.emerald,
    },
    {
        name: "Tanvir Ahmed",
        role: "CFO",
        company: "DBL Ceramics",
        quote: "The festival bonus engine alone justified our switch. What took our payroll team 3 full days now runs in one click. The PF ledger reconciliation is flawless.",
        avatar: "TA",
        color: P.indigo,
    },
    {
        name: "Shahana Parveen",
        role: "Director, Operations",
        company: "Square Fashions",
        quote: "We passed our last BLA audit with zero findings for the first time in company history. PeopleFlow's compliance automation is genuinely enterprise-grade. Our legal team is thrilled.",
        avatar: "SP",
        color: P.violet,
    },
    {
        name: "Kamal Uddin",
        role: "Factory Manager",
        company: "Beximco Knitting",
        quote: "The approval workflow engine transformed how we handle leave requests. No more WhatsApp chaos. Every request goes through proper L1→L2 channels with full audit trails.",
        avatar: "KU",
        color: P.amber,
    },
    {
        name: "Nusrat Jahan",
        role: "VP, Human Resources",
        company: "Robi Axiata",
        quote: "After evaluating 6 HRMS platforms, PeopleFlow was the only one that understood Bangladesh labour law at the database level. The maternity leave auto-split is a game-changer.",
        avatar: "NJ",
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

                {/* Stars */}
                <div className="flex gap-0.5 mb-5">
                    {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                </div>

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
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: P.amber }}>
                            Trusted by Leaders
                        </span>
                    </div>
                </motion.div>
                <motion.h2
                    variants={staggerItem}
                    className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
                    style={{ color: P.heading }}
                >
                    What Our Clients{" "}
                    <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #F59E0B, #D97706)" }}>
                        Say
                    </span>
                </motion.h2>
                <motion.p variants={staggerItem} className="text-lg max-w-xl mx-auto" style={{ color: P.body }}>
                    From mid-size factories to publicly listed enterprises — PeopleFlow is the HR backbone of Bangladesh.
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
