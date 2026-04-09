"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { P } from "./shared";
import Logo from "./logo";

// ═══════════════════════════════════════════════════════════════
// NAVBAR — Floating Pill Capsule
// Ultra-premium frosted glass, detached from top edge
// ═══════════════════════════════════════════════════════════════

const navLinks = [
    { label: "Features", href: "#features" },
    { label: "Compliance", href: "#compliance" },
    { label: "Pricing", href: "#pricing" },
];

export default function Navbar({ onBookDemo }: { onBookDemo: () => void }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 50);
        handler();
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, []);

    return (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6">
            <motion.header
                initial={{ y: -80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 24, delay: 0.1 }}
                className="max-w-5xl mx-auto mt-5"
            >
                {/* ── Floating Pill Container ── */}
                <motion.div
                    className="relative rounded-full overflow-visible"
                    animate={{
                        paddingTop: scrolled ? 8 : 12,
                        paddingBottom: scrolled ? 8 : 12,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{
                        paddingLeft: 24,
                        paddingRight: 24,
                        background: scrolled
                            ? "rgba(6,6,11,0.65)"
                            : "rgba(6,6,11,0.35)",
                        backdropFilter: "blur(40px) saturate(1.6)",
                        WebkitBackdropFilter: "blur(40px) saturate(1.6)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: scrolled
                            ? "0 8px 32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset"
                            : "0 4px 24px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.03) inset",
                        transition: "background 500ms ease, box-shadow 500ms ease, border-color 500ms ease",
                    }}
                >
                    <div className="flex items-center">
                        {/* ── Logo ── */}
                        <Logo size="sm" />

                        {/* ── Center: Navigation (Desktop) ── */}
                        <nav className="hidden md:flex items-center justify-center gap-0.5 flex-1 mx-8">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="relative px-4 py-1.5 rounded-full text-[13px] font-medium no-underline transition-all duration-300"
                                    style={{ color: "rgba(255,255,255,0.55)" }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = "rgba(255,255,255,0.95)";
                                        e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                                        e.currentTarget.style.background = "transparent";
                                    }}
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        {/* ── Right: Actions ── */}
                        <div className="hidden md:flex items-center gap-2 ml-auto">
                            <Link
                                href="/login"
                                className="px-4 py-1.5 rounded-full text-[13px] font-medium no-underline transition-all duration-300"
                                style={{ color: "rgba(255,255,255,0.55)" }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = "rgba(255,255,255,0.95)";
                                    e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                                    e.currentTarget.style.background = "transparent";
                                }}
                            >
                                Sign In
                            </Link>
                            <button
                                onClick={onBookDemo}
                                className="group relative px-5 py-2 rounded-full text-[13px] font-semibold text-white cursor-pointer overflow-hidden"
                                style={{
                                    background: P.gradBrand,
                                    boxShadow: `0 0 20px ${P.blueDim}, 0 2px 8px rgba(0,0,0,0.3)`,
                                    transition: "all 300ms ease",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = `0 0 36px ${P.blueGlow}, 0 4px 16px rgba(0,0,0,0.4)`;
                                    e.currentTarget.style.transform = "translateY(-1px)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = `0 0 20px ${P.blueDim}, 0 2px 8px rgba(0,0,0,0.3)`;
                                    e.currentTarget.style.transform = "translateY(0)";
                                }}
                            >
                                {/* Shimmer sweep */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                                    style={{
                                        background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%)",
                                        backgroundSize: "200% 100%",
                                        animation: "shimmer 2s infinite",
                                    }}
                                />
                                <span className="relative z-10">Book a Demo</span>
                            </button>
                        </div>

                        {/* ── Mobile Hamburger ── */}
                        <button
                            className="md:hidden ml-auto p-1.5 rounded-full cursor-pointer transition-colors duration-200"
                            onClick={() => setMobileOpen(!mobileOpen)}
                            style={{
                                color: "white",
                                background: mobileOpen ? "rgba(255,255,255,0.08)" : "transparent",
                            }}
                        >
                            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </motion.div>

                {/* ── Mobile Panel (drops below the pill) ── */}
                <AnimatePresence>
                    {mobileOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.97 }}
                            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
                            className="md:hidden mt-2 rounded-2xl overflow-hidden"
                            style={{
                                background: "rgba(6,6,11,0.88)",
                                backdropFilter: "blur(32px) saturate(1.5)",
                                WebkitBackdropFilter: "blur(32px) saturate(1.5)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
                            }}
                        >
                            <div className="px-5 py-4 space-y-1">
                                {navLinks.map((link, i) => (
                                    <motion.div
                                        key={link.label}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                    >
                                        <Link
                                            href={link.href}
                                            onClick={() => setMobileOpen(false)}
                                            className="block px-4 py-2.5 rounded-xl text-sm font-medium no-underline transition-colors"
                                            style={{ color: "rgba(255,255,255,0.6)" }}
                                        >
                                            {link.label}
                                        </Link>
                                    </motion.div>
                                ))}
                                <motion.div
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.15 }}
                                >
                                    <Link
                                        href="/login"
                                        className="block px-4 py-2.5 rounded-xl text-sm font-medium no-underline"
                                        style={{ color: "rgba(255,255,255,0.6)" }}
                                    >
                                        Sign In
                                    </Link>
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.22 }}
                                    className="pt-1"
                                >
                                    <button
                                        onClick={() => { setMobileOpen(false); onBookDemo(); }}
                                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
                                        style={{
                                            background: P.gradBrand,
                                            boxShadow: `0 0 20px ${P.blueDim}`,
                                        }}
                                    >
                                        Book a Demo
                                    </button>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.header>
        </div>
    );
}
