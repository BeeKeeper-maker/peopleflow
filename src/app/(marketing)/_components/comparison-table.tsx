"use client";

import { motion } from "framer-motion";
import { Check, X, Minus } from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem, useInView, Eyebrow } from "./shared";

// ═══════════════════════════════════════════════════════════════
// COMPARISON TABLE — PeopleFlow vs Alternatives
// Sticky header, color-coded cells, PeopleFlow highlighted
// ═══════════════════════════════════════════════════════════════

type Cell = "yes" | "no" | "partial";

type Row = {
    feature: string;
    category: string;
    peopleflow: Cell;
    spreadsheet: Cell;
    legacy: Cell;
    international: Cell;
};

const rows: Row[] = [
    // BD compliance
    { category: "Bangladesh Compliance", feature: "BLA 2006 leave & wage calc", peopleflow: "yes", spreadsheet: "no", legacy: "partial", international: "no" },
    { category: "Bangladesh Compliance", feature: "NID verification", peopleflow: "yes", spreadsheet: "no", legacy: "no", international: "no" },
    { category: "Bangladesh Compliance", feature: "BD tax slabs auto-deduct", peopleflow: "yes", spreadsheet: "partial", legacy: "partial", international: "no" },
    { category: "Bangladesh Compliance", feature: "Bengali UI + reports", peopleflow: "yes", spreadsheet: "no", legacy: "partial", international: "no" },

    // Payments
    { category: "Payments & Disbursement", feature: "bKash / Nagad payroll", peopleflow: "yes", spreadsheet: "no", legacy: "no", international: "no" },
    { category: "Payments & Disbursement", feature: "BD bank EFT file", peopleflow: "yes", spreadsheet: "partial", legacy: "partial", international: "partial" },
    { category: "Payments & Disbursement", feature: "Festival bonus (Eid/PUja)", peopleflow: "yes", spreadsheet: "no", legacy: "partial", international: "no" },

    // Workforce
    { category: "Workforce Management", feature: "Biometric (ZKTeco/ADMS)", peopleflow: "yes", spreadsheet: "no", legacy: "yes", international: "partial" },
    { category: "Workforce Management", feature: "Shift roster (RMG-friendly)", peopleflow: "yes", spreadsheet: "no", legacy: "partial", international: "partial" },
    { category: "Workforce Management", feature: "Geo-fenced attendance", peopleflow: "yes", spreadsheet: "no", legacy: "no", international: "yes" },

    // Modern
    { category: "Modern Experience", feature: "Mobile ESS (offline-capable)", peopleflow: "yes", spreadsheet: "no", legacy: "no", international: "yes" },
    { category: "Modern Experience", feature: "AI resume parser", peopleflow: "yes", spreadsheet: "no", legacy: "no", international: "partial" },
    { category: "Modern Experience", feature: "Real-time dashboard", peopleflow: "yes", spreadsheet: "no", legacy: "no", international: "yes" },

    // Support
    { category: "Support & Deploy", feature: "BD data residency", peopleflow: "yes", spreadsheet: "yes", legacy: "yes", international: "no" },
    { category: "Support & Deploy", feature: "Local Dhaka support", peopleflow: "yes", spreadsheet: "no", legacy: "partial", international: "no" },
    { category: "Support & Deploy", feature: "On-prem option", peopleflow: "yes", spreadsheet: "yes", legacy: "yes", international: "no" },
];

const columns = [
    { id: "peopleflow", label: "PeopleFlow", color: "#60A5FA", highlight: true },
    { id: "spreadsheet", label: "Spreadsheets", color: "#71717A", highlight: false },
    { id: "legacy", label: "Legacy HRMS", color: "#71717A", highlight: false },
    { id: "international", label: "International SaaS", color: "#71717A", highlight: false },
];

