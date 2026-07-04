"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { type Variants } from "framer-motion";

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS — Dark Refinement (Linear/Vercel-inspired)
// ═══════════════════════════════════════════════════════════════

const P_blueGlow = "rgba(59,130,246,0.35)";

export const P = {
    // Backgrounds — lifted from #06060B to #0A0A0F for less crush
    bg: "#0A0A0F",
    bgDeep: "#06060A",
    surface: "#111118",
    surfaceHover: "#17181F",
    elevated: "#1C1D26",

    // Borders — refined opacity
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(255,255,255,0.12)",
    borderActive: "rgba(255,255,255,0.20)",

    // Text — Apple-grade neutrals
    heading: "#F5F5F7",
    body: "#98989D",
    muted: "#6E6E73",
    subtle: "#48484A",
    ghost: "#3A3A3C",

    // Brand axis: Blue → Indigo → Violet (refined)
    blue: "#3B82F6",
    blueBright: "#60A5FA",
    blueDim: "rgba(59,130,246,0.10)",
    blueGlow: "rgba(59,130,246,0.35)",
    indigo: "#6366F1",
    indigoDim: "rgba(99,102,241,0.10)",
    violet: "#8B5CF6",
    violetDim: "rgba(139,92,246,0.10)",

    // Semantic
    emerald: "#10B981",
    emeraldDim: "rgba(16,185,129,0.10)",
    amber: "#F59E0B",
    amberDim: "rgba(245,158,11,0.10)",
    rose: "#F43F5E",
    roseDim: "rgba(244,63,94,0.10)",

    // Gradients
    gradBrand: "linear-gradient(135deg, #3B82F6, #6366F1, #8B5CF6)",
    gradBrandHover: "linear-gradient(135deg, #60A5FA, #818CF8, #A78BFA)",
    gradText: "linear-gradient(135deg, #60A5FA, #818CF8, #A78BFA)",
    gradDanger: "linear-gradient(135deg, #F43F5E, #F59E0B)",
    gradSuccess: "linear-gradient(135deg, #10B981, #059669)",
    gradMesh: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.15), transparent)",

    // Shadows
    shadowSm: "0 1px 2px rgba(0,0,0,0.3)",
    shadowMd: "0 4px 12px rgba(0,0,0,0.4)",
    shadowLg: "0 12px 40px rgba(0,0,0,0.5)",
    shadowBrand: `0 0 32px ${P_blueGlow}`,
} as const;

// Backward-compat: re-export useMouseTilt used by hero.tsx
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
        return () => {
            el.removeEventListener("mousemove", onMove);
            el.removeEventListener("mouseleave", onLeave);
        };
    }, [intensity]);
    return { ref, tilt };
}

// ═══════════════════════════════════════════════════════════════
// TYPOGRAPHY PRIMITIVES
// ═══════════════════════════════════════════════════════════════

