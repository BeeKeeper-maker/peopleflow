"use client";

import Link from "next/link";
import { Home, ArrowLeft, Search } from "lucide-react";
import { useEffect, useState } from "react";

/* ─── Floating particle component ─── */
function Particle({ delay, size, x, duration }: { delay: number; size: number; x: number; duration: number }) {
    return (
        <div
            className="absolute rounded-full opacity-0"
            style={{
                width: size,
                height: size,
                left: `${x}%`,
                bottom: "-10px",
                background: `radial-gradient(circle, rgba(99,102,241,0.6) 0%, rgba(139,92,246,0.2) 70%, transparent 100%)`,
                animation: `floatUp ${duration}s ease-in-out ${delay}s infinite`,
            }}
        />
    );
}

/* ─── Orbiting dot ─── */
function OrbitDot({ size, radius, duration, color, delay }: { size: number; radius: number; duration: number; color: string; delay: number }) {
    return (
        <div
            className="absolute top-1/2 left-1/2"
            style={{
                width: radius * 2,
                height: radius * 2,
                marginLeft: -radius,
                marginTop: -radius,
                animation: `spin ${duration}s linear ${delay}s infinite`,
            }}
        >
            <div
                className="absolute rounded-full"
                style={{
                    width: size,
                    height: size,
                    top: 0,
                    left: "50%",
                    marginLeft: -size / 2,
                    background: color,
                    boxShadow: `0 0 ${size * 2}px ${color}`,
                }}
            />
        </div>
    );
}

