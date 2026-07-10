"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ChevronDown } from "lucide-react";
import { P, useScrollProgress } from "./shared";
import Logo from "./logo";

// ═══════════════════════════════════════════════════════════════
// NAVBAR — Refined Floating Pill with Mega-Menu
// Linear-inspired: tight, minimal, scroll progress indicator
// ═══════════════════════════════════════════════════════════════

const megaMenuData = {
    Features: {
        groups: [
            {
                title: "Core HR",
                items: [
                    { label: "Employee Directory", desc: "Centralized records", href: "#features" },
                    { label: "Documents & Vault", desc: "Secure file storage", href: "#features" },
                    { label: "Approval Workflows", desc: "Multi-step routing", href: "#features" },
                ],
            },
            {
                title: "Workforce",
                items: [
                    { label: "Attendance", desc: "Biometric + manual", href: "#features" },
                    { label: "Leave Management", desc: "BLA 2006 compliant", href: "#features" },
                    { label: "Shifts & Roster", desc: "RMG-friendly", href: "#features" },
                ],
            },
            {
                title: "Payroll & Finance",
                items: [
                    { label: "Payroll Engine", desc: "Auto calculation", href: "#features" },
                    { label: "bKash Disbursement", desc: "Digital payroll", href: "#features" },
                    { label: "PF Ledger", desc: "Provident fund", href: "#features" },
                ],
            },
            {
                title: "Growth & Compliance",
                items: [
                    { label: "Performance", desc: "OKR + reviews", href: "#features" },
                    { label: "Recruitment", desc: "AI resume parser", href: "#features" },
                    { label: "Compliance", desc: "BLA 2006 ready", href: "#compliance" },
                ],
            },
        ],
    },
};

const simpleLinks = [
    { label: "Features", href: "#features", hasMega: true },
    { label: "Compliance", href: "#compliance", hasMega: false },
    { label: "Pricing", href: "#pricing", hasMega: false },
    { label: "Compare", href: "#compare", hasMega: false },
];

