"use client";

import { P, fadeUp } from "./shared";
import { motion } from "framer-motion";

// ═══════════════════════════════════════════════════════════════
// LOGO MARQUEE — Infinite scrolling trust conveyor
// ═══════════════════════════════════════════════════════════════

const logos = [
    { name: "RMG factories", abbr: "RMG" },
    { name: "Manufacturing teams", abbr: "MFG" },
    { name: "Corporate HR", abbr: "CHR" },
    { name: "Payroll reviewers", abbr: "PAY" },
    { name: "Attendance admins", abbr: "ATT" },
    { name: "Factory operations", abbr: "OPS" },
    { name: "Finance teams", abbr: "FIN" },
    { name: "People operations", abbr: "POP" },
    { name: "Multi-branch teams", abbr: "BR" },
    { name: "Beta evaluators", abbr: "BETA" },
];

function LogoTile({ name, abbr }: { name: string; abbr: string }) {
    return (
        <div
            className="flex items-center gap-3 px-7 py-4 rounded-xl mx-3 shrink-0 select-none group cursor-default"
            style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${P.border}`,
                transition: "all 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.2)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                e.currentTarget.style.borderColor = P.border;
                e.currentTarget.style.boxShadow = "none";
            }}
        >
            {/* Logo abbr badge */}
            <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-400"
                style={{
                    background: "rgba(255,255,255,0.04)",
                    color: P.subtle,
                    border: `1px solid ${P.border}`,
                }}
            >
                <span className="group-hover:text-white transition-colors duration-400">{abbr}</span>
            </div>
            <span
                className="text-sm font-medium whitespace-nowrap transition-colors duration-400"
                style={{ color: P.subtle }}
            >
                <span className="group-hover:text-white/70">{name}</span>
            </span>
        </div>
    );
}

export default function LogoMarquee() {
    const doubled = [...logos, ...logos]; // duplicate for seamless loop

    return (
        <section className="relative py-20 overflow-hidden" style={{ background: P.bg }}>
            {/* Section Header */}
            <motion.div
                variants={fadeUp}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                custom={0}
                className="text-center mb-12 px-6"
            >
                <p
                    className="text-sm font-semibold uppercase tracking-[0.2em] mb-3"
                    style={{ color: P.subtle }}
                >
                    Built for Bangladesh HR Teams
                </p>
                <p className="text-base max-w-lg mx-auto" style={{ color: P.muted }}>
                    Workflows for teams evaluating payroll, attendance, leave, and approval operations in beta
                </p>
            </motion.div>

            {/* Marquee Container */}
            <div className="relative">
                {/* Left fade mask */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
                    style={{ background: `linear-gradient(to right, ${P.bg}, transparent)` }}
                />
                {/* Right fade mask */}
                <div
                    className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
                    style={{ background: `linear-gradient(to left, ${P.bg}, transparent)` }}
                />

                {/* Scrolling track */}
                <div
                    className="flex items-center group"
                    style={{
                        animation: "marquee 40s linear infinite",
                        width: "fit-content",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = "paused"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = "running"; }}
                >
                    {doubled.map((logo, i) => (
                        <LogoTile key={`${logo.abbr}-${i}`} name={logo.name} abbr={logo.abbr} />
                    ))}
                </div>
            </div>

            {/* Subtle divider */}
            <div
                className="max-w-5xl mx-auto mt-20 h-px"
                style={{ background: `linear-gradient(to right, transparent, ${P.border}, transparent)` }}
            />
        </section>
    );
}
