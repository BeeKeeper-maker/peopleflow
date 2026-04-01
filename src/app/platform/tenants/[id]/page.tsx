"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, Building2, Users, CreditCard, Calendar,
    Shield, Power, UserCog, AlertTriangle, Activity,
    Layers, ChevronDown, X,
} from "lucide-react";

interface TenantDetail {
    id: string; name: string; slug: string; status: string;
    countryCode: string; currencyCode: string; createdAt: string;
    suspendedAt?: string; suspendedReason?: string;
    counts?: { employees: number; users: number; branches: number; departments: number };
    subscription?: {
        status: string; billingCycle: string;
        currentPeriodEnd?: string; trialEnd?: string;
        plan?: { name: string; slug: string; priceMonthly: number; priceYearly: number; maxEmployees: number; maxAdmins: number; maxBranches: number };
        maxEmployeesOverride?: number;
    };
}

const STATUS_STYLES: Record<string, string> = {
    active: "text-emerald-400 bg-emerald-500/10",
    trialing: "text-blue-400 bg-blue-500/10",
    suspended: "text-red-400 bg-red-500/10",
    deactivated: "text-zinc-400 bg-zinc-500/10",
    past_due: "text-amber-400 bg-amber-500/10",
};

export default function TenantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const tenantId = params.id as string;
    const [tenant, setTenant] = useState<TenantDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showKillSwitch, setShowKillSwitch] = useState(false);
    const [showImpersonation, setShowImpersonation] = useState(false);
    const [killReason, setKillReason] = useState("");
    const [impersonationReason, setImpersonationReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetch(`/api/platform/tenants/${tenantId}`, { credentials: "include" })
            .then(r => r.json())
            .then(data => setTenant(data.tenant || data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [tenantId]);

    const handleKillSwitch = async (newStatus: "suspended" | "active") => {
        setActionLoading(true);
        try {
            await fetch(`/api/platform/tenants/${tenantId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ status: newStatus, reason: killReason }),
            });
            setTenant(prev => prev ? { ...prev, status: newStatus } : null);
            setShowKillSwitch(false);
            setKillReason("");
        } catch (e) { console.error(e); }
        finally { setActionLoading(false); }
    };

    const handleImpersonate = async () => {
        setActionLoading(true);
        try {
            const res = await fetch("/api/platform/impersonate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action: "start", organizationId: tenantId, reason: impersonationReason }),
            });
            const data = await res.json();
            if (data.success) {
                window.open("/dashboard", "_blank"); // Opens tenant dashboard in new tab
            }
        } catch (e) { console.error(e); }
        finally { setActionLoading(false); setShowImpersonation(false); }
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 w-48 rounded bg-white/[0.04]" />
                <div className="grid grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-white/[0.03]" />)}
                </div>
            </div>
        );
    }

    if (!tenant) return <div className="text-zinc-500">Tenant not found</div>;

    const sub = tenant.subscription;
    const plan = sub?.plan;
    const counts = tenant.counts || { employees: 0, users: 0, branches: 0, departments: 0 };

    return (
        <div className="space-y-6">
            {/* Back + Header */}
            <div>
                <button onClick={() => router.push("/platform/tenants")} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to Tenants
                </button>
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-lg font-bold text-indigo-400">
                            {tenant.name.charAt(0)}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
                            <p className="text-sm text-zinc-500 font-mono">{tenant.slug} • Created {new Date(tenant.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLES[tenant.status] || STATUS_STYLES.active}`}>
                            {tenant.status.toUpperCase()}
                        </span>
                        <button onClick={() => setShowImpersonation(true)} className="h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-zinc-400 hover:text-white hover:border-indigo-500/30 flex items-center gap-2 transition-all">
                            <UserCog className="w-4 h-4" /> Impersonate
                        </button>
                        <button onClick={() => setShowKillSwitch(true)} className={`h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                            tenant.status === "suspended"
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                        }`}>
                            <Power className="w-4 h-4" />
                            {tenant.status === "suspended" ? "Reactivate" : "Suspend"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Organization Info */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Building2 className="w-4 h-4 text-indigo-400" /> Organization
                    </div>
                    {[
                        ["Country", tenant.countryCode || "BD"],
                        ["Currency", tenant.currencyCode || "BDT"],
                        ["Employees", counts.employees],
                        ["Admins", counts.users],
                        ["Branches", counts.branches],
                        ["Departments", counts.departments],
                    ].map(([label, value]) => (
                        <div key={String(label)} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-500">{label}</span>
                            <span className="text-white font-medium tabular-nums">{String(value)}</span>
                        </div>
                    ))}
                </div>

                {/* Subscription Card */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <CreditCard className="w-4 h-4 text-violet-400" /> Subscription
                    </div>
                    {sub ? (
                        <>
                            <div className="p-3 rounded-lg bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/10">
                                <p className="text-lg font-bold text-white">{plan?.name || "—"}</p>
                                <p className="text-sm text-indigo-300">
                                    ৳{plan?.priceMonthly?.toLocaleString()}/mo
                                </p>
                            </div>
                            {[
                                ["Status", sub.status],
                                ["Billing", sub.billingCycle],
                                ["Period End", sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"],
                                ["Trial End", sub.trialEnd ? new Date(sub.trialEnd).toLocaleDateString() : "—"],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="flex items-center justify-between text-sm">
                                    <span className="text-zinc-500">{label}</span>
                                    <span className="text-white font-medium">{String(value)}</span>
                                </div>
                            ))}
                        </>
                    ) : (
                        <p className="text-sm text-zinc-500">No subscription</p>
                    )}
                </div>

                {/* Usage Limits */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Layers className="w-4 h-4 text-amber-400" /> Plan Limits
                    </div>
                    {plan ? (
                        <>
                            <UsageBar label="Employees" current={counts.employees} limit={sub?.maxEmployeesOverride ?? plan.maxEmployees} />
                            <UsageBar label="Admins" current={counts.users} limit={plan.maxAdmins} />
                            <UsageBar label="Branches" current={counts.branches} limit={plan.maxBranches} />
                        </>
                    ) : (
                        <p className="text-sm text-zinc-500">No plan limits</p>
                    )}
                </div>
            </div>

            {/* Kill Switch Modal */}
            {showKillSwitch && (
                <Modal onClose={() => setShowKillSwitch(false)} title={tenant.status === "suspended" ? "Reactivate Tenant" : "⚠️ Suspend Tenant"}>
                    <p className="text-sm text-zinc-400 mb-4">
                        {tenant.status === "suspended"
                            ? `This will restore access for "${tenant.name}".`
                            : `This will immediately block all users of "${tenant.name}" from accessing the platform.`}
                    </p>
                    {tenant.status !== "suspended" && (
                        <div className="mb-4">
                            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Reason</label>
                            <input value={killReason} onChange={e => setKillReason(e.target.value)} placeholder="e.g., Payment failure"
                                className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowKillSwitch(false)} className="h-9 px-4 rounded-lg text-sm text-zinc-400 hover:text-white transition">Cancel</button>
                        <button onClick={() => handleKillSwitch(tenant.status === "suspended" ? "active" : "suspended")} disabled={actionLoading}
                            className={`h-9 px-4 rounded-lg text-sm font-medium text-white transition ${
                                tenant.status === "suspended" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
                            } disabled:opacity-50`}>
                            {actionLoading ? "Processing..." : tenant.status === "suspended" ? "Reactivate" : "Suspend Now"}
                        </button>
                    </div>
                </Modal>
            )}

            {/* Impersonation Modal */}
            {showImpersonation && (
                <Modal onClose={() => setShowImpersonation(false)} title="🔐 Impersonate Tenant">
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/15 text-amber-400 text-sm mb-4 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Full Access Mode</p>
                            <p className="text-xs text-amber-500/80 mt-0.5">You will see the tenant&apos;s dashboard as if you are their admin. Session expires in 1 hour. All actions are audit-logged.</p>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Reason (required)</label>
                        <input value={impersonationReason} onChange={e => setImpersonationReason(e.target.value)} placeholder="e.g., Support ticket #1234"
                            className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowImpersonation(false)} className="h-9 px-4 rounded-lg text-sm text-zinc-400 hover:text-white transition">Cancel</button>
                        <button onClick={handleImpersonate} disabled={actionLoading || !impersonationReason}
                            className="h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50">
                            {actionLoading ? "Starting..." : "Start Session"}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ── Sub-Components ──

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
    const isUnlimited = limit === -1;
    const pct = isUnlimited ? 10 : Math.min((current / limit) * 100, 100);
    const isOver = !isUnlimited && current > limit;

    return (
        <div>
            <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-500">{label}</span>
                <span className={`font-medium tabular-nums ${isOver ? "text-red-400" : "text-zinc-300"}`}>
                    {current} / {isUnlimited ? "∞" : limit}
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${
                        isOver ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl bg-[#1C1C2A] border border-white/[0.08] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition"><X className="w-4 h-4" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
