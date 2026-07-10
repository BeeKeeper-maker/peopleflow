"use client";

import { P } from "./shared";

// ═══════════════════════════════════════════════════════════════
// LOGO MARQUEE — Pilot Customers + Bank Partners
// Two-row infinite scroll, pause on hover
// ═══════════════════════════════════════════════════════════════

const pilotCustomers = [
    "Apex RMG Ltd.",
    "BRAC Holdings",
    "Beximco Group",
    "Grameenphone",
    "Square Pharma",
    "City Group",
    "Pran-RFL",
    "Mutual Trust Bank",
];

const bankPartners = [
    "bKash",
    "Nagad",
    "City Bank",
    "BRAC Bank",
    "Dutch-Bangla",
    "SSL Commerz",
    "Eastern Bank",
    "Standard Chartered",
];

export default function LogoMarquee() {
    return (
        <section
            className="py-14"
            style={{
                background: P.bg,
                borderTop: `1px solid ${P.border}`,
                borderBottom: `1px solid ${P.border}`,
            }}
        >
            <div className="max-w-6xl mx-auto px-6">
                {/* ── Section label ── */}
                <div className="text-center mb-8">
                    <div
                        className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                        style={{ color: P.muted }}
                    >
                        Trusted by pilot teams across Bangladesh
                    </div>
                    <div className="text-[10px] mt-1" style={{ color: P.subtle }}>
                        পাইলট পার্টনারদের দ্বারা বিশ্বস্ত
                    </div>
                </div>

                {/* ── Row 1: Customers ── */}
                <MarqueeRow items={pilotCustomers} direction="left" duration={40} />

                {/* ── Row 2: Bank Partners ── */}
                <div className="mt-6">
                    <div
                        className="text-center text-[9px] font-medium uppercase tracking-[0.18em] mb-4"
                        style={{ color: P.subtle }}
                    >
                        Payment & Disbursement Partners
                    </div>
                    <MarqueeRow items={bankPartners} direction="right" duration={36} variant="bank" />
                </div>
            </div>
        </section>
    );
}

function MarqueeRow({
    items,
    direction = "left",
    duration = 40,
    variant = "customer",
}: {
    items: string[];
    direction?: "left" | "right";
    duration?: number;
    variant?: "customer" | "bank";
}) {
    // Duplicate items for seamless loop
    const doubled = [...items, ...items];

    return (
        <div
            className="relative overflow-hidden group"
            style={{
                maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
                WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            }}
        >
            <div
                className="flex items-center gap-10 w-max"
                style={{
                    animation: `marquee ${duration}s linear infinite`,
                    animationDirection: direction === "right" ? "reverse" : "normal",
                    animationPlayState: "running",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.animationPlayState = "paused"; }}
                onMouseLeave={(e) => { e.currentTarget.style.animationPlayState = "running"; }}
            >
                {doubled.map((item, i) => (
                    <div
                        key={`${item}-${i}`}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-300 shrink-0"
                        style={{ opacity: 0.55 }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.55"; }}
                    >
                        {variant === "bank" && (
                            <div
                                className="w-6 h-6 rounded-md flex items-center justify-center"
                                style={{
                                    background: "rgba(255,255,255,0.04)",
                                    border: `1px solid ${P.border}`,
                                }}
                            >
                                <div
                                    className="text-[9px] font-bold"
                                    style={{ color: P.blueBright }}
                                >
                                    {item.charAt(0)}
                                </div>
                            </div>
                        )}
                        <span
                            className="text-[15px] font-display font-semibold tracking-tight whitespace-nowrap"
                            style={{ color: P.heading }}
                        >
                            {item}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
