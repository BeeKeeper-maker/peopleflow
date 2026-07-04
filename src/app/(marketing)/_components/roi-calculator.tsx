"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, Clock, DollarSign, TrendingDown, ArrowRight } from "lucide-react";
import { P, fadeUp, staggerContainer, staggerItem, useInView, Eyebrow, AnimatedNumber } from "./shared";

// ═══════════════════════════════════════════════════════════════
// ROI CALCULATOR — Interactive Slider
// Slide # employees → see hours + BDT saved per year
// ═══════════════════════════════════════════════════════════════

type Method = "manual" | "spreadsheet" | "legacy";

const methodLabels: Record<Method, string> = {
    manual: "Manual / Paper",
    spreadsheet: "Spreadsheets",
    legacy: "Legacy HRMS",
};

const methodHoursPerEmp: Record<Method, number> = {
    manual: 2.4, // hours/week per employee
    spreadsheet: 1.6,
    legacy: 0.7,
};

const methodErrorRate: Record<Method, number> = {
    manual: 8.5, // % payroll errors
    spreadsheet: 4.2,
    legacy: 1.5,
};

const PEOPLEFLOW_HOURS_PER_EMP = 0.15; // 6 min/week per employee
const PEOPLEFLOW_ERROR_RATE = 0.3; // 0.3%
const AVG_SALARY_BDT = 25000; // monthly
const HR_HOURLY_COST_BDT = 350; // HR staff time cost

