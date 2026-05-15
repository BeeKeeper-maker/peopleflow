"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Building2,
    Users,
    CreditCard,
    Shield,
    Power,
    UserCog,
    AlertTriangle,
    Layers,
    X,
    Save,
    CalendarPlus,
    SlidersHorizontal,
    Mail,
    Image as ImageIcon,
    Database,
    Activity,
} from "lucide-react";

type FeatureKey =
    | "payroll"
    | "biometric"
    | "expenses"
    | "loans"
    | "recruitment"
    | "performance"
    | "customDocuments"
    | "advancedReports"
    | "compliance"
    | "apiAccess";

interface Plan {
    id: string;
    name: string;
    slug: string;
    priceMonthly: number;
    priceYearly: number;
    maxEmployees: number;
    maxAdmins: number;
    maxBranches: number;
    maxDevices: number;
    maxStorageMB: number;
    features?: Record<string, boolean>;
}

interface TenantResponse {
    tenant: {
        id: string;
        name: string;
        slug: string;
        status: string;
        countryCode: string;
        currencyCode: string;
        createdAt: string;
        suspendedAt?: string;
        suspendedReason?: string;
    };
    subscription?: {
        id: string;
        status: string;
        billingCycle: string;
        currentPeriodEnd?: string;
        trialEnd?: string;
        maxEmployeesOverride?: number | null;
        maxStorageOverride?: number | null;
        customLimitOverrides?: Record<string, number>;
        featureOverrides?: Record<string, boolean>;
        effectiveLimits?: {
            maxEmployees: number;
            maxAdmins: number;
            maxBranches: number;
            maxDevices: number;
            maxStorageMB: number;
        };
        effectiveFeatures?: Record<string, boolean>;
        plan?: Plan;
    } | null;
    resourceCounts?: { employees: number; users: number; branches: number; departments: number };
    usageSummary?: {
        employees: number;
        users: number;
        branches: number;
        departments: number;
        storageMB: number;
        storageBytes: number;
        emailsSent: number;
        imagesUploaded: number;
        apiCalls: number;
        featureEvents: Array<{ metric: string; value: number; recordedAt: string }>;
    };
}

const STATUS_STYLES: Record<string, string> = {
    active: "text-emerald-400 bg-emerald-500/10",
    trialing: "text-blue-400 bg-blue-500/10",
    suspended: "text-red-400 bg-red-500/10",
    deactivated: "text-zinc-400 bg-zinc-500/10",
    past_due: "text-amber-400 bg-amber-500/10",
};

const FEATURE_LABELS: Record<FeatureKey, string> = {
    payroll: "Payroll",
    biometric: "Biometric / Fingerprint",
    expenses: "Expenses",
    loans: "Loans & Advances",
    recruitment: "Recruitment",
    performance: "Performance",
    customDocuments: "Documents",
    advancedReports: "Advanced Reports",
    compliance: "Compliance",
    apiAccess: "API Access",
};

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];

const formatLimit = (value: number) => (value === -1 ? "Unlimited" : value.toLocaleString());
const inputLimitValue = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

