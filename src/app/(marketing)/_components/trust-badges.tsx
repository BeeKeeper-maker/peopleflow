"use client";

import { motion } from "framer-motion";
import { Shield, Lock, Activity, Award } from "lucide-react";
import { P, staggerContainer, staggerItem } from "./shared";

// ═══════════════════════════════════════════════════════════════
// TRUST BADGES — Enterprise Credibility Strip
// ═══════════════════════════════════════════════════════════════

const badges = [
    {
        icon: Shield,
        title: "Compliance-Oriented",
        description: "Workflows for Bangladesh leave, maternity, PF, and festival bonus processes with configurable review before payroll finalization.",
        accentFrom: "#3B82F6",
        accentTo: "#6366F1",
    },
    {
        icon: Lock,
        title: "Tenant-Aware Access",
        description: "Role-based access controls, tenant-scoped APIs, and secure-by-default deployment guidance for beta environments.",
        accentFrom: "#10B981",
        accentTo: "#059669",
    },
    {
        icon: Activity,
        title: "Operational Monitoring",
        description: "Health checks, worker separation, and documented deployment checks for teams preparing a controlled beta rollout.",
        accentFrom: "#8B5CF6",
        accentTo: "#7C3AED",
    },
    {
        icon: Award,
        title: "Audit Trail Foundation",
        description: "Administrative actions and core HR workflows are designed with traceability and reviewability in mind.",
        accentFrom: "#F59E0B",
        accentTo: "#D97706",
    },
];

function TrustBadge({
    badge,
}: {
    badge: typeof badges[number];
}) {
    return (
        <motion.div
            variants={staggerItem}
            className="relative group rounded-2xl overflow-hidden"
            style={{
                background: P.surface,
                transition: "all 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
        >
            {/* ── Animated border shimmer ── */}
            <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                    padding: "1px",
                    background: `linear-gradient(135deg, ${badge.accentFrom}25, transparent 40%, transparent 60%, ${badge.accentTo}25)`,
                    backgroundSize: "300% 300%",
                    animation: "shimmer 4s ease-in-out infinite",
                    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    maskComposite: "exclude",
                    WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                    WebkitMaskComposite: "xor",
                }}
            />

            {/* Hover glow */}
            <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-2xl"
                style={{
                    boxShadow: `inset 0 1px 0 ${badge.accentFrom}20, 0 12px 40px ${badge.accentFrom}10`,
                }}
            />

            <div
                className="relative p-7 h-full"
                onMouseEnter={(e) => {
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                        parent.style.transform = "translateY(-3px)";
                        parent.style.boxShadow = `0 16px 48px ${badge.accentFrom}12`;
                    }
                }}
                onMouseLeave={(e) => {
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                        parent.style.transform = "translateY(0)";
                        parent.style.boxShadow = "none";
                    }
                }}
            >
                {/* Icon with glow */}
                <div className="relative w-12 h-12 mb-5">
                    <div
                        className="absolute inset-0 rounded-xl"
                        style={{
                            background: `linear-gradient(135deg, ${badge.accentFrom}15, ${badge.accentTo}10)`,
                            border: `1px solid ${badge.accentFrom}20`,
                        }}
                    />
                    {/* Subtle icon glow */}
                    <div
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                            boxShadow: `0 0 20px ${badge.accentFrom}20`,
                        }}
                    />
                    <div className="relative w-full h-full flex items-center justify-center">
                        <badge.icon
                            className="w-5 h-5 transition-all duration-300"
                            style={{ color: badge.accentFrom }}
                        />
                    </div>
                </div>

                {/* Title */}
                <h3
                    className="text-base font-bold mb-2.5 tracking-tight"
                    style={{ color: P.heading }}
                >
                    {badge.title}
                </h3>

                {/* Description */}
                <p
                    className="text-sm leading-relaxed"
                    style={{ color: P.muted }}
                >
                    {badge.description}
                </p>
            </div>
        </motion.div>
    );
}

export default function TrustBadgesSection() {
    return (
        <section className="relative py-24 overflow-hidden" style={{ background: P.bg }}>
            {/* Ambient glow */}
            <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] pointer-events-none"
                style={{
                    background: "radial-gradient(ellipse, rgba(59,130,246,0.03) 0%, transparent 70%)",
                }}
            />

            <div className="relative max-w-7xl mx-auto px-6">
                {/* Header */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-50px" }}
                    className="text-center mb-16"
                >
                    <motion.div variants={staggerItem}>
                        <div
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8"
                            style={{
                                background: P.blueDim,
                                border: `1px solid rgba(59,130,246,0.15)`,
                            }}
                        >
                            <Shield className="w-3.5 h-3.5" style={{ color: P.blue }} />
                            <span
                                className="text-xs font-semibold uppercase tracking-wider"
                                style={{ color: P.blue }}
                            >
                                Beta Security Posture
                            </span>
                        </div>
                    </motion.div>
                    <motion.h2
                        variants={staggerItem}
                        className="text-4xl sm:text-5xl font-bold tracking-tight mb-5"
                        style={{ color: P.heading }}
                    >
                        Built for{" "}
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: P.gradBrand }}
                        >
                            Controlled HR Data
                        </span>{" "}
                        Operations
                    </motion.h2>
                    <motion.p
                        variants={staggerItem}
                        className="text-lg max-w-2xl mx-auto"
                        style={{ color: P.body }}
                    >
                        PeopleFlow is being hardened for beta teams with tenant-aware access,
                        scoped APIs, operational checks, and documented deployment practices.
                    </motion.p>
                </motion.div>

                {/* Badge Grid */}
                <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-30px" }}
                    className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
                >
                    {badges.map((badge) => (
                        <TrustBadge key={badge.title} badge={badge} />
                    ))}
                </motion.div>
            </div>

            {/* Section divider */}
            <div
                className="max-w-5xl mx-auto mt-24 h-px"
                style={{ background: `linear-gradient(to right, transparent, ${P.border}, transparent)` }}
            />
        </section>
    );
}
