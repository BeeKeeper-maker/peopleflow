"use client";

import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
    title: string;
    value: string | number;
    prefix?: string;
    suffix?: string;
    change?: number;
    changeLabel?: string;
    icon: LucideIcon;
    color: "indigo" | "emerald" | "amber" | "rose" | "violet";
    delay?: number;
}

const COLOR_MAP = {
    indigo: {
        iconBg: "bg-indigo-500/10",
        iconText: "text-indigo-400",
        glow: "shadow-indigo-500/10",
        gradient: "from-indigo-500/5 to-transparent",
    },
    emerald: {
        iconBg: "bg-emerald-500/10",
        iconText: "text-emerald-400",
        glow: "shadow-emerald-500/10",
        gradient: "from-emerald-500/5 to-transparent",
    },
    amber: {
        iconBg: "bg-amber-500/10",
        iconText: "text-amber-400",
        glow: "shadow-amber-500/10",
        gradient: "from-amber-500/5 to-transparent",
    },
    rose: {
        iconBg: "bg-rose-500/10",
        iconText: "text-rose-400",
        glow: "shadow-rose-500/10",
        gradient: "from-rose-500/5 to-transparent",
    },
    violet: {
        iconBg: "bg-violet-500/10",
        iconText: "text-violet-400",
        glow: "shadow-violet-500/10",
        gradient: "from-violet-500/5 to-transparent",
    },
};

export function MetricCard({
    title,
    value,
    prefix = "",
    suffix = "",
    change,
    changeLabel,
    icon: Icon,
    color,
    delay = 0,
}: MetricCardProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const colors = COLOR_MAP[color];

    // Counter animation
    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    useEffect(() => {
        if (!visible) return;
        const numValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.]/g, "")) || 0;
        if (numValue === 0) { setDisplayValue(0); return; }

        const duration = 800;
        const steps = 30;
        const increment = numValue / steps;
        let current = 0;
        const interval = setInterval(() => {
            current += increment;
            if (current >= numValue) {
                setDisplayValue(numValue);
                clearInterval(interval);
            } else {
                setDisplayValue(Math.round(current));
            }
        }, duration / steps);

        return () => clearInterval(interval);
    }, [visible, value]);

    const formattedValue = typeof value === "string" ? (visible ? value : "—") : displayValue.toLocaleString();

    return (
        <div
            ref={ref}
            className={`relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all duration-500 hover:border-white/[0.1] hover:bg-white/[0.04] ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {/* Background gradient */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${colors.gradient} rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`} />

            <div className="relative">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        {title}
                    </span>
                    <div className={`w-9 h-9 rounded-lg ${colors.iconBg} flex items-center justify-center`}>
                        <Icon className={`w-[18px] h-[18px] ${colors.iconText}`} />
                    </div>
                </div>

                <div className="flex items-baseline gap-1">
                    {prefix && <span className="text-lg text-zinc-400 font-medium">{prefix}</span>}
                    <span className="text-3xl font-bold text-white tabular-nums tracking-tight">
                        {formattedValue}
                    </span>
                    {suffix && <span className="text-sm text-zinc-500 font-medium ml-1">{suffix}</span>}
                </div>

                {change !== undefined && (
                    <div className="flex items-center gap-2 mt-3">
                        <span
                            className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                change >= 0
                                    ? "text-emerald-400 bg-emerald-500/10"
                                    : "text-rose-400 bg-rose-500/10"
                            }`}
                        >
                            {change >= 0 ? "+" : ""}
                            {change}%
                        </span>
                        <span className="text-xs text-zinc-600">
                            {changeLabel || "vs last month"}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