export default function ComparisonTable() {
    const { ref, isInView } = useInView(0.05);

    // Group rows by category
    const groupedRows = rows.reduce((acc, row) => {
        if (!acc[row.category]) acc[row.category] = [];
        acc[row.category].push(row);
        return acc;
    }, {} as Record<string, Row[]>);

    return (
        <section
            id="compare"
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
                    className="text-center mb-12"
                >
                    <Eyebrow>Side-by-Side</Eyebrow>
                    <h2
                        className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] mt-4 mb-3"
                        style={{ color: P.heading }}
                    >
                        Why teams
                        <span
                            className="bg-clip-text text-transparent ml-2"
                            style={{ backgroundImage: P.gradText }}
                        >
                            switch to PeopleFlow.
                        </span>
                    </h2>
                    <p className="text-[15px] max-w-xl mx-auto" style={{ color: P.body }}>
                        Built for Bangladesh · No compromise on modern UX
                    </p>
                </motion.div>

                {/* ── Table ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.1}
                    className="rounded-2xl overflow-hidden"
                    style={{
                        background: P.surface,
                        border: `1px solid ${P.border}`,
                    }}
                >
                    {/* Sticky header */}
                    <div
                        className="grid grid-cols-5 px-5 py-4 sticky top-0 z-10"
                        style={{
                            borderBottom: `1px solid ${P.border}`,
                            background: "rgba(10,10,15,0.95)",
                            backdropFilter: "blur(12px)",
                        }}
                    >
                        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: P.muted }}>
                            Capability
                        </div>
                        {columns.map((col) => (
                            <div
                                key={col.id}
                                className="text-center"
                            >
                                <span
                                    className="text-[12px] font-bold font-display"
                                    style={{ color: col.highlight ? col.color : P.heading }}
                                >
                                    {col.label}
                                </span>
                                {col.highlight && (
                                    <div
                                        className="w-6 h-0.5 mx-auto mt-1 rounded-full"
                                        style={{ background: P.gradBrand }}
                                    />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Body rows grouped by category */}
                    {Object.entries(groupedRows).map(([category, catRows], catIdx) => (
                        <div key={category}>
                            {/* Category header */}
                            <div
                                className="px-5 py-2.5"
                                style={{
                                    background: "rgba(255,255,255,0.015)",
                                    borderBottom: `1px solid ${P.border}`,
                                }}
                            >
                                <span
                                    className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                                    style={{ color: P.blueBright }}
                                >
                                    {category}
                                </span>
                            </div>

                            {/* Rows */}
                            {catRows.map((row, i) => (
                                <div
                                    key={row.feature}
                                    className="grid grid-cols-5 px-5 py-3 items-center"
                                    style={{
                                        borderBottom: (i === catRows.length - 1 && catIdx === Object.keys(groupedRows).length - 1)
                                            ? "none"
                                            : `1px solid ${P.border}`,
                                        background: "transparent",
                                    }}
                                >
                                    <div className="text-[12px]" style={{ color: P.body }}>
                                        {row.feature}
                                    </div>
                                    <ComparisonCell value={row.peopleflow} color="#60A5FA" highlight />
                                    <ComparisonCell value={row.spreadsheet} color="#71717A" />
                                    <ComparisonCell value={row.legacy} color="#71717A" />
                                    <ComparisonCell value={row.international} color="#71717A" />
                                </div>
                            ))}
                        </div>
                    ))}
                </motion.div>

                {/* ── Bottom note ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.4}
                    className="text-center mt-6"
                >
                    <div className="flex justify-center items-center gap-6 text-[11px]" style={{ color: P.muted }}>
                        <div className="flex items-center gap-1.5">
                            <Check className="w-3 h-3" style={{ color: P.emerald }} />
                            <span>Full support</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Minus className="w-3 h-3" style={{ color: P.amber }} />
                            <span>Partial / work-around</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <X className="w-3 h-3" style={{ color: P.rose }} />
                            <span>Not available</span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

function ComparisonCell({ value, color, highlight }: { value: Cell; color: string; highlight?: boolean }) {
    const icon = value === "yes"
        ? <Check className="w-4 h-4" style={{ color: highlight ? P.emerald : color }} />
        : value === "partial"
            ? <Minus className="w-4 h-4" style={{ color: P.amber }} />
            : <X className="w-4 h-4" style={{ color: P.subtle }} />;

    return (
        <div
            className="flex justify-center"
            style={{
                background: highlight && value === "yes" ? "rgba(16,185,129,0.04)" : "transparent",
            }}
        >
            {icon}
        </div>
    );
}
