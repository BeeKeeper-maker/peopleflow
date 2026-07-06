"use client";

import { useState, useEffect } from "react";
import { X, Building2, User, Mail, CreditCard, Calendar, AlertCircle, CheckCircle2, Copy, Loader2 } from "lucide-react";

interface ProvisionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface Plan {
    id: string;
    name: string;
    slug: string;
    priceMonthly: number;
    maxEmployees: number;
}

interface ProvisionResult {
    success: boolean;
    organization?: { id: string; name: string; slug: string };
    admin?: { id: string; email: string; tempPassword: string };
    subscription?: { id: string; status: string; planSlug: string; trialEndsAt: string };
    error?: string;
}

export function ProvisionTenantModal({ isOpen, onClose, onSuccess }: ProvisionModalProps) {
    const [form, setForm] = useState({
        companyName: "",
        adminName: "",
        adminEmail: "",
        planSlug: "starter",
        trialDays: "14",
        countryCode: "BD",
        currencyCode: "BDT",
    });
    const [plans, setPlans] = useState<Plan[]>([]);
    const [plansLoaded, setPlansLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ProvisionResult | null>(null);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen || plansLoaded) return;
        const fetchPlans = async () => {
            try {
                const res = await fetch("/api/platform/plans", { credentials: "include" });
                const data = await res.json();
                if (data.plans) setPlans(data.plans);
                setPlansLoaded(true);
            } catch (err) {
                console.error("Failed to fetch plans:", err);
                setPlansLoaded(true);
            }
        };
        fetchPlans();
    }, [isOpen, plansLoaded]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch("/api/platform/tenants/provision", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to provision tenant");
                return;
            }

            setResult(data);
            onSuccess();
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCredentials = () => {
        if (!result?.admin) return;
        const creds = `Login URL: ${window.location.origin}/login
Email: ${result.admin.email}
Password: ${result.admin.tempPassword}`;
        navigator.clipboard.writeText(creds);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleClose = () => {
        setForm({
            companyName: "",
            adminName: "",
            adminEmail: "",
            planSlug: "starter",
            trialDays: "14",
            countryCode: "BD",
            currencyCode: "BDT",
        });
        setResult(null);
        setError("");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleClose}
            />

            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0F0F1A] border border-white/[0.08] shadow-2xl">
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-[#0F0F1A]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Provision New Tenant</h2>
                            <p className="text-xs text-zinc-500">Create a new organization with admin account</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6">
                    {result ? (
                        <div className="space-y-5">
                            <div className="flex flex-col items-center text-center py-4">
                                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">Tenant Provisioned Successfully</h3>
                                <p className="text-sm text-zinc-500 mt-1">
                                    <span className="text-white font-medium">{result.organization?.name}</span> is ready
                                </p>
                            </div>

                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-300">Temporary Credentials</p>
                                        <p className="text-xs text-amber-400/70 mt-0.5">
                                            Copy these now — the temp password will not be shown again.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2 mt-3">
                                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20">
                                        <div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Login URL</p>
                                            <p className="text-sm text-white font-mono">/login</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20">
                                        <div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Email</p>
                                            <p className="text-sm text-white font-mono">{result.admin?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/20">
                                        <div>
                                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Password</p>
                                            <p className="text-sm text-white font-mono">{result.admin?.tempPassword}</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCopyCredentials}
                                    className="w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] transition flex items-center justify-center gap-2"
                                >
                                    {copied ? (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            Copy Credentials
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Status</p>
                                    <p className="text-sm text-white font-medium capitalize mt-1">{result.subscription?.status}</p>
                                </div>
                                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Trial Ends</p>
                                    <p className="text-sm text-white font-medium mt-1">
                                        {result.subscription?.trialEndsAt
                                            ? new Date(result.subscription.trialEndsAt).toLocaleDateString()
                                            : "—"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleClose}
                                    className="flex-1 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] transition"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => window.open(`/platform/tenants/${result.organization?.id}`, "_self")}
                                    className="flex-1 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition"
                                >
                                    View Tenant →
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                                    <Building2 className="inline w-3 h-3 mr-1" />
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    value={form.companyName}
                                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                    required
                                    placeholder="e.g., Apex RMG Ltd."
                                    className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                                    <User className="inline w-3 h-3 mr-1" />
                                    Admin Name
                                </label>
                                <input
                                    type="text"
                                    value={form.adminName}
                                    onChange={(e) => setForm({ ...form, adminName: e.target.value })}
                                    required
                                    placeholder="e.g., Rashida Akter"
                                    className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                                    <Mail className="inline w-3 h-3 mr-1" />
                                    Admin Email
                                </label>
                                <input
                                    type="email"
                                    value={form.adminEmail}
                                    onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                                    required
                                    placeholder="admin@company.com"
                                    className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 transition"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                                        <CreditCard className="inline w-3 h-3 mr-1" />
                                        Plan
                                    </label>
                                    <select
                                        value={form.planSlug}
                                        onChange={(e) => setForm({ ...form, planSlug: e.target.value })}
                                        className="w-full h-10 px-3 rounded-lg bg-[#11111b] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50 transition"
                                    >
                                        {plans.map((p) => (
                                            <option key={p.id} value={p.slug}>
                                                {p.name} — ৳{p.priceMonthly}/mo
                                            </option>
                                        ))}
                                        {plans.length === 0 && <option value="starter">Starter</option>}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                                        <Calendar className="inline w-3 h-3 mr-1" />
                                        Trial Days
                                    </label>
                                    <input
                                        type="number"
                                        value={form.trialDays}
                                        onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                                        min="1"
                                        max="90"
                                        className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50 transition"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-300 hover:text-white hover:bg-white/[0.06] transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 h-10 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-sm text-white font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Provisioning...
                                        </>
                                    ) : (
                                        "Provision Tenant"
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
