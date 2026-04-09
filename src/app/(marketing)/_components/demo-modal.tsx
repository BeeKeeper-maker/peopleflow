"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, CheckCircle2, Loader2, Building2, Users, Factory, Globe } from "lucide-react";

interface DemoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const sectorOptions = [
    { value: "rmg", label: "RMG / Garments", icon: Factory },
    { value: "corporate", label: "Corporate", icon: Building2 },
    { value: "ngo", label: "NGO / Non-Profit", icon: Globe },
    { value: "other", label: "Other", icon: Users },
];

const sizeOptions = ["1-50", "51-200", "201-500", "500+"];

export default function DemoModal({ isOpen, onClose }: DemoModalProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        name: "", email: "", phone: "", companyName: "",
        companySize: "", sector: "", message: "",
    });

    useEffect(() => {
        if (isOpen) { setStep(1); setSuccess(false); setError(""); }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        else document.body.style.overflow = "";
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    const handleSubmit = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, source: "hero_cta" }),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess(true);
            } else {
                setError(data.error || "Something went wrong. Please try again.");
            }
        } catch {
            setError("Network error. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    const canProceedStep1 = form.sector && form.companySize;
    const canProceedStep2 = form.name && form.email && form.companyName;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-100 flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3 }}
                        className="relative w-full max-w-lg rounded-2xl bg-[#0C0C14] border border-white/8 shadow-[0_40px_120px_rgba(0,0,0,0.6)] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-linear-to-b from-[#3B82F6]/20 to-transparent rounded-full blur-3xl pointer-events-none" />

                        {/* Close */}
                        <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-white/5 text-[#71717A] hover:text-white transition-colors cursor-pointer">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="relative p-8">
                            {success ? (
                                /* Success State */
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
                                    <div className="w-16 h-16 rounded-full bg-[#10B981]/15 flex items-center justify-center mx-auto mb-6">
                                        <CheckCircle2 className="w-8 h-8 text-[#10B981]" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-3">Demo Request Received!</h3>
                                    <p className="text-[#9CA3AF] mb-2">Our enterprise team will contact you within <span className="text-white font-semibold">2 business hours</span>.</p>
                                    <p className="text-sm text-[#52525B]">Check {form.email} for a confirmation.</p>
                                    <button onClick={onClose} className="mt-8 px-8 py-3 rounded-xl bg-linear-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all cursor-pointer">
                                        Done
                                    </button>
                                </motion.div>
                            ) : (
                                <>
                                    {/* Header */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Book Your VIP Demo</h3>
                                            <p className="text-xs text-[#52525B]">Step {step} of 2 — {step === 1 ? "Tell us about your company" : "Your details"}</p>
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="flex gap-2 my-6">
                                        <div className="flex-1 h-1 rounded-full bg-linear-to-r from-[#3B82F6] to-[#6366F1]" />
                                        <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${step >= 2 ? "bg-linear-to-r from-[#6366F1] to-[#8B5CF6]" : "bg-white/6"}`} />
                                    </div>

                                    {step === 1 ? (
                                        <motion.div key="step1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                                            {/* Sector */}
                                            <label className="text-sm font-medium text-white mb-3 block">What sector is your organization in?</label>
                                            <div className="grid grid-cols-2 gap-3 mb-6">
                                                {sectorOptions.map((opt) => (
                                                    <button key={opt.value} onClick={() => setForm({ ...form, sector: opt.value })}
                                                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left cursor-pointer ${form.sector === opt.value ? "border-[#3B82F6]/50 bg-[#3B82F6]/8" : "border-white/6 bg-white/2 hover:bg-white/4"}`}>
                                                        <opt.icon className={`w-5 h-5 ${form.sector === opt.value ? "text-[#3B82F6]" : "text-[#52525B]"}`} />
                                                        <span className={`text-sm font-medium ${form.sector === opt.value ? "text-white" : "text-[#A1A1AA]"}`}>{opt.label}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Company Size */}
                                            <label className="text-sm font-medium text-white mb-3 block">How many employees?</label>
                                            <div className="flex gap-2 mb-8">
                                                {sizeOptions.map((size) => (
                                                    <button key={size} onClick={() => setForm({ ...form, companySize: size })}
                                                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all cursor-pointer ${form.companySize === size ? "border-[#3B82F6]/50 bg-[#3B82F6]/8 text-white" : "border-white/6 text-[#71717A] hover:text-white hover:bg-white/4"}`}>
                                                        {size}
                                                    </button>
                                                ))}
                                            </div>

                                            <button onClick={() => setStep(2)} disabled={!canProceedStep1}
                                                className="w-full py-3.5 rounded-xl bg-linear-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all cursor-pointer">
                                                Continue
                                            </button>
                                        </motion.div>
                                    ) : (
                                        <motion.div key="step2" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
                                            <div className="space-y-4 mb-6">
                                                {[
                                                    { label: "Full Name", key: "name", type: "text", placeholder: "Md. Rahim Uddin" },
                                                    { label: "Work Email", key: "email", type: "email", placeholder: "rahim@company.com" },
                                                    { label: "Phone (Optional)", key: "phone", type: "tel", placeholder: "+880 1XXX-XXXXXX" },
                                                    { label: "Company Name", key: "companyName", type: "text", placeholder: "ABC Garments Ltd." },
                                                ].map((field) => (
                                                    <div key={field.key}>
                                                        <label className="text-sm font-medium text-white mb-1.5 block">{field.label}</label>
                                                        <input type={field.type} placeholder={field.placeholder}
                                                            value={form[field.key as keyof typeof form]}
                                                            onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                                                            className="w-full px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-white text-sm placeholder:text-[#3F3F46] focus:outline-none focus:border-[#3B82F6]/50 focus:ring-1 focus:ring-[#3B82F6]/30 transition-all" />
                                                    </div>
                                                ))}
                                                <div>
                                                    <label className="text-sm font-medium text-white mb-1.5 block">Anything specific? (Optional)</label>
                                                    <textarea placeholder="E.g., We need payroll for 3 factories..."
                                                        value={form.message}
                                                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                                                        rows={2}
                                                        className="w-full px-4 py-3 rounded-xl bg-white/4 border border-white/8 text-white text-sm placeholder:text-[#3F3F46] focus:outline-none focus:border-[#3B82F6]/50 focus:ring-1 focus:ring-[#3B82F6]/30 transition-all resize-none" />
                                                </div>
                                            </div>

                                            {error && <p className="text-sm text-[#F43F5E] mb-4">{error}</p>}

                                            <div className="flex gap-3">
                                                <button onClick={() => setStep(1)} className="px-6 py-3.5 rounded-xl bg-white/4 border border-white/8 text-[#A1A1AA] font-medium hover:bg-white/8 transition-all cursor-pointer">
                                                    Back
                                                </button>
                                                <button onClick={handleSubmit} disabled={!canProceedStep2 || loading}
                                                    className="flex-1 py-3.5 rounded-xl bg-linear-to-r from-[#3B82F6] to-[#6366F1] text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_30px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-2 cursor-pointer">
                                                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : "Request VIP Demo"}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
