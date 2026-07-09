"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
    ArrowLeft,
    ArrowRight,
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
    deactivated: "text-muted-foreground bg-zinc-500/10",
    past_due: "text-amber-400 bg-amber-500/10",
};

const FEATURE_KEYS: FeatureKey[] = [
    "payroll",
    "biometric",
    "expenses",
    "loans",
    "recruitment",
    "performance",
    "customDocuments",
    "advancedReports",
    "compliance",
    "apiAccess",
];

const inputLimitValue = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

export default function TenantDetailPage() {
    const t = useTranslations("Platform");
    const formatLimit = (value: number) => (value === -1 ? t("unlimited") : value.toLocaleString());
    const FEATURE_LABELS: Record<FeatureKey, string> = {
        payroll: t("featurePayroll"),
        biometric: t("tenantFeatureBiometric"),
        expenses: t("tenantFeatureExpenses"),
        loans: t("tenantFeatureLoans"),
        recruitment: t("featureRecruitment"),
        performance: t("tenantFeaturePerformance"),
        customDocuments: t("tenantFeatureDocuments"),
        advancedReports: t("tenantFeatureAdvancedReports"),
        compliance: t("tenantFeatureCompliance"),
        apiAccess: t("tenantFeatureApiAccess"),
    };
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
    const [activity, setActivity] = useState<Array<{
        id: string;
        action: string;
        targetType: string;
        createdAt: string;
        platformAdmin?: { name: string };
        metadata?: Record<string, unknown>;
    }>>([]);
    const [activityLoading, setActivityLoading] = useState(false);

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

    // Fetch tenant activity timeline (audit logs filtered by targetId = tenantId)
    const fetchActivity = useCallback(async () => {
        setActivityLoading(true);
        try {
            const res = await fetch(`/api/platform/audit-logs?targetType=organization&targetId=${tenantId}&limit=20`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setActivity(data.logs || []);
            }
        } catch {
            // Silent fail — activity timeline is a secondary feature
        } finally {
            setActivityLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

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
            setMessage(t("savedSuccessfullyMessage"));
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
                <div className="h-8 w-48 rounded bg-hover" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-xl bg-hover" />)}
                </div>
            </div>
        );
    }

    if (!tenant) return <div className="text-muted-foreground">{t("tenantNotFound")}</div>;

    return (
        <div className="space-y-6">
            <div>
                <button onClick={() => router.push("/platform/tenants")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> {t("backToTenants")}
                </button>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center text-lg font-bold text-indigo-400">
                            {tenant.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-bold text-foreground">{tenant.name}</h1>
                            <p className="truncate text-sm text-muted-foreground font-mono">{tenant.slug} • {t("created")} {new Date(tenant.createdAt).toLocaleDateString()}</p>
                            {activeCustomizations.length > 0 && (
                                <p className="mt-1 text-xs text-indigo-300">{t("customDealActive", { items: activeCustomizations.join(", ") })}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_STYLES[tenant.status] || STATUS_STYLES.active}`}>
                            {tenant.status.toUpperCase()}
                        </span>
                        <button onClick={() => setShowImpersonation(true)} className="h-9 px-3 rounded-lg bg-hover border border-border text-sm text-muted-foreground hover:text-foreground hover:border-indigo-500/30 flex items-center gap-2 transition-all">
                            <UserCog className="w-4 h-4" /> {t("impersonate")}
                        </button>
                        <button onClick={() => setShowKillSwitch(true)} className={`h-9 px-3 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                            tenant.status === "suspended"
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                        }`}>
                            <Power className="w-4 h-4" />
                            {tenant.status === "suspended" ? t("reactivate") : t("suspend")}
                        </button>
                    </div>
                </div>
            </div>

            {message && <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">{message}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <InfoCard title={t("organization")} icon={<Building2 className="w-4 h-4 text-indigo-400" />}>
                    <InfoRow label={t("country")} value={tenant.countryCode || "BD"} />
                    <InfoRow label={t("currency")} value={tenant.currencyCode || "BDT"} />
                    <InfoRow label={t("employees")} value={counts.employees} />
                    <InfoRow label={t("admins")} value={counts.users} />
                    <InfoRow label={t("branches")} value={counts.branches} />
                    <InfoRow label={t("departments")} value={counts.departments} />
                </InfoCard>

                <InfoCard title={t("subscription")} icon={<CreditCard className="w-4 h-4 text-violet-400" />}>
                    {sub ? (
                        <>
                            <div className="p-3 rounded-lg bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/10">
                                <p className="text-lg font-bold text-foreground">{plan?.name || "—"}</p>
                                <p className="text-sm text-indigo-300">৳{plan?.priceMonthly?.toLocaleString()}{t("perMonth")}</p>
                            </div>
                            <InfoRow label={t("statusColumn")} value={sub.status} />
                            <InfoRow label={t("billingLabel")} value={sub.billingCycle} />
                            <InfoRow label={t("periodEnd")} value={sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : "—"} />
                            <InfoRow label={t("trialEnd")} value={sub.trialEnd ? new Date(sub.trialEnd).toLocaleDateString() : "—"} />
                        </>
                    ) : <p className="text-sm text-muted-foreground">{t("noSubscription")}</p>}
                </InfoCard>

                <InfoCard title={t("usageLimits")} icon={<Layers className="w-4 h-4 text-amber-400" />}>
                    {limits ? (
                        <>
                            <UsageBar label={t("employees")} current={counts.employees} limit={limits.maxEmployees} />
                            <UsageBar label={t("admins")} current={counts.users} limit={limits.maxAdmins} />
                            <UsageBar label={t("branches")} current={counts.branches} limit={limits.maxBranches} />
                            <UsageBar label={t("devices")} current={0} limit={limits.maxDevices} />
                        </>
                    ) : <p className="text-sm text-muted-foreground">{t("noPlanLimits")}</p>}
                </InfoCard>
            </div>



            <InfoCard title={t("companyUsageIntelligence")} icon={<Activity className="w-4 h-4 text-cyan-400" />}>
                <p className="text-sm text-muted-foreground">{t("companyUsageIntelligenceDesc")}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricTile icon={<Users className="w-4 h-4" />} label={t("employees")} value={usage?.employees ?? counts.employees} />
                    <MetricTile icon={<Mail className="w-4 h-4" />} label={t("emailsSent")} value={usage?.emailsSent ?? 0} />
                    <MetricTile icon={<ImageIcon className="w-4 h-4" />} label={t("imagesUploaded")} value={usage?.imagesUploaded ?? 0} />
                    <MetricTile icon={<Database className="w-4 h-4" />} label={t("storageUsed")} value={`${usage?.storageMB ?? 0} MB`} />
                    <MetricTile icon={<Building2 className="w-4 h-4" />} label={t("branches")} value={usage?.branches ?? counts.branches} />
                    <MetricTile icon={<Shield className="w-4 h-4" />} label={t("adminsUsers")} value={usage?.users ?? counts.users} />
                    <MetricTile icon={<Layers className="w-4 h-4" />} label={t("apiCalls")} value={usage?.apiCalls ?? 0} />
                    <MetricTile icon={<SlidersHorizontal className="w-4 h-4" />} label={t("featureSignals")} value={usage?.featureEvents?.length ?? 0} />
                </div>
                {usage?.featureEvents?.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {usage.featureEvents.map((event) => (
                            <div key={`${event.metric}-${event.recordedAt}`} className="rounded-lg border border-border bg-hover/50 px-3 py-2 text-xs">
                                <div className="flex justify-between gap-2 text-foreground"><span>{event.metric}</span><span className="font-semibold text-foreground">{event.value}</span></div>
                                <p className="mt-1 text-muted-foreground">{new Date(event.recordedAt).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                ) : null}
            </InfoCard>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <InfoCard title={t("packageControl")} icon={<SlidersHorizontal className="w-4 h-4 text-indigo-400" />}>
                    <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("plan")}</label>
                    <select value={selectedPlanSlug} onChange={(e) => setSelectedPlanSlug(e.target.value)} className="w-full h-10 px-3 rounded-lg bg-hover border border-border text-sm text-foreground focus:outline-none focus:border-indigo-500/50">
                        {plans.map((p) => <option key={p.id} value={p.slug}>{p.name} — ৳{p.priceMonthly.toLocaleString()}{t("perMonth")}</option>)}
                    </select>
                    <button
                        onClick={() => runAction("change-plan", () => patchSubscription({ action: "change_plan", planSlug: selectedPlanSlug, reason: "Platform owner package adjustment" }))}
                        disabled={actionLoading === "change-plan" || !selectedPlanSlug || selectedPlanSlug === plan?.slug}
                        className="mt-3 h-9 px-4 rounded-lg text-sm font-medium text-foreground bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50"
                    >
                        <Save className="inline w-4 h-4 mr-1" /> {t("savePlan")}
                    </button>
                </InfoCard>

                <InfoCard title={t("trialControl")} icon={<CalendarPlus className="w-4 h-4 text-blue-400" />}>
                    <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("extendTrialByDays")}</label>
                    <input value={trialDays} onChange={(e) => setTrialDays(e.target.value)} type="number" min="1" max="90" className="w-full h-10 px-3 rounded-lg bg-hover border border-border text-sm text-foreground focus:outline-none focus:border-indigo-500/50" />
                    <button
                        onClick={() => runAction("extend-trial", () => patchSubscription({ action: "extend_trial", days: Number(trialDays), reason: "Platform owner trial extension" }))}
                        disabled={actionLoading === "extend-trial"}
                        className="mt-3 h-9 px-4 rounded-lg text-sm font-medium text-foreground bg-blue-600 hover:bg-blue-500 transition disabled:opacity-50"
                    >
                        {t("extendTrial")}
                    </button>
                </InfoCard>

                <InfoCard title={t("customLimits")} icon={<Users className="w-4 h-4 text-emerald-400" />}>
                    <div className="grid grid-cols-2 gap-2">
                        <LimitInput label={t("employees")} value={limitForm.maxEmployeesOverride} onChange={(v) => setLimitForm((p) => ({ ...p, maxEmployeesOverride: v }))} placeholder={plan ? formatLimit(plan.maxEmployees) : ""} />
                        <LimitInput label={t("admins")} value={limitForm.maxAdmins} onChange={(v) => setLimitForm((p) => ({ ...p, maxAdmins: v }))} />
                        <LimitInput label={t("branches")} value={limitForm.maxBranches} onChange={(v) => setLimitForm((p) => ({ ...p, maxBranches: v }))} />
                        <LimitInput label={t("devices")} value={limitForm.maxDevices} onChange={(v) => setLimitForm((p) => ({ ...p, maxDevices: v }))} />
                        <LimitInput label={t("storageMB")} value={limitForm.maxStorageOverride} onChange={(v) => setLimitForm((p) => ({ ...p, maxStorageOverride: v }))} placeholder={plan ? formatLimit(plan.maxStorageMB) : ""} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{t("customLimitsHelp")}</p>
                    <button
                        onClick={() => runAction("limits", () => patchSubscription({ action: "override_limits", ...limitForm, reason: "Platform owner custom package limits" }))}
                        disabled={actionLoading === "limits"}
                        className="mt-3 h-9 px-4 rounded-lg text-sm font-medium text-foreground bg-emerald-600 hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                        {t("saveLimits")}
                    </button>
                </InfoCard>
            </div>

            <InfoCard title={t("featureAccessControl")} icon={<Shield className="w-4 h-4 text-violet-400" />}>
                <p className="text-sm text-muted-foreground mb-4">{t("featureAccessControlDesc")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {FEATURE_KEYS.map((key) => (
                        <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-hover/50 px-4 py-3 text-sm text-foreground">
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
                    className="mt-4 h-9 px-4 rounded-lg text-sm font-medium text-foreground bg-violet-600 hover:bg-violet-500 transition disabled:opacity-50"
                >
                    {t("saveFeatureAccess")}
                </button>
            </InfoCard>

            {/* Activity Timeline */}
            <InfoCard title={t("activityTimeline")} icon={<Activity className="w-4 h-4 text-cyan-400" />}>
                {activityLoading ? (
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex gap-3">
                                <div className="w-2 h-2 rounded-full bg-zinc-700 mt-1.5 shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 w-1/2 rounded bg-hover animate-pulse" />
                                    <div className="h-2.5 w-1/4 rounded bg-hover animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activity.length === 0 ? (
                    <div className="text-center py-6">
                        <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">{t("noActivityRecorded")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{t("noActivityRecordedDesc")}</p>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                        {activity.map((log) => {
                            const iconColor = log.action.includes("suspend") || log.action.includes("deactivate")
                                ? "bg-red-500"
                                : log.action.includes("activate") || log.action.includes("provision")
                                    ? "bg-emerald-500"
                                    : log.action.includes("trial") || log.action.includes("override")
                                        ? "bg-amber-500"
                                        : "bg-indigo-500";
                            return (
                                <div key={log.id} className="flex gap-3 group">
                                    <div className="flex flex-col items-center shrink-0">
                                        <div className={`w-2 h-2 rounded-full ${iconColor} mt-1.5`} />
                                        <div className="w-px flex-1 bg-hover mt-1" />
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-mono font-medium text-indigo-300">
                                                {log.action}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(log.createdAt).toLocaleString("en-US", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>
                                        </div>
                                        {log.platformAdmin?.name && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {t("byWord")} <span className="text-foreground font-medium">{log.platformAdmin.name}</span>
                                            </p>
                                        )}
                                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                                            <details className="mt-1.5">
                                                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-muted-foreground select-none">
                                                    {t("viewDetails")}
                                                </summary>
                                                <pre className="text-[10px] text-muted-foreground mt-1 p-2 rounded bg-hover/50 overflow-x-auto">
{JSON.stringify(log.metadata, null, 2)}
                                                </pre>
                                            </details>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {activity.length > 0 && (
                    <Link
                        href={`/platform/audit-logs?targetType=organization&targetId=${tenantId}`}
                        className="inline-flex items-center gap-1 mt-3 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        {t("viewAllEntries", { count: activity.length })}
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                )}
            </InfoCard>

            {showKillSwitch && (
                <Modal onClose={() => setShowKillSwitch(false)} title={tenant.status === "suspended" ? t("reactivateTenant") : t("suspendTenant")}>
                    <p className="text-sm text-muted-foreground mb-4">
                        {tenant.status === "suspended"
                            ? t("restoreAccess", { name: tenant.name })
                            : t("blockAccess", { name: tenant.name })}
                    </p>
                    {tenant.status !== "suspended" && (
                        <div className="mb-4">
                            <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("reason")}</label>
                            <input value={killReason} onChange={(e) => setKillReason(e.target.value)} placeholder="e.g., Payment failure" className="w-full h-10 px-3 rounded-lg bg-hover border border-border text-sm text-foreground focus:outline-none focus:border-indigo-500/50" />
                        </div>
                    )}
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowKillSwitch(false)} className="h-9 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground transition">{t("cancel")}</button>
                        <button onClick={() => handleKillSwitch(tenant.status === "suspended" ? "activate" : "suspend")} disabled={!!actionLoading} className={`h-9 px-4 rounded-lg text-sm font-medium text-foreground transition ${tenant.status === "suspended" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"} disabled:opacity-50`}>
                            {actionLoading ? t("processing") : tenant.status === "suspended" ? t("reactivate") : t("suspendNow")}
                        </button>
                    </div>
                </Modal>
            )}

            {showImpersonation && (
                <Modal onClose={() => setShowImpersonation(false)} title={t("impersonateTenant")}>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/15 text-amber-400 text-sm mb-4 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">{t("fullAccessMode")}</p>
                            <p className="text-xs text-amber-500/80 mt-0.5">{t("sessionExpires")}</p>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-xs text-muted-foreground uppercase tracking-wider mb-2">{t("reasonRequired")}</label>
                        <input value={impersonationReason} onChange={(e) => setImpersonationReason(e.target.value)} placeholder="e.g., Support ticket #1234" className="w-full h-10 px-3 rounded-lg bg-hover border border-border text-sm text-foreground focus:outline-none focus:border-indigo-500/50" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowImpersonation(false)} className="h-9 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground transition">{t("cancel")}</button>
                        <button onClick={handleImpersonate} disabled={!!actionLoading || impersonationReason.trim().length < 3} className="h-9 px-4 rounded-lg text-sm font-medium text-foreground bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50">
                            {actionLoading ? t("starting") : t("startSession")}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function InfoCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border bg-hover/50 p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">{icon} {title}</div>
            {children}
        </div>
    );
}

function MetricTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div className="rounded-xl border border-border bg-hover/50 p-4">
            <div className="mb-3 text-cyan-400">{icon}</div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-bold text-foreground tabular-nums">{String(value)}</p>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground font-medium tabular-nums">{String(value)}</span>
        </div>
    );
}

function LimitInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
    return (
        <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            <input value={value} onChange={(e) => onChange(e.target.value)} type="number" placeholder={placeholder} className="w-full h-9 px-3 rounded-lg bg-hover border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50" />
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
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-medium tabular-nums ${isOver ? "text-red-400" : "text-foreground"}`}>
                    {current} / {isUnlimited ? "∞" : limit}
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-hover overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${isOver ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-hover transition"><X className="w-4 h-4" /></button>
                </div>
                {children}
            </div>
        </div>
    );
}