export function Display({ children, className = "", gradient = false }: { children: ReactNode; className?: string; gradient?: boolean }) {
    return (
        <h1
            className={`font-display tracking-[-0.04em] leading-[1.05] ${className}`}
            style={{
                color: gradient ? "transparent" : P.heading,
                backgroundImage: gradient ? P.gradText : undefined,
                backgroundClip: gradient ? "border-box" : undefined,
                WebkitBackgroundClip: gradient ? "text" : undefined,
            }}
        >
            {children}
        </h1>
    );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <span
            className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] ${className}`}
            style={{ color: P.blueBright }}
        >
            {children}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════
// MOTION VARIANTS — Linear-style refined easing
// ═══════════════════════════════════════════════════════════════

const EASE = [0.22, 1, 0.36, 1] as const; // Linear-style ease-out

export const fadeUp: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: (delay: number = 0) => ({
        opacity: 1, y: 0,
        transition: { duration: 0.6, ease: EASE, delay },
    }),
};

export const fadeScale: Variants = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: (delay: number = 0) => ({
        opacity: 1, scale: 1,
        transition: { duration: 0.5, ease: EASE, delay },
    }),
};

export const fadeIn: Variants = {
    hidden: { opacity: 0 },
    visible: (delay: number = 0) => ({
        opacity: 1,
        transition: { duration: 0.5, ease: EASE, delay },
    }),
};

export const fadeLeft: Variants = {
    hidden: { opacity: 0, x: -32 },
    visible: (delay: number = 0) => ({
        opacity: 1, x: 0,
        transition: { duration: 0.6, ease: EASE, delay },
    }),
};

export const fadeRight: Variants = {
    hidden: { opacity: 0, x: 32 },
    visible: (delay: number = 0) => ({
        opacity: 1, x: 0,
        transition: { duration: 0.6, ease: EASE, delay },
    }),
};

export const staggerContainer: Variants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.06, delayChildren: 0.05 },
    },
};

export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
        opacity: 1, y: 0,
        transition: { duration: 0.5, ease: EASE },
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
            { threshold, rootMargin: "0px 0px -10% 0px" }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    return { ref, isInView };
}

/** Track scroll progress (0-1) of the whole page */
export function useScrollProgress() {
    const [progress, setProgress] = useState(0);
    useEffect(() => {
        const onScroll = () => {
            const scrolled = window.scrollY;
            const max = document.documentElement.scrollHeight - window.innerHeight;
            setProgress(max > 0 ? scrolled / max : 0);
        };
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return progress;
}

/** Media query hook for responsive logic */
export function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
        setMatches(mql.matches);
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, [query]);
    return matches;
}

/** Count-up animation with easing */
export function useCountUp(target: number, duration = 1500, start = false) {
    const [count, setCount] = useState(0);
    const started = useRef(false);
    useEffect(() => {
        if (!start || started.current) return;
        started.current = true;
        const startTime = performance.now();
        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(target * eased);
            if (progress < 1) requestAnimationFrame(animate);
            else setCount(target);
        };
        requestAnimationFrame(animate);
    }, [target, duration, start]);
    return count;
}

// ═══════════════════════════════════════════════════════════════
// ANIMATED NUMBER COUNTER
// ═══════════════════════════════════════════════════════════════

export function AnimatedNumber({
    target,
    suffix = "",
    prefix = "",
    decimals = 0,
    className = "",
}: { target: number; suffix?: string; prefix?: string; decimals?: number; className?: string }) {
    const { ref, isInView } = useInView(0.3);
    const count = useCountUp(target, 1500, isInView);
    const formatted = decimals > 0
        ? count.toFixed(decimals)
        : Math.floor(count).toLocaleString();
    return <span ref={ref} className={className}>{prefix}{formatted}{suffix}</span>;
}

// ═══════════════════════════════════════════════════════════════
// SECTION WRAPPER — scroll-driven reveal
// ═══════════════════════════════════════════════════════════════

export function SectionReveal({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
    const { ref, isInView } = useInView(0.08);
    return (
        <section
            ref={ref}
            id={id}
            className={`transition-all duration-700 ease-out ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
        >
            {children}
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL CSS KEYFRAMES
// ═══════════════════════════════════════════════════════════════

export function GlobalKeyframes() {
    return (
        <style jsx global>{`
            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-12px); }
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
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            @keyframes gradient-pan {
                0% { background-position: 0% 0%; }
                100% { background-position: 100% 100%; }
            }
            @keyframes pulse-dot {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.5; transform: scale(0.85); }
            }
            @keyframes pulse-ring {
                0% { transform: scale(0.9); opacity: 0.8; }
                50% { transform: scale(1.1); opacity: 0.4; }
                100% { transform: scale(0.9); opacity: 0.8; }
            }
            @keyframes scan-line {
                0% { transform: translateY(-100%); opacity: 0; }
                50% { opacity: 1; }
                100% { transform: translateY(100%); opacity: 0; }
            }
            @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
            }
            @keyframes ticker {
                0% { transform: translateY(0); }
                100% { transform: translateY(-100%); }
            }
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
            }
        `}</style>
    );
}
