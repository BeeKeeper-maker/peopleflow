"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { type Variants } from "framer-motion";

// ═══════════════════════════════════════════════════════════════
// COLOR PALETTE — HSL-based for precise control
// ═══════════════════════════════════════════════════════════════

export const P = {
    // Backgrounds
    bg: "#06060B",
    surface: "#0C0C14",
    surfaceHover: "#111119",
    elevated: "#16161F",

    // Borders
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(255,255,255,0.12)",
    borderActive: "rgba(255,255,255,0.18)",

    // Text
    heading: "#FAFAFA",
    body: "#A1A1AA",
    muted: "#71717A",
    subtle: "#52525B",
    ghost: "#3F3F46",

    // Brand axis: Blue → Indigo → Violet
    blue: "#3B82F6",
    blueDim: "rgba(59,130,246,0.12)",
    blueGlow: "rgba(59,130,246,0.4)",
    indigo: "#6366F1",
    indigoDim: "rgba(99,102,241,0.12)",
    violet: "#8B5CF6",
    violetDim: "rgba(139,92,246,0.12)",

    // Semantic
    emerald: "#10B981",
    emeraldDim: "rgba(16,185,129,0.12)",
    amber: "#F59E0B",
    amberDim: "rgba(245,158,11,0.12)",
    rose: "#F43F5E",
    roseDim: "rgba(244,63,94,0.12)",

    // Gradients (CSS strings)
    gradBrand: "linear-gradient(135deg, #3B82F6, #6366F1, #8B5CF6)",
    gradBrandHover: "linear-gradient(135deg, #6366F1, #8B5CF6, #A78BFA)",
    gradDanger: "linear-gradient(135deg, #F43F5E, #F59E0B)",
    gradSuccess: "linear-gradient(135deg, #10B981, #059669)",
} as const;

// ═══════════════════════════════════════════════════════════════
// FRAMER MOTION VARIANTS
// ═══════════════════════════════════════════════════════════════

export const fadeUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: (delay: number = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay },
    }),
};

export const fadeScale: Variants = {
    hidden: { opacity: 0, scale: 0.92 },
    visible: (delay: number = 0) => ({
        opacity: 1, scale: 1,
        transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94], delay },
    }),
};

export const fadeLeft: Variants = {
    hidden: { opacity: 0, x: -40 },
    visible: (delay: number = 0) => ({
        opacity: 1, x: 0,
        transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay },
    }),
};

export const fadeRight: Variants = {
    hidden: { opacity: 0, x: 40 },
    visible: (delay: number = 0) => ({
        opacity: 1, x: 0,
        transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay },
    }),
};

export const staggerContainer: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1,
        },
    },
};

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1, y: 0,
        transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
    },
};

// ═══════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════

/** Intersection Observer — fires once, then disconnects */
export function useInView(threshold = 0.1) {
    const ref = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setIsInView(true); observer.disconnect(); } },
            { threshold }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    return { ref, isInView };
}

/** Track mouse position relative to element center (for 3D tilt) */
export function useMouseTilt(intensity = 8) {
    const ref = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const onMove = (e: MouseEvent) => {
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = (e.clientX - cx) / (rect.width / 2);
            const dy = (e.clientY - cy) / (rect.height / 2);
            setTilt({ x: dy * -intensity, y: dx * intensity });
        };
        const onLeave = () => setTilt({ x: 0, y: 0 });
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
        return () => { el.removeEventListener("mousemove", onMove); el.removeEventListener("mouseleave", onLeave); };
    }, [intensity]);

    return { ref, tilt };
}

// ═══════════════════════════════════════════════════════════════
// ANIMATED NUMBER COUNTER
// ═══════════════════════════════════════════════════════════════

export function AnimatedNumber({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const started = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started.current) {
                started.current = true;
                const duration = 1200;
                const start = performance.now();
                const animate = (now: number) => {
                    const elapsed = now - start;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
                    setCount(Math.floor(eased * target));
                    if (progress < 1) requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
            }
        }, { threshold: 0.3 });
        observer.observe(el);
        return () => observer.disconnect();
    }, [target]);

    return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ═══════════════════════════════════════════════════════════════
// SECTION WRAPPER — scroll-driven reveal
// ═══════════════════════════════════════════════════════════════

export function SectionReveal({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
    const { ref, isInView } = useInView(0.05);
    return (
        <section
            ref={ref}
            id={id}
            className={`transition-all duration-1000 ease-out ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
        >
            {children}
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL CSS KEYFRAMES (injected once)
// ═══════════════════════════════════════════════════════════════

export function GlobalKeyframes() {
    return (
        <style jsx global>{`
            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-14px); }
            }
            @keyframes shimmer {
                0% { background-position: -200% center; }
                100% { background-position: 200% center; }
            }
            @keyframes aurora-1 {
                0%, 100% { transform: translate(0, 0) scale(1); }
                33% { transform: translate(30px, -50px) scale(1.1); }
                66% { transform: translate(-20px, 20px) scale(0.95); }
            }
            @keyframes aurora-2 {
                0%, 100% { transform: translate(0, 0) scale(1); }
                33% { transform: translate(-40px, 30px) scale(1.05); }
                66% { transform: translate(25px, -40px) scale(0.9); }
            }
            @keyframes aurora-3 {
                0%, 100% { transform: translate(0, 0) scale(1); }
                33% { transform: translate(20px, 40px) scale(0.9); }
                66% { transform: translate(-30px, -30px) scale(1.1); }
            }
            @keyframes gradient-text {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes pulse-ring {
                0% { transform: scale(0.9); opacity: 0.8; }
                50% { transform: scale(1.1); opacity: 0.4; }
                100% { transform: scale(0.9); opacity: 0.8; }
            }
            @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
            }
        `}</style>
    );
}