export default function RoiCalculator() {
    const { ref, isInView } = useInView(0.1);
    const [employeeCount, setEmployeeCount] = useState(150);
    const [method, setMethod] = useState<Method>("spreadsheet");

    const calc = useMemo(() => {
        const beforeHours = employeeCount * methodHoursPerEmp[method] * 52; // annual
        const afterHours = employeeCount * PEOPLEFLOW_HOURS_PER_EMP * 52;
        const hoursSaved = Math.max(0, beforeHours - afterHours);

        const beforeErrors = (employeeCount * AVG_SALARY_BDT * 12) * (methodErrorRate[method] / 100);
        const afterErrors = (employeeCount * AVG_SALARY_BDT * 12) * (PEOPLEFLOW_ERROR_RATE / 100);
        const errorSavings = beforeErrors - afterErrors;

        const timeSavingsBdt = hoursSaved * HR_HOURLY_COST_BDT;
        const totalSavingsBdt = timeSavingsBdt + errorSavings;

        return {
            hoursSaved: Math.round(hoursSaved),
            timeSavingsBdt: Math.round(timeSavingsBdt),
            errorSavingsBdt: Math.round(errorSavings),
            totalSavingsBdt: Math.round(totalSavingsBdt),
            errorReduction: Math.round(((methodErrorRate[method] - PEOPLEFLOW_ERROR_RATE) / methodErrorRate[method]) * 100),
        };
    }, [employeeCount, method]);

    return (
        <section
            id="roi"
            ref={ref}
            className="relative py-24 overflow-hidden"
            style={{ background: P.bg }}
        >
            {/* Background mesh */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(59,130,246,0.06), transparent)",
                }}
            />

            <div className="relative max-w-6xl mx-auto px-6">
                {/* ── Header ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    className="text-center mb-12"
                >
                    <Eyebrow>
                        <Calculator className="w-3 h-3" />
                        ROI Calculator
                    </Eyebrow>
                    <h2
                        className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.03em] mt-4 mb-3"
                        style={{ color: P.heading }}
                    >
                        See your
                        <span
                            className="bg-clip-text text-transparent ml-2"
                            style={{ backgroundImage: P.gradText }}
                        >
                            savings.
                        </span>
                    </h2>
                    <p className="text-[15px] max-w-xl mx-auto" style={{ color: P.body }}>
                        Drag the slider, pick your current method — see what PeopleFlow gives back.
                    </p>
                </motion.div>

                {/* ── Calculator card ── */}
                <motion.div
                    variants={fadeUp}
                    initial="hidden"
                    animate={isInView ? "visible" : "hidden"}
                    custom={0.1}
                    className="rounded-3xl p-7 sm:p-10 max-w-4xl mx-auto"
                    style={{
                        background: P.surface,
                        border: `1px solid ${P.border}`,
                        boxShadow: "0 24px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                >
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* ── Left: Inputs ── */}
                        <div>
                            {/* Employee count */}
                            <div className="mb-7">
                                <div className="flex items-center justify-between mb-3">
                                    <label
                                        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                                        style={{ color: P.muted }}
                                    >
                                        Employees
                                    </label>
                                    <div
                                        className="font-mono text-2xl font-bold"
                                        style={{ color: P.heading }}
                                    >
                                        {employeeCount}
                                    </div>
                                </div>
                                <input
                                    type="range"
                                    min={10}
                                    max={5000}
                                    step={10}
                                    value={employeeCount}
                                    onChange={(e) => setEmployeeCount(parseInt(e.target.value, 10))}
                                    className="w-full h-2 rounded-full appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, ${P.blue} 0%, ${P.indigo} ${((employeeCount - 10) / 4990) * 100}%, ${P.border} ${((employeeCount - 10) / 4990) * 100}%, ${P.border} 100%)`,
                                    }}
                                />
                                <div className="flex justify-between mt-2 text-[10px] font-mono" style={{ color: P.subtle }}>
                                    <span>10</span>
                                    <span>1,000</span>
                                    <span>2,500</span>
                                    <span>5,000</span>
                                </div>
                            </div>

                            {/* Method selector */}
                            <div>
                                <label
                                    className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-3 block"
                                    style={{ color: P.muted }}
                                >
                                    Current HR Method
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(Object.keys(methodLabels) as Method[]).map((m) => (
                                        <button
                                            key={m}
                                            onClick={() => setMethod(m)}
                                            className="px-3 py-2.5 rounded-xl text-[11px] sm:text-[12px] font-semibold cursor-pointer transition-all duration-200"
                                            style={{
                                                color: method === m ? P.heading : P.muted,
                                                background: method === m ? P.blueDim : "rgba(255,255,255,0.02)",
                                                border: `1px solid ${method === m ? P.borderHover : P.border}`,
                                            }}
                                        >
                                            {methodLabels[m]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Right: Results ── */}
                        <motion.div
                            variants={staggerContainer}
                            initial="hidden"
                            animate={isInView ? "visible" : "hidden"}
                            custom={0.2}
                        >
                            {/* Hours saved */}
                            <motion.div
                                variants={staggerItem}
                                className="rounded-xl p-4 mb-3"
                                style={{
                                    background: "rgba(59,130,246,0.05)",
                                    border: `1px solid ${P.blueDim}`,
                                }}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Clock className="w-3.5 h-3.5" style={{ color: P.blueBright }} />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: P.blueBright }}>
                                        Hours Saved / Year
                                    </span>
                                </div>
                                <div className="font-mono text-2xl font-bold" style={{ color: P.heading }}>
                                    <AnimatedNumber target={calc.hoursSaved} suffix=" hrs" />
                                </div>
                            </motion.div>

                            {/* Error reduction */}
                            <motion.div
                                variants={staggerItem}
                                className="rounded-xl p-4 mb-3"
                                style={{
                                    background: "rgba(245,158,11,0.05)",
                                    border: `1px solid ${P.amberDim}`,
                                }}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <TrendingDown className="w-3.5 h-3.5" style={{ color: P.amber }} />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: P.amber }}>
                                        Payroll Error Reduction
                                    </span>
                                </div>
                                <div className="font-mono text-2xl font-bold" style={{ color: P.heading }}>
                                    <AnimatedNumber target={calc.errorReduction} suffix="%" />
                                </div>
                            </motion.div>

                            {/* Total BDT savings */}
                            <motion.div
                                variants={staggerItem}
                                className="rounded-xl p-4"
                                style={{
                                    background: P.emeraldDim,
                                    border: `1px solid rgba(16,185,129,0.25)`,
                                }}
                            >
                                <div className="flex items-center gap-2 mb-1.5">
                                    <DollarSign className="w-3.5 h-3.5" style={{ color: P.emerald }} />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: P.emerald }}>
                                        Total BDT Saved / Year
                                    </span>
                                </div>
                                <div className="font-mono text-3xl font-bold" style={{ color: P.heading }}>
                                    ৳<AnimatedNumber target={calc.totalSavingsBdt} />
                                </div>
                                <div className="text-[10px] mt-1" style={{ color: P.muted }}>
                                    Time savings + error reduction combined
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>

                    {/* ── CTA ── */}
                    <motion.div
                        variants={fadeUp}
                        initial="hidden"
                        animate={isInView ? "visible" : "hidden"}
                        custom={0.4}
                        className="mt-8 pt-7 text-center"
                        style={{ borderTop: `1px solid ${P.border}` }}
                    >
                        <a
                            href="/register"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-[14px] no-underline cursor-pointer transition-transform duration-300 hover:scale-[1.03]"
                            style={{
                                background: P.gradBrand,
                                boxShadow: `0 0 28px ${P.blueDim}, 0 6px 20px rgba(0,0,0,0.4)`,
                            }}
                        >
                            Claim your savings — Start free
                            <ArrowRight className="w-4 h-4" />
                        </a>
                        <div className="text-[11px] mt-3" style={{ color: P.subtle }}>
                            Estimates based on BD HR benchmarks · Actual results vary by team size
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
