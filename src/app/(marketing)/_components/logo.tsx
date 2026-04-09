"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// ═══════════════════════════════════════════════════════════════
// LOGO — PeopleFlow Typographic Brand Mark
// Pure typography. No icons. Hyper-premium.
// ═══════════════════════════════════════════════════════════════

const sizes = {
    sm: "text-[1.15rem]",
    md: "text-xl",
    lg: "text-3xl",
};

export default function Logo({
    size = "sm",
    linked = true,
}: {
    size?: "sm" | "md" | "lg";
    linked?: boolean;
}) {
    const content = (
        <motion.div
            className="flex items-center select-none"
            whileHover={{ scale: 1.03 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
            {/* ── SWAP POINT: Replace this entire div with <Image src="/logo.png" /> when brand asset is ready ── */}
            <span className={`${sizes[size]} font-extrabold tracking-tight leading-none`} style={{ fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)" }}>
                <span style={{ color: "#F0F0F5" }}>People</span>
                <span
                    className="bg-clip-text text-transparent"
                    style={{
                        backgroundImage: "linear-gradient(135deg, #3B82F6, #6366F1, #8B5CF6)",
                        backgroundSize: "200% auto",
                        animation: "gradient-text 6s linear infinite",
                    }}
                >
                    Flow
                </span>
            </span>
        </motion.div>
    );

    if (!linked) return content;

    return (
        <Link href="/" className="no-underline">
            {content}
        </Link>
    );
}
