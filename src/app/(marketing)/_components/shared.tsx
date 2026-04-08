"use client";

import { useState, useEffect, useRef } from "react";

// ── Color Palette ─────────────────────────────────────────────
export const P = {
    bg: "#06060B",
    surface: "#0C0C14",
    border: "rgba(255,255,255,0.06)",
    muted: "#71717A",
    accent1: "#3B82F6",
    accent2: "#6366F1",
    accent3: "#8B5CF6",
    accent4: "#10B981",
    accent5: "#F59E0B",
    accent6: "#F43F5E",
};

// ── Intersection Observer Hook ────────────────────────────────
export function useInView(threshold = 0.1) {
    const ref = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [threshold]);

    return { ref, isInView };
}

// ── Animated Counter ──────────────────────────────────────────
export function AnimatedNumber({ target, suffix = "" }: { target: number; suffix?: string }) {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const started = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !started.current) {
                started.current = true;
                let current = 0;
                const step = target / 40;
                const interval = setInterval(() => {
                    current += step;
                    if (current >= target) {
                        setCount(target);
                        clearInterval(interval);
                    } else {
                        setCount(Math.floor(current));
                    }
                }, 30);
            }
        }, { threshold: 0.3 });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [target]);

    return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}
