"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { P, fadeUp, useInView, Eyebrow } from "./shared";

// ═══════════════════════════════════════════════════════════════
// CTA FINAL — Full-width gradient mesh, dual CTA
// ═══════════════════════════════════════════════════════════════

export default function CTAFinal({ onBookDemo }: { onBookDemo: () => void }) {
    const { ref, isInView } = useInView(0.15);

    return (
        <section
            ref={ref}
            className="relative py-24 overflow-hidden"
            style={{ background: P.bg }}
        >
            {/* Background mesh */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,130,246,0.12), transparent 70%),
                        radial-gradient(ellipse 40% 40% at 80% 20%, rgba(139,92,246,0.10), transparent 70%),
                        radial-gradient(ellipse 40% 40% at 20% 80%, rgba(16,185,129,0.08), transparent 70%)
                    `,
                }}
            />

            <div className="relative max-w-4xl mx-auto px-6 text-center">
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                >
                    <Eyebrow>
                        <Sparkles className="w-3 h-3" />
                        Ready when you are
                    </Eyebrow>

                    <h2
                        className="font-display text-4xl sm:text-6xl font-bold tracking-[-0.03em] mt-5 mb-5"
                        style={{ color: P.heading }}
                    >
                        Transform your HR
                        <br />
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: P.gradText }}
                        >
                            in 10 minutes.
                        </span>
                    </h2>

                    <p className="text-[16px] max-w-xl mx-auto mb-9" style={{ color: P.body }}>
                        Free for 14 days · No credit card · Setup in minutes
                        <br />
                        <span className="text-[13px]" style={{ color: P.muted }}>
                            আজই শুরু করুন — আপনার প্রথম পেস্লিপ ৩ মিনিটে
                        </span>
                    </p>

                    <div className="flex flex-wrap justify-center gap-3">
                        <Link
                            href="/register"
                            className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-semibold text-[15px] cursor-pointer overflow-hidden transition-transform duration-300 hover:scale-[1.03]"
                            style={{
                                background: P.gradBrand,
                                boxShadow: `0 0 40px ${P.blueDim}, 0 8px 24px rgba(0,0,0,0.4)`,
                            }}
                        >
                            <span className="relative z-10">Start Free Trial</span>
                            <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                        </Link>
                        <button
                            onClick={onBookDemo}
                            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-[15px] text-white cursor-pointer transition-all duration-300"
                            style={{
                                background: "rgba(255,255,255,0.04)",
                                border: `1px solid ${P.borderHover}`,
                                backdropFilter: "blur(8px)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                                e.currentTarget.style.borderColor = P.borderActive;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                                e.currentTarget.style.borderColor = P.borderHover;
                            }}
                        >
                            <Play className="w-3.5 h-3.5" style={{ color: P.blueBright }} />
                            Book a Demo
                        </button>
                    </div>

                    {/* Trust line */}
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-8 text-[11px]" style={{ color: P.muted }}>
                        <span>✓ BLA 2006 compliant</span>
                        <span>✓ bKash + bank disbursement</span>
                        <span>✓ Bengali UI</span>
                        <span>✓ Dhaka-based support</span>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