export default function NotFound() {
    const [mounted, setMounted] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        setMounted(true);
        const handleMouseMove = (e: MouseEvent) => {
            setMousePos({
                x: (e.clientX / window.innerWidth - 0.5) * 20,
                y: (e.clientY / window.innerHeight - 0.5) * 20,
            });
        };
        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    /* Generate random particles */
    const particles = Array.from({ length: 20 }, (_, i) => ({
        delay: Math.random() * 8,
        size: Math.random() * 6 + 2,
        x: Math.random() * 100,
        duration: Math.random() * 6 + 6,
    }));

    return (
        <div className="min-h-screen bg-background overflow-hidden relative flex items-center justify-center p-4">
            {/* ═══ Global keyframes ═══ */}
            <style jsx>{`
                @keyframes floatUp {
                    0% { transform: translateY(0) scale(0); opacity: 0; }
                    10% { opacity: 0.8; }
                    90% { opacity: 0.2; }
                    100% { transform: translateY(-100vh) scale(1); opacity: 0; }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    25% { transform: translateY(-20px) rotate(3deg); }
                    50% { transform: translateY(-10px) rotate(-2deg); }
                    75% { transform: translateY(-25px) rotate(1deg); }
                }
                @keyframes pulse-ring {
                    0% { transform: scale(0.8); opacity: 0.5; }
                    50% { transform: scale(1.2); opacity: 0; }
                    100% { transform: scale(0.8); opacity: 0.5; }
                }
                @keyframes glitch-1 {
                    0%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
                    20% { clip-path: inset(20% 0 60% 0); transform: translate(-3px, 2px); }
                    40% { clip-path: inset(50% 0 30% 0); transform: translate(3px, -1px); }
                    60% { clip-path: inset(70% 0 10% 0); transform: translate(-2px, 3px); }
                    80% { clip-path: inset(10% 0 80% 0); transform: translate(2px, -2px); }
                }
                @keyframes glitch-2 {
                    0%, 100% { clip-path: inset(0 0 0 0); transform: translate(0); }
                    20% { clip-path: inset(60% 0 20% 0); transform: translate(3px, -2px); }
                    40% { clip-path: inset(30% 0 50% 0); transform: translate(-3px, 1px); }
                    60% { clip-path: inset(10% 0 70% 0); transform: translate(2px, -3px); }
                    80% { clip-path: inset(80% 0 10% 0); transform: translate(-2px, 2px); }
                }
                @keyframes scan {
                    0% { top: -10%; }
                    100% { top: 110%; }
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes beacon {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
                    50% { box-shadow: 0 0 0 20px rgba(99,102,241,0); }
                }
                .animate-float { animation: float 6s ease-in-out infinite; }
                .animate-fadeInUp { animation: fadeInUp 0.8s ease-out forwards; }
                .search-beacon { animation: beacon 2s ease-in-out infinite; }
            `}</style>

            {/* ═══ Background gradient orbs ═══ */}
            <div
                className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 transition-transform duration-1000 ease-out"
                style={{
                    background: "radial-gradient(circle, rgba(99,102,241,0.5), transparent 70%)",
                    top: "10%",
                    left: "20%",
                    transform: `translate(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px)`,
                }}
            />
            <div
                className="absolute w-[500px] h-[500px] rounded-full blur-[100px] opacity-15 transition-transform duration-1000 ease-out"
                style={{
                    background: "radial-gradient(circle, rgba(139,92,246,0.5), transparent 70%)",
                    bottom: "10%",
                    right: "15%",
                    transform: `translate(${mousePos.x * -0.3}px, ${mousePos.y * -0.3}px)`,
                }}
            />

            {/* ═══ Grid overlay ═══ */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)",
                    backgroundSize: "60px 60px",
                }}
            />

            {/* ═══ Floating particles ═══ */}
            {mounted && particles.map((p, i) => (
                <Particle key={i} {...p} />
            ))}

            {/* ═══ Main content ═══ */}
            <div className="relative z-10 text-center max-w-lg w-full">
                {/* Animated search icon with orbiting dots */}
                <div
                    className="relative w-32 h-32 mx-auto mb-8 animate-float"
                    style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.5s 0.2s" }}
                >
                    {/* Orbiting elements */}
                    <OrbitDot size={6} radius={58} duration={8} color="rgba(99,102,241,0.8)" delay={0} />
                    <OrbitDot size={4} radius={68} duration={12} color="rgba(139,92,246,0.6)" delay={2} />
                    <OrbitDot size={5} radius={50} duration={10} color="rgba(236,72,153,0.5)" delay={4} />

                    {/* Pulse rings */}
                    <div
                        className="absolute inset-0 rounded-full border border-indigo-500/20"
                        style={{ animation: "pulse-ring 3s ease-in-out infinite" }}
                    />
                    <div
                        className="absolute inset-[-8px] rounded-full border border-purple-500/10"
                        style={{ animation: "pulse-ring 3s ease-in-out 1s infinite" }}
                    />

                    {/* Center icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-indigo-500/20 to-purple-600/20 backdrop-blur-sm border border-indigo-500/20 flex items-center justify-center search-beacon">
                            <Search className="h-9 w-9 text-indigo-400" />
                        </div>
                    </div>
                </div>

                {/* Glitch 404 text */}
                <div
                    className="relative mb-4"
                    style={{
                        opacity: mounted ? 1 : 0,
                        animation: mounted ? "fadeInUp 0.8s ease-out 0.3s both" : "none",
                    }}
                >
                    <h1
                        className="text-[120px] sm:text-[150px] font-black leading-none tracking-tighter select-none"
                        style={{
                            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 30%, #ec4899 60%, #6366f1 100%)",
                            backgroundSize: "200% 200%",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            animation: "gradient-shift 4s ease-in-out infinite",
                        }}
                    >
                        404
                    </h1>
                    {/* Glitch layers */}
                    <h1
                        className="absolute top-0 left-0 right-0 text-[120px] sm:text-[150px] font-black leading-none tracking-tighter select-none text-indigo-400/30"
                        style={{ animation: "glitch-1 4s ease-in-out infinite" }}
                        aria-hidden="true"
                    >
                        404
                    </h1>
                    <h1
                        className="absolute top-0 left-0 right-0 text-[120px] sm:text-[150px] font-black leading-none tracking-tighter select-none text-pink-400/20"
                        style={{ animation: "glitch-2 4s ease-in-out 0.5s infinite" }}
                        aria-hidden="true"
                    >
                        404
                    </h1>
                </div>

                {/* Subtitle */}
                <div style={{ animation: mounted ? "fadeInUp 0.8s ease-out 0.5s both" : "none" }}>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
                        Lost in Space
                    </h2>
                    <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
                        The page you&apos;re searching for has drifted into the void.
                        Let&apos;s navigate you back to safety.
                    </p>
                </div>

                {/* Scan line */}
                <div className="relative my-8 h-px w-full max-w-xs mx-auto overflow-hidden">
                    <div className="absolute inset-0 bg-linear-to-r from-transparent via-indigo-500/30 to-transparent" />
                    <div
                        className="absolute w-16 h-full bg-linear-to-r from-transparent via-indigo-400 to-transparent"
                        style={{ animation: "scan 2s ease-in-out infinite alternate", top: 0 }}
                    />
                </div>

                {/* Action buttons */}
                <div
                    className="flex flex-col sm:flex-row gap-3 justify-center"
                    style={{ animation: mounted ? "fadeInUp 0.8s ease-out 0.7s both" : "none" }}
                >
                    <Link
                        href="/dashboard"
                        className="group relative inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-500/20 active:scale-[0.98]"
                    >
                        {/* Button gradient bg */}
                        <div className="absolute inset-0 bg-linear-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-size-[200%_100%] transition-all duration-500 group-hover:bg-position-[100%_0]" />
                        {/* Shine effect */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full" style={{ transition: "transform 0.6s, opacity 0.3s" }} />
                        <Home className="h-5 w-5 relative z-10" />
                        <span className="relative z-10">Back to Dashboard</span>
                    </Link>

                    <button
                        onClick={() => window.history.back()}
                        className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold text-foreground bg-card-bg border border-card-border hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <ArrowLeft className="h-5 w-5 transition-transform duration-300 group-hover:-translate-x-1" />
                        Go Back
                    </button>
                </div>

                {/* Footer */}
                <div
                    className="mt-12 flex items-center justify-center gap-2 text-muted-foreground/50 text-xs"
                    style={{ animation: mounted ? "fadeInUp 0.8s ease-out 0.9s both" : "none" }}
                >
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 animate-pulse" />
                    <span className="tracking-widest uppercase font-medium">PeopleFlow HRMS</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50 animate-pulse" />
                </div>
            </div>
        </div>
    );
}