export default function Navbar({ onBookDemo }: { onBookDemo: () => void }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [megaOpen, setMegaOpen] = useState(false);
    const scrollProgress = useScrollProgress();

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 20);
        handler();
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, []);

    return (
        <div className="fixed top-0 left-0 right-0 z-50">
            {/* Scroll Progress Bar — Linear-style */}
            <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
                <div
                    className="h-full origin-left"
                    style={{
                        background: P.gradBrand,
                        transform: `scaleX(${scrollProgress})`,
                        transition: "transform 100ms linear",
                    }}
                />
            </div>

            <motion.header
                initial={{ y: -60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 28, delay: 0.05 }}
                className="px-4 sm:px-6 pt-4"
                onMouseLeave={() => setMegaOpen(false)}
            >
                <div className="max-w-6xl mx-auto">
                    {/* ── Floating Pill Container ── */}
                    <motion.div
                        className="relative rounded-full"
                        animate={{
                            paddingTop: scrolled ? 7 : 10,
                            paddingBottom: scrolled ? 7 : 10,
                        }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                        style={{
                            paddingLeft: 20,
                            paddingRight: 20,
                            background: scrolled ? "rgba(10,10,15,0.72)" : "rgba(10,10,15,0.45)",
                            backdropFilter: "blur(24px) saturate(1.8)",
                            WebkitBackdropFilter: "blur(24px) saturate(1.8)",
                            border: `1px solid ${scrolled ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)"}`,
                            boxShadow: scrolled
                                ? "0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)"
                                : "0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
                            transition: "background 400ms ease, box-shadow 400ms ease, border-color 400ms ease",
                        }}
                    >
                        <div className="flex items-center gap-6">
                            <Logo size="sm" />

                            {/* ── Desktop Nav ── */}
                            <nav className="hidden md:flex items-center gap-1 flex-1 ml-4">
                                {simpleLinks.map((link) => (
                                    <div
                                        key={link.label}
                                        onMouseEnter={() => setMegaOpen(link.hasMega)}
                                    >
                                        <Link
                                            href={link.href}
                                            className="relative inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-[13px] font-medium no-underline transition-colors duration-200"
                                            style={{ color: "rgba(245,245,247,0.65)" }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.color = "rgba(245,245,247,1)";
                                                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.color = "rgba(245,245,247,0.65)";
                                                e.currentTarget.style.background = "transparent";
                                            }}
                                        >
                                            {link.label}
                                            {link.hasMega && (
                                                <ChevronDown
                                                    className="w-3 h-3 transition-transform duration-200"
                                                    style={{
                                                        transform: megaOpen ? "rotate(180deg)" : "rotate(0deg)",
                                                    }}
                                                />
                                            )}
                                        </Link>
                                    </div>
                                ))}
                            </nav>

                            {/* ── Right: Actions ── */}
                            <div className="hidden md:flex items-center gap-2 ml-auto">
                                <Link
                                    href="/login"
                                    className="px-3.5 py-1.5 rounded-full text-[13px] font-medium no-underline transition-colors duration-200"
                                    style={{ color: "rgba(245,245,247,0.65)" }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.color = "rgba(245,245,247,1)";
                                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.color = "rgba(245,245,247,0.65)";
                                        e.currentTarget.style.background = "transparent";
                                    }}
                                >
                                    Sign In
                                </Link>
                                <button
                                    onClick={onBookDemo}
                                    className="relative px-4 py-1.5 rounded-full text-[13px] font-semibold text-white cursor-pointer transition-all duration-300 hover:scale-[1.03]"
                                    style={{
                                        background: P.gradBrand,
                                        boxShadow: `0 0 16px ${P.blueDim}, 0 2px 8px rgba(0,0,0,0.3)`,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.boxShadow = `0 0 28px ${P.blueGlow}, 0 4px 16px rgba(0,0,0,0.4)`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.boxShadow = `0 0 16px ${P.blueDim}, 0 2px 8px rgba(0,0,0,0.3)`;
                                    }}
                                >
                                    Book a Demo
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
                                aria-label="Toggle menu"
                            >
                                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        </div>
                    </motion.div>

                    {/* ── Mega Menu (Desktop) ── */}
                    <AnimatePresence>
                        {megaOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                                className="hidden md:block absolute left-1/2 -translate-x-1/2 mt-2 w-[640px] rounded-2xl overflow-hidden"
                                style={{
                                    background: "rgba(10,10,15,0.92)",
                                    backdropFilter: "blur(32px) saturate(1.6)",
                                    WebkitBackdropFilter: "blur(32px) saturate(1.6)",
                                    border: `1px solid ${P.border}`,
                                    boxShadow: P.shadowLg,
                                }}
                            >
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5">
                                    {megaMenuData.Features.groups.map((group) => (
                                        <div key={group.title}>
                                            <div
                                                className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-2.5"
                                                style={{ color: P.muted }}
                                            >
                                                {group.title}
                                            </div>
                                            <div className="space-y-1">
                                                {group.items.map((item) => (
                                                    <Link
                                                        key={item.label}
                                                        href={item.href}
                                                        onClick={() => setMegaOpen(false)}
                                                        className="block px-3 py-2 rounded-lg no-underline transition-colors duration-200"
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.background = "transparent";
                                                        }}
                                                    >
                                                        <div
                                                            className="text-[13px] font-semibold"
                                                            style={{ color: P.heading }}
                                                        >
                                                            {item.label}
                                                        </div>
                                                        <div
                                                            className="text-[11px] mt-0.5"
                                                            style={{ color: P.muted }}
                                                        >
                                                            {item.desc}
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Mobile Panel ── */}
                    <AnimatePresence>
                        {mobileOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="md:hidden mt-2 rounded-2xl overflow-hidden"
                                style={{
                                    background: "rgba(10,10,15,0.92)",
                                    backdropFilter: "blur(32px) saturate(1.6)",
                                    WebkitBackdropFilter: "blur(32px) saturate(1.6)",
                                    border: `1px solid ${P.border}`,
                                    boxShadow: P.shadowLg,
                                }}
                            >
                                <div className="px-4 py-3">
                                    {simpleLinks.map((link, i) => (
                                        <motion.div
                                            key={link.label}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.04 }}
                                        >
                                            <Link
                                                href={link.href}
                                                onClick={() => setMobileOpen(false)}
                                                className="block px-4 py-3 rounded-xl text-[15px] font-medium no-underline"
                                                style={{ color: "rgba(245,245,247,0.8)" }}
                                            >
                                                {link.label}
                                            </Link>
                                        </motion.div>
                                    ))}
                                    <motion.div
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.18 }}
                                    >
                                        <Link
                                            href="/login"
                                            onClick={() => setMobileOpen(false)}
                                            className="block px-4 py-3 rounded-xl text-[15px] font-medium no-underline"
                                            style={{ color: "rgba(245,245,247,0.8)" }}
                                        >
                                            Sign In
                                        </Link>
                                    </motion.div>
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.24 }}
                                        className="pt-1 px-2 pb-2"
                                    >
                                        <button
                                            onClick={() => { setMobileOpen(false); onBookDemo(); }}
                                            className="w-full py-3 rounded-xl text-[14px] font-semibold text-white cursor-pointer"
                                            style={{
                                                background: P.gradBrand,
                                                boxShadow: `0 0 16px ${P.blueDim}`,
                                            }}
                                        >
                                            Book a Demo
                                        </button>
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.header>
        </div>
    );
}