export default function TenantDetailPage() {
    const params = useParams();
    const router = useRouter();
    const tenantId = params.id as string;

    const [data, setData] = useState<TenantResponse | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showKillSwitch, setShowKillSwitch] = useState(false);
    const [showImpersonation, setShowImpersonation] = useState(false);
    const [killReason, setKillReason] = useState("");
    const [impersonationReason, setImpersonationReason] = useState("");
    const [selectedPlanSlug, setSelectedPlanSlug] = useState("");
    const [trialDays, setTrialDays] = useState("14");
    const [limitForm, setLimitForm] = useState({
        maxEmployeesOverride: "",
        maxAdmins: "",
        maxBranches: "",
        maxDevices: "",
        maxStorageOverride: "",
    });
    const [featureForm, setFeatureForm] = useState<Record<FeatureKey, boolean>>({
        payroll: true,
        recruitment: true,
        performance: true,
        biometric: false,
        expenses: false,
        loans: false,
        customDocuments: false,
        advancedReports: false,
        compliance: false,
        apiAccess: false,
    });
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const loadTenant = useCallback(async () => {
        const res = await fetch(`/api/platform/tenants/${tenantId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load tenant");
        const payload = (await res.json()) as TenantResponse;
        setData(payload);

        const sub = payload.subscription;
        const effectiveLimits = sub?.effectiveLimits;
        setSelectedPlanSlug(sub?.plan?.slug || "");
        setLimitForm({
            maxEmployeesOverride: inputLimitValue(sub?.maxEmployeesOverride),
            maxAdmins: inputLimitValue(sub?.customLimitOverrides?.maxAdmins ?? effectiveLimits?.maxAdmins),
            maxBranches: inputLimitValue(sub?.customLimitOverrides?.maxBranches ?? effectiveLimits?.maxBranches),
            maxDevices: inputLimitValue(sub?.customLimitOverrides?.maxDevices ?? effectiveLimits?.maxDevices),
            maxStorageOverride: inputLimitValue(sub?.maxStorageOverride),
        });
        setFeatureForm((prev) => ({
            ...prev,
            ...((sub?.effectiveFeatures || {}) as Record<FeatureKey, boolean>),
        }));
    }, [tenantId]);

    useEffect(() => {
        Promise.all([
            loadTenant(),
            fetch("/api/platform/plans", { credentials: "include" })
                .then((r) => r.json())
                .then((payload) => setPlans(payload.plans || [])),
        ])
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [loadTenant]);

    const tenant = data?.tenant;
    const sub = data?.subscription;
    const plan = sub?.plan;
    const counts = data?.resourceCounts || { employees: 0, users: 0, branches: 0, departments: 0 };
    const usage = data?.usageSummary;
    const limits = sub?.effectiveLimits;

    const activeCustomizations = useMemo(() => {
        const items = [];
        if (sub?.maxEmployeesOverride !== null && sub?.maxEmployeesOverride !== undefined) items.push("employee limit");
        if (sub?.maxStorageOverride !== null && sub?.maxStorageOverride !== undefined) items.push("storage limit");
        if (Object.keys(sub?.customLimitOverrides || {}).length) items.push("admin/branch/device limits");
        if (Object.keys(sub?.featureOverrides || {}).length) items.push("feature access");
        return items;
    }, [sub]);

    const runAction = async (label: string, action: () => Promise<void>) => {
        setActionLoading(label);
        setMessage(null);
        try {
            await action();
            await loadTenant();
            setMessage("Saved successfully.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Action failed.");
        } finally {
            setActionLoading(null);
        }
    };

    const patchSubscription = async (body: Record<string, unknown>) => {
        const res = await fetch(`/api/platform/tenants/${tenantId}/subscription`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(body),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error || "Subscription update failed");
    };

    const handleKillSwitch = async (action: "suspend" | "activate") => {
        await runAction(action, async () => {
            const res = await fetch(`/api/platform/tenants/${tenantId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action, reason: killReason }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || "Tenant status update failed");
            setShowKillSwitch(false);
            setKillReason("");
        });
    };

    const handleImpersonate = async () => {
        await runAction("impersonate", async () => {
            const res = await fetch("/api/platform/impersonate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action: "start", organizationId: tenantId, reason: impersonationReason }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload.success) throw new Error(payload.error || "Impersonation failed");
            setShowImpersonation(false);
            setImpersonationReason("");
            window.open("/dashboard", "_blank");
        });
    };

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-8 w-48 rounded bg-white/[0.04]" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-white/[0.03]" />)}
                </div>
            </div>
        );
    }

    if (!tenant) return <div className="text-zinc-500">Tenant not found</div>;

    return (
        <div className="space-y-6">
            <div>
                <button onClick={() => router.push("/platform/tenants")} className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> Back to Tenants
                </button>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-lg font-bold text-indigo-400">
                            {tenant.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-bold text-white">{tenant.name}</h1>
                            <p className="truncate text-sm text-zinc-500 font-mono">{tenant.slug} • Created {new Date(tenant.createdAt).toLocaleDateString()}</p>
                            {activeCustomizations.length > 0 && (
                                <p className="mt-1 text-xs text-indigo-300">Custom deal active: {activeCustomizations.join(", ")}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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

            {message && <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">{message}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <InfoCard title="Organization" icon={<Building2 className="w-4 h-4 text-indigo-400" />}>
                    <InfoRow label="Country" value={tenant.countryCode || "BD"} />
                    <InfoRow label="Currency" value={tenant.currencyCode || "BDT"} />
                    <InfoRow label="Employees" value={counts.employees} />
                    <InfoRow label="Admins" value={counts.users} />
                    <InfoRow label="Branches" value={counts.branches} />
                    <InfoRow label="Departments" value={counts.departments} />
                </InfoCard>

                <InfoCard title="Subscription" icon={<CreditCard className="w-4 h-4 text-violet-400" />}>
                    {sub ? (
                        <>
                            <div className="p-3 rounded-lg bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/10">
                                <p className="text-lg font-bold text-white">{plan?.name || "—"}</p>
                                <p className="text-sm text-indigo-300">৳{plan?.priceMonthly?.toLocaleString()}/mo</p>
                            </div>
                            <InfoRow label="Status" value={sub.status} />
                            <InfoRow label="Billing" value={sub.billingCycle} />
                            <InfoRow label="Period End" value={sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"} />
                            <InfoRow label="Trial End" value={sub.trialEnd ? new Date(sub.trialEnd).toLocaleDateString() : "—"} />
                        </>
                    ) : <p className="text-sm text-zinc-500">No subscription</p>}
                </InfoCard>

                <InfoCard title="Usage Limits" icon={<Layers className="w-4 h-4 text-amber-400" />}>
                    {limits ? (
                        <>
                            <UsageBar label="Employees" current={counts.employees} limit={limits.maxEmployees} />
                            <UsageBar label="Admins" current={counts.users} limit={limits.maxAdmins} />
                            <UsageBar label="Branches" current={counts.branches} limit={limits.maxBranches} />
                            <UsageBar label="Devices" current={0} limit={limits.maxDevices} />
                        </>
                    ) : <p className="text-sm text-zinc-500">No plan limits</p>}
                </InfoCard>
            </div>



            <InfoCard title="Company Usage Intelligence" icon={<Activity className="w-4 h-4 text-cyan-400" />}>
                <p className="text-sm text-zinc-500">Owner-level telemetry for support, billing psychology, abuse monitoring, and upgrade conversations.</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricTile icon={<Users className="w-4 h-4" />} label="Employees" value={usage?.employees ?? counts.employees} />
                    <MetricTile icon={<Mail className="w-4 h-4" />} label="Emails sent" value={usage?.emailsSent ?? 0} />
                    <MetricTile icon={<ImageIcon className="w-4 h-4" />} label="Images uploaded" value={usage?.imagesUploaded ?? 0} />
                    <MetricTile icon={<Database className="w-4 h-4" />} label="Storage used" value={`${usage?.storageMB ?? 0} MB`} />
                    <MetricTile icon={<Building2 className="w-4 h-4" />} label="Branches" value={usage?.branches ?? counts.branches} />
                    <MetricTile icon={<Shield className="w-4 h-4" />} label="Admins/users" value={usage?.users ?? counts.users} />
                    <MetricTile icon={<Layers className="w-4 h-4" />} label="API calls" value={usage?.apiCalls ?? 0} />
                    <MetricTile icon={<SlidersHorizontal className="w-4 h-4" />} label="Feature signals" value={usage?.featureEvents?.length ?? 0} />
                </div>
                {usage?.featureEvents?.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {usage.featureEvents.map((event) => (
                            <div key={`${event.metric}-${event.recordedAt}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs">
                                <div className="flex justify-between gap-2 text-zinc-300"><span>{event.metric}</span><span className="font-semibold text-white">{event.value}</span></div>
                                <p className="mt-1 text-zinc-600">{new Date(event.recordedAt).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                ) : null}
            </InfoCard>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <InfoCard title="Package Control" icon={<SlidersHorizontal className="w-4 h-4 text-indigo-400" />}>
                    <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Plan</label>
                    <select value={selectedPlanSlug} onChange={(e) => setSelectedPlanSlug(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-[#11111b] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50">
                        {plans.map((p) => <option key={p.id} value={p.slug}>{p.name} — ৳{p.priceMonthly.toLocaleString()}/mo</option>)}
                    </select>
                    <button
                        onClick={() => runAction("change-plan", () => patchSubscription({ action: "change_plan", planSlug: selectedPlanSlug, reason: "Platform owner package adjustment" }))}
                        disabled={actionLoading === "change-plan" || !selectedPlanSlug || selectedPlanSlug === plan?.slug}
                        className="mt-3 h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50"
                    >
                        <Save className="inline w-4 h-4 mr-1" /> Save Plan
                    </button>
                </InfoCard>

                <InfoCard title="Trial Control" icon={<CalendarPlus className="w-4 h-4 text-blue-400" />}>
                    <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Extend Trial By Days</label>
                    <input value={trialDays} onChange={(e) => setTrialDays(e.target.value)} type="number" min="1" max="90" className="w-full h-10 px-3 rounded-lg bg-[#11111b] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                    <button
                        onClick={() => runAction("extend-trial", () => patchSubscription({ action: "extend_trial", days: Number(trialDays), reason: "Platform owner trial extension" }))}
                        disabled={actionLoading === "extend-trial"}
                        className="mt-3 h-9 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition disabled:opacity-50"
                    >
                        Extend Trial
                    </button>
                </InfoCard>

                <InfoCard title="Custom Limits" icon={<Users className="w-4 h-4 text-emerald-400" />}>
                    <div className="grid grid-cols-2 gap-2">
                        <LimitInput label="Employees" value={limitForm.maxEmployeesOverride} onChange={(v) => setLimitForm((p) => ({ ...p, maxEmployeesOverride: v }))} placeholder={plan ? formatLimit(plan.maxEmployees) : ""} />
                        <LimitInput label="Admins" value={limitForm.maxAdmins} onChange={(v) => setLimitForm((p) => ({ ...p, maxAdmins: v }))} />
                        <LimitInput label="Branches" value={limitForm.maxBranches} onChange={(v) => setLimitForm((p) => ({ ...p, maxBranches: v }))} />
                        <LimitInput label="Devices" value={limitForm.maxDevices} onChange={(v) => setLimitForm((p) => ({ ...p, maxDevices: v }))} />
                        <LimitInput label="Storage MB" value={limitForm.maxStorageOverride} onChange={(v) => setLimitForm((p) => ({ ...p, maxStorageOverride: v }))} placeholder={plan ? formatLimit(plan.maxStorageMB) : ""} />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">Use -1 for unlimited. Empty employee/storage resets to plan default.</p>
                    <button
                        onClick={() => runAction("limits", () => patchSubscription({ action: "override_limits", ...limitForm, reason: "Platform owner custom package limits" }))}
                        disabled={actionLoading === "limits"}
                        className="mt-3 h-9 px-4 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                        Save Limits
                    </button>
                </InfoCard>
            </div>

            <InfoCard title="Feature Access Control" icon={<Shield className="w-4 h-4 text-violet-400" />}>
                <p className="text-sm text-zinc-500 mb-4">Enable only the modules this company paid for. These overrides merge on top of the selected plan and are audit-logged.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {FEATURE_KEYS.map((key) => (
                        <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-zinc-200">
                            <span>{FEATURE_LABELS[key]}</span>
                            <input
                                type="checkbox"
                                checked={featureForm[key]}
                                onChange={(e) => setFeatureForm((prev) => ({ ...prev, [key]: e.target.checked }))}
                                className="h-4 w-4 accent-indigo-500"
                            />
                        </label>
                    ))}
                </div>
                <button
                    onClick={() => runAction("features", () => patchSubscription({ action: "override_features", featureOverrides: featureForm, reason: "Platform owner custom feature access" }))}
                    disabled={actionLoading === "features"}
                    className="mt-4 h-9 px-4 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition disabled:opacity-50"
                >
                    Save Feature Access
                </button>
            </InfoCard>

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
                            <input value={killReason} onChange={(e) => setKillReason(e.target.value)} placeholder="e.g., Payment failure" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowKillSwitch(false)} className="h-9 px-4 rounded-lg text-sm text-zinc-400 hover:text-white transition">Cancel</button>
                        <button onClick={() => handleKillSwitch(tenant.status === "suspended" ? "activate" : "suspend")} disabled={!!actionLoading} className={`h-9 px-4 rounded-lg text-sm font-medium text-white transition ${tenant.status === "suspended" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"} disabled:opacity-50`}>
                            {actionLoading ? "Processing..." : tenant.status === "suspended" ? "Reactivate" : "Suspend Now"}
                        </button>
                    </div>
                </Modal>
            )}

            {showImpersonation && (
                <Modal onClose={() => setShowImpersonation(false)} title="🔐 Impersonate Tenant">
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/15 text-amber-400 text-sm mb-4 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Full Access Mode</p>
                            <p className="text-xs text-amber-500/80 mt-0.5">Session expires in 1 hour. All actions are audit-logged.</p>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">Reason (required)</label>
                        <input value={impersonationReason} onChange={(e) => setImpersonationReason(e.target.value)} placeholder="e.g., Support ticket #1234" className="w-full h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-indigo-500/50" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowImpersonation(false)} className="h-9 px-4 rounded-lg text-sm text-zinc-400 hover:text-white transition">Cancel</button>
                        <button onClick={handleImpersonate} disabled={!!actionLoading || impersonationReason.trim().length < 3} className="h-9 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50">
                            {actionLoading ? "Starting..." : "Start Session"}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">{icon} {title}</div>
            {children}
        </div>
    );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="mb-3 text-cyan-400">{icon}</div>
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-white tabular-nums">{String(value)}</p>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500">{label}</span>
            <span className="text-white font-medium tabular-nums">{String(value)}</span>
        </div>
    );
}

function LimitInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs text-zinc-500">{label}</span>
            <input value={value} onChange={(e) => onChange(e.target.value)} type="number" placeholder={placeholder} className="w-full h-9 px-3 rounded-lg bg-[#11111b] border border-white/[0.08] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50" />
        </label>
    );
}

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
    const isUnlimited = limit === -1;
    const pct = isUnlimited ? 10 : Math.min((current / Math.max(limit, 1)) * 100, 100);
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
                <div className={`h-full rounded-full transition-all duration-500 ${isOver ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
