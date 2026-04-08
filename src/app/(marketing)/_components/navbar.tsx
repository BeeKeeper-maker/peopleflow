"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Zap } from "lucide-react";

export default function Navbar({ onBookDemo }: { onBookDemo: () => void }) {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { label: "Features", href: "#features" },
        { label: "Why PeopleFlow", href: "#why" },
        { label: "Pricing", href: "#pricing" },
    ];

    return (
        <nav
            id="nav-main"
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
                scrolled
                    ? "py-3 bg-[#06060B]/85 backdrop-blur-2xl border-b border-white/[0.04] shadow-[0_1px_40px_rgba(0,0,0,0.3)]"
                    : "py-5 bg-transparent"
            }`}
        >
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2.5 group">
                    <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.4)] group-hover:shadow-[0_0_35px_rgba(99,102,241,0.6)] transition-all duration-300">
                        <Zap className="w-4.5 h-4.5 text-white" />
                    </div>
                    <span className="text-lg font-bold text-white tracking-tight">
                        People<span className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] bg-clip-text text-transparent">Flow</span>
                    </span>
                </Link>

                <div className="hidden md:flex items-center gap-1">
                    {navLinks.map((link) => (
                        <a key={link.label} href={link.href} className="px-4 py-2 rounded-lg text-sm text-[#A1A1AA] hover:text-white hover:bg-white/[0.04] transition-all duration-200">
                            {link.label}
                        </a>
                    ))}
                </div>

                <div className="hidden md:flex items-center gap-3">
                    <Link href="/login" className="px-4 py-2 rounded-lg text-sm text-[#A1A1AA] hover:text-white transition-colors duration-200">
                        Sign In
                    </Link>
                    <button
                        onClick={onBookDemo}
                        className="relative text-sm px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all duration-300 hover:scale-[1.03] overflow-hidden group cursor-pointer"
                    >
                        <span className="relative z-10">Book a Demo</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </button>
                </div>

                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="md:hidden text-white p-2 rounded-lg hover:bg-white/5"
                    aria-label="Toggle menu"
                >
                    {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {mobileOpen && (
                <div className="md:hidden absolute top-full left-0 right-0 bg-[#06060B]/98 backdrop-blur-2xl border-t border-white/[0.04]">
                    <div className="px-6 py-6 flex flex-col gap-2">
                        {navLinks.map((link) => (
                            <a key={link.label} href={link.href} onClick={() => setMobileOpen(false)} className="text-[#A1A1AA] hover:text-white text-base py-3 px-4 rounded-lg hover:bg-white/5 transition-all">
                                {link.label}
                            </a>
                        ))}
                        <div className="pt-4 flex flex-col gap-3 border-t border-white/[0.04] mt-2">
                            <Link href="/login" className="text-[#A1A1AA] hover:text-white py-3 px-4 rounded-lg">Sign In</Link>
                            <button onClick={() => { setMobileOpen(false); onBookDemo(); }} className="text-center px-5 py-3.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold cursor-pointer">
                                Book a Demo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
}
