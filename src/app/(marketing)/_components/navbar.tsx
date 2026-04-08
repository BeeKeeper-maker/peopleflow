"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Zap } from "lucide-react";
import { P, staggerContainer, staggerItem } from "./shared";

export default function Navbar({ onBookDemo }: { onBookDemo: () => void }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [mobileOpen]);

    const navLinks = [
        { label: "Features", href: "#features" },
        { label: "Compliance", href: "#compliance" },
        { label: "Pricing", href: "#pricing" },
    ];

    return (
        <>
            <nav
                id="nav-main"
                className="fixed top-0 left-0 right-0 z-50"
                style={{
                    transition: "all 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                    padding: scrolled ? "10px 0" : "18px 0",
                    background: scrolled ? "rgba(6,6,11,0.82)" : "transparent",
                    backdropFilter: scrolled ? "blur(24px) saturate(1.4)" : "none",
                    WebkitBackdropFilter: scrolled ? "blur(24px) saturate(1.4)" : "none",
                    borderBottom: scrolled ? `1px solid ${P.border}` : "1px solid transparent",
                    boxShadow: scrolled ? "0 1px 40px rgba(0,0,0,0.25), inset 0 -1px 0 rgba(59,130,246,0.04)" : "none",
                }}
            >
                <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                    {/* ── Logo ── */}
                    <Link href="/" className="flex items-center gap-2.5 group relative">
                        <div
                            className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-105"
                            style={{
                                background: P.gradBrand,
                                boxShadow: `0 0 20px ${P.blueGlow}`,
                            }}
                        >
                            <Zap className="w-[18px] h-[18px] text-white" />
                            {/* Pulse ring */}
                            <div
                                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{ boxShadow: `0 0 30px ${P.blueGlow}, 0 0 60px rgba(99,102,241,0.2)` }}
                            />
                        </div>
                        <span className="text-lg font-bold tracking-tight">
                            <span className="text-white">People</span>
                            <span
                                className="bg-clip-text text-transparent"
                                style={{ backgroundImage: P.gradBrand }}
                            >
                                Flow
                            </span>
                        </span>
                    </Link>

                    {/* ── Desktop Nav Links ── */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                className="relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                                style={{ color: P.body }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = P.heading;
                                    e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = P.body;
                                    e.currentTarget.style.background = "transparent";
                                }}
                            >
                                {link.label}
                            </a>
                        ))}
                    </div>

                    {/* ── Desktop CTAs ── */}
                    <div className="hidden md:flex items-center gap-3">
                        <Link
                            href="/login"
                            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                            style={{ color: P.body }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = P.heading; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = P.body; }}
                        >
                            Sign In
                        </Link>
                        <button
                            onClick={onBookDemo}
                            className="relative text-sm px-5 py-2.5 rounded-xl font-semibold text-white overflow-hidden group cursor-pointer"
                            style={{
                                background: P.gradBrand,
                                boxShadow: `0 0 20px ${P.blueDim}`,
                                transition: "all 300ms ease",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = `0 0 40px ${P.blueGlow}`;
                                e.currentTarget.style.transform = "scale(1.04)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = `0 0 20px ${P.blueDim}`;
                                e.currentTarget.style.transform = "scale(1)";
                            }}
                        >
                            {/* Shimmer sweep */}
                            <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{
                                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
                                    backgroundSize: "200% 100%",
                                    animation: "shimmer 2s infinite",
                                }}
                            />
                            <span className="relative z-10">Book a Demo</span>
                        </button>
                    </div>

                    {/* ── Mobile Toggle ── */}
                    <button
                        onClick={() => setMobileOpen(!mobileOpen)}
                        className="md:hidden p-2 rounded-lg transition-colors cursor-pointer"
                        style={{ color: P.heading }}
                        aria-label="Toggle menu"
                    >
                        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </nav>

            {/* ── Mobile Menu Overlay ── */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-40 md:hidden"
                        style={{ background: "rgba(6,6,11,0.96)", backdropFilter: "blur(24px)" }}
                    >
                        <motion.div
                            variants={staggerContainer}
                            initial="hidden"
                            animate="visible"
                            className="flex flex-col items-center justify-center h-full gap-6 px-8"
                        >
                            {navLinks.map((link) => (
                                <motion.a
                                    key={link.label}
                                    variants={staggerItem}
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className="text-2xl font-semibold text-white/80 hover:text-white transition-colors"
                                >
                                    {link.label}
                                </motion.a>
                            ))}
                            <motion.div variants={staggerItem} className="pt-6 border-t border-white/[0.06] w-48 flex flex-col gap-4">
                                <Link href="/login" onClick={() => setMobileOpen(false)} className="text-center text-white/60 hover:text-white py-3">
                                    Sign In
                                </Link>
                                <button
                                    onClick={() => { setMobileOpen(false); onBookDemo(); }}
                                    className="w-full py-3.5 rounded-xl text-white font-semibold cursor-pointer"
                                    style={{ background: P.gradBrand }}
                                >
                                    Book a Demo
                                </button>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
