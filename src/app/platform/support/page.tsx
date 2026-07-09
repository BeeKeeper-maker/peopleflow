"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Gauge,
    LifeBuoy,
    Loader2,
    Plus,
    RefreshCw,
    Router,
    Search,
    ShieldAlert,
    SlidersHorizontal,
    Wifi,
    XCircle,
} from "lucide-react";

type Severity = "healthy" | "warning" | "critical";
type IssueStatus = "open" | "triaging" | "in_progress" | "waiting_on_client" | "resolved" | "closed";
type IssuePriority = "low" | "medium" | "high" | "urgent";
type IssueCategory = "bug" | "training" | "feature_request" | "billing" | "device_sync" | "data_issue" | "other";
type IssueScope = "core_hrms" | "tenant_customization" | "paid_addon" | "not_aligned" | "unknown";

interface UsageMetric {
    current: number;
    limit: number;
    percentage: number;
    status: Severity;
}

interface TenantHealth {
    tenant: { id: string; name: string; slug: string; status: string; timezone: string; updatedAt: string };
    overallStatus: Severity;
    subscription: {
        status: string;
        planName: string;
        planSlug: string;
        currentPeriodEnd: string | null;
        trialEnd: string | null;
        health: Severity;
    };
    usage: null | {
        employees: UsageMetric;
        admins: UsageMetric;
        branches: UsageMetric;
        devices: UsageMetric;
    };
    sync: {
        status: Severity;
        lastAgentSeenAt: string | null;
        lastDeviceSeenAt: string | null;
        lastSyncAt: string | null;
        activeAgents: number;
        totalAgents: number;
        activeDevices: number;
        onlineDevices: number;
        totalDevices: number;
        failedSyncCount: number;
        partialSyncCount: number;
        failedCloudEventCount: number;
        unmappedUserIds: string[];
        latestAgent: null | { name: string; keyPrefix: string; lastHeartbeat: string | null; lastSyncAt: string | null; agentVersion: string | null; agentIp: string | null; syncCount: number; totalRecords: number };
        devices: Array<{ id: string; name: string; serialNumber: string | null; ip: string; connectionMode: string; cloudStatus: string; isActive: boolean; isOnline: boolean; consecutiveFailures: number; lastSyncAt: string | null; lastSyncStatus: string | null; lastSeenAt: string | null; lastPingAt: string | null }>;
        recentErrors: Array<{ id: string; type: string; status: string; message: string; createdAt: string; deviceName: string }>;
    };
    support: {
        openIssueCount: number;
        urgentIssueCount: number;
        issuesByStatus: Record<string, number>;
        highlightedIssues: Array<{ id: string; title: string; category: string; priority: string; status: string; scope: string; nextAction: string | null; createdAt: string; organizationId: string }>;
    };
}

interface SupportIssue {
    id: string;
    title: string;
    description: string | null;
    category: IssueCategory;
    priority: IssuePriority;
    status: IssueStatus;
    scope: IssueScope;
    source: string;
    impact: string | null;
    nextAction: string | null;
    resolution: string | null;
    dueAt: string | null;
    resolvedAt: string | null;
    createdAt: string;
    updatedAt: string;
    organization: { id: string; name: string; slug: string; status: string };
    assignedTo: null | { id: string; name: string; email: string };
    reportedBy: null | { id: string; name: string; email: string };
}

const STATUS_CONFIG: Record<Severity, { labelKey: string; className: string; icon: typeof CheckCircle2 }> = {
    healthy: { labelKey: "healthy", className: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
    warning: { labelKey: "needsAttention", className: "text-amber-300 bg-amber-500/10 border-amber-500/20", icon: AlertTriangle },
    critical: { labelKey: "critical", className: "text-red-300 bg-red-500/10 border-red-500/20", icon: XCircle },
};

const PRIORITY_CLASS: Record<string, string> = {
    urgent: "text-red-300 bg-red-500/10 border-red-500/20",
    high: "text-orange-300 bg-orange-500/10 border-orange-500/20",
    medium: "text-amber-300 bg-amber-500/10 border-amber-500/20",
    low: "text-foreground bg-zinc-500/10 border-zinc-500/20",
};

const STATUS_OPTIONS: IssueStatus[] = ["open", "triaging", "in_progress", "waiting_on_client", "resolved", "closed"];
const CATEGORY_OPTIONS: IssueCategory[] = ["bug", "training", "feature_request", "billing", "device_sync", "data_issue", "other"];
const PRIORITY_OPTIONS: IssuePriority[] = ["low", "medium", "high", "urgent"];
const SCOPE_OPTIONS: IssueScope[] = ["core_hrms", "tenant_customization", "paid_addon", "not_aligned", "unknown"];

const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
const formatDate = (value: string | null | undefined) => (value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never");
const formatLimit = (limit: number) => (limit === -1 ? "∞" : limit.toLocaleString());

function StatusBadge({ status }: { status: Severity }) {
    const t = useTranslations("Platform");
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}><Icon className="h-3.5 w-3.5" />{t(config.labelKey)}</span>;
}

function MetricCard({ title, value, sub, icon: Icon, tone = "indigo" }: { title: string; value: string | number; sub: string; icon: typeof Activity; tone?: "indigo" | "emerald" | "amber" | "red" }) {
    const tones = {
        indigo: "from-indigo-500/15 to-violet-500/10 text-indigo-300 border-indigo-500/15",
        emerald: "from-emerald-500/15 to-teal-500/10 text-emerald-300 border-emerald-500/15",
        amber: "from-amber-500/15 to-orange-500/10 text-amber-300 border-amber-500/15",
        red: "from-red-500/15 to-rose-500/10 text-red-300 border-red-500/15",
    };
    return (
        <div className="rounded-2xl border border-border bg-hover p-5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
                    <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
                </div>
                <div className={`rounded-xl border bg-linear-to-br p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
            </div>
        </div>
    );
}

function UsageBar({ label, metric }: { label: string; metric: UsageMetric }) {
    const pct = metric.limit === -1 ? 0 : Math.min(metric.percentage, 100);
    const color = metric.status === "critical" ? "bg-red-400" : metric.status === "warning" ? "bg-amber-400" : "bg-emerald-400";
    return (
        <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-foreground">{label}</span>
                <span className="text-muted-foreground">{metric.current.toLocaleString()} / {formatLimit(metric.limit)}</span>
            </div>
            <div className="h-2 rounded-full bg-hover overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: metric.limit === -1 ? "12%" : `${pct}%` }} />
            </div>
        </div>
    );
}

export default function PlatformSupportPage() {
    const t = useTranslations("Platform");
    const [health, setHealth] = useState<TenantHealth[]>([]);
    const [summary, setSummary] = useState({ totalTenants: 0, healthy: 0, warning: 0, critical: 0, openIssues: 0, urgentIssues: 0 });
    const [issues, setIssues] = useState<SupportIssue[]>([]);
    const [selectedTenantId, setSelectedTenantId] = useState<string>("all");
    const [issueStatus, setIssueStatus] = useState<string>("all");
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [form, setForm] = useState({
        organizationId: "",
        title: "",
        description: "",
        category: "bug" as IssueCategory,
        priority: "medium" as IssuePriority,
        scope: "core_hrms" as IssueScope,
        source: "platform",
        impact: "",
        nextAction: "",
    });

    const loadHealth = useCallback(async () => {
        const res = await fetch("/api/platform/support/health", { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load tenant health");
        const payload = await res.json();
        setHealth(payload.tenants || []);
        setSummary(payload.summary || { totalTenants: 0, healthy: 0, warning: 0, critical: 0, openIssues: 0, urgentIssues: 0 });
    }, []);

    const loadIssues = useCallback(async () => {
        const params = new URLSearchParams();
        if (selectedTenantId !== "all") params.set("tenantId", selectedTenantId);
        if (issueStatus !== "all") params.set("status", issueStatus);
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/platform/support/issues?${params}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load support issues");
        const payload = await res.json();
        setIssues(payload.issues || []);
    }, [selectedTenantId, issueStatus, query]);

    const loadAll = useCallback(async () => {
        setLoading(true);
        setMessage(null);
        try {
            await Promise.all([loadHealth(), loadIssues()]);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to load support center.");
        } finally {
            setLoading(false);
        }
    }, [loadHealth, loadIssues]);

    useEffect(() => { void loadAll(); }, [loadAll]);

    const allTenants = useMemo(() => health.map((item) => item.tenant), [health]);
    const visibleHealth = useMemo(
        () => selectedTenantId === "all" ? health : health.filter((item) => item.tenant.id === selectedTenantId),
        [health, selectedTenantId],
    );
    const selectedTenant = selectedTenantId === "all" ? null : health.find((item) => item.tenant.id === selectedTenantId);

    useEffect(() => {
        if (!form.organizationId && health[0]?.tenant.id) {
            setForm((prev) => ({ ...prev, organizationId: health[0].tenant.id }));
        }
    }, [form.organizationId, health]);

    async function createIssue(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/platform/support/issues", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || "Failed to create issue");
            setForm((prev) => ({ ...prev, title: "", description: "", impact: "", nextAction: "" }));
            setMessage("Support issue logged.");
            await Promise.all([loadHealth(), loadIssues()]);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to create issue.");
        } finally {
            setSaving(false);
        }
    }

    async function updateIssueStatus(issue: SupportIssue, status: IssueStatus) {
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch("/api/platform/support/issues", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: issue.id, status }),
            });
            const payload = await res.json();
            if (!res.ok) throw new Error(payload.error || "Failed to update issue");
            await Promise.all([loadHealth(), loadIssues()]);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Failed to update issue.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t("loadingSupportCommandCenter")}</div>;
    }

    return (
        <div className="space-y-8 p-6 lg:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                        <LifeBuoy className="h-3.5 w-3.5" /> {t("tenantSupportCommandCenter")}
                    </div>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">{t("tenantHealthSupportLog")}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("supportPageSubtitle")}</p>
                </div>
                <button onClick={() => void loadAll()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-hover px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-hover">
                    <RefreshCw className="h-4 w-4" /> {t("refresh")}
                </button>
            </div>

            {message && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard title={t("tenants")} value={summary.totalTenants} sub={t("visibleInSupportView")} icon={Gauge} />
                <MetricCard title={t("healthy")} value={summary.healthy} sub={t("noUrgentSignals")} icon={CheckCircle2} tone="emerald" />
                <MetricCard title={t("warning")} value={summary.warning} sub={t("needsAttentionStatus")} icon={AlertTriangle} tone="amber" />
                <MetricCard title={t("critical")} value={summary.critical} sub={t("supportIntervention")} icon={ShieldAlert} tone="red" />
                <MetricCard title={t("openIssues")} value={summary.openIssues} sub={t("highUrgent", { count: summary.urgentIssues })} icon={LifeBuoy} tone={summary.urgentIssues ? "red" : "indigo"} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-2xl border border-border bg-hover">
                    <div className="flex flex-col gap-3 border-b border-border p-5 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">{t("tenantHealth")}</h2>
                            <p className="text-sm text-muted-foreground">{t("tenantHealthDesc")}</p>
                        </div>
                        <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} className="rounded-xl border border-border bg-hover px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400">
                            <option value="all">{t("allTenants")}</option>
                            {allTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                        </select>
                    </div>
                    <div className="divide-y divide-white/8">
                        {visibleHealth.map((item) => (
                            <div key={item.tenant.id} className="p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-lg font-semibold text-foreground">{item.tenant.name}</h3>
                                            <StatusBadge status={item.overallStatus} />
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">{item.subscription.planName} • {t("subscriptionWord")} {item.subscription.status} • {t("tenantWord")} {item.tenant.status}</p>
                                    </div>
                                    <div className="text-sm text-muted-foreground">{t("renewsEnds")} <span className="text-foreground">{formatDate(item.subscription.currentPeriodEnd || item.subscription.trialEnd)}</span></div>
                                </div>

                                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-3 rounded-xl border border-border bg-black/20 p-4">
                                        <div className="flex items-center gap-2 text-sm font-medium text-foreground"><SlidersHorizontal className="h-4 w-4 text-indigo-300" /> {t("packageUsage")}</div>
                                        {item.usage ? (
                                            <>
                                                <UsageBar label={t("employees")} metric={item.usage.employees} />
                                                <UsageBar label={t("adminsUsers")} metric={item.usage.admins} />
                                                <UsageBar label={t("branches")} metric={item.usage.branches} />
                                                <UsageBar label={t("devices")} metric={item.usage.devices} />
                                            </>
                                        ) : <p className="text-sm text-red-300">{t("noPackageConfigured")}</p>}
                                    </div>
                                    <div className="rounded-xl border border-border bg-black/20 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Wifi className="h-4 w-4 text-emerald-300" /> {t("syncTelemetry")}</div>
                                            <StatusBadge status={item.sync.status} />
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                            <div><p className="text-muted-foreground">{t("agents")}</p><p className="text-foreground">{item.sync.activeAgents}/{item.sync.totalAgents} {t("activeWord")}</p></div>
                                            <div><p className="text-muted-foreground">{t("devices")}</p><p className="text-foreground">{item.sync.onlineDevices}/{item.sync.totalDevices} {t("online")}</p></div>
                                            <div><p className="text-muted-foreground">{t("lastAgent")}</p><p className="text-foreground">{formatDate(item.sync.lastAgentSeenAt)}</p></div>
                                            <div><p className="text-muted-foreground">{t("lastSync")}</p><p className="text-foreground">{formatDate(item.sync.lastSyncAt)}</p></div>
                                        </div>
                                        {(item.sync.failedSyncCount > 0 || item.sync.unmappedUserIds.length > 0) && (
                                            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                                                {t("failedSyncLogs", { count: item.sync.failedSyncCount })} • {t("unmappedBiometricIds", { count: item.sync.unmappedUserIds.length })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {(item.sync.recentErrors.length > 0 || item.support.highlightedIssues.length > 0) && (
                                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                        <div className="rounded-xl border border-border bg-black/20 p-4">
                                            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><Router className="h-4 w-4 text-amber-300" /> {t("recentSyncErrors")}</h4>
                                            {item.sync.recentErrors.length ? item.sync.recentErrors.map((error) => (
                                                <div key={`${error.type}-${error.id}`} className="mb-3 last:mb-0">
                                                    <p className="text-sm text-foreground">{error.deviceName}</p>
                                                    <p className="text-xs text-muted-foreground">{error.message} • {formatDate(error.createdAt)}</p>
                                                </div>
                                            )) : <p className="text-sm text-muted-foreground">{t("noRecentDeviceErrors")}</p>}
                                        </div>
                                        <div className="rounded-xl border border-border bg-black/20 p-4">
                                            <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground"><LifeBuoy className="h-4 w-4 text-indigo-300" /> {t("highlightedSupportIssues")}</h4>
                                            {item.support.highlightedIssues.length ? item.support.highlightedIssues.map((issue) => (
                                                <div key={issue.id} className="mb-3 last:mb-0">
                                                    <p className="text-sm text-foreground">{issue.title}</p>
                                                    <p className="text-xs text-muted-foreground">{pretty(issue.priority)} • {pretty(issue.category)} • {issue.nextAction || t("noNextActionSet")}</p>
                                                </div>
                                            )) : <p className="text-sm text-muted-foreground">{t("noHighlightedSupportIssues")}</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-2xl border border-border bg-hover p-5">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Plus className="h-5 w-5 text-indigo-300" /> {t("logSupportIssue")}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t("logSupportIssueDesc")}</p>
                    <form onSubmit={createIssue} className="mt-5 space-y-4">
                        <select required value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} className="w-full rounded-xl border border-border bg-hover px-3 py-2.5 text-sm text-foreground outline-none focus:border-indigo-400">
                            <option value="">{t("selectTenant")}</option>
                            {allTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                        </select>
                        <input required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("issueTitle")} className="w-full rounded-xl border border-border bg-hover px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-indigo-400" />
                        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("issueDescriptionPlaceholder")} rows={4} className="w-full rounded-xl border border-border bg-hover px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-indigo-400" />
                        <div className="grid grid-cols-2 gap-3">
                            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as IssueCategory })} className="rounded-xl border border-border bg-hover px-3 py-2.5 text-sm text-foreground outline-none focus:border-indigo-400">{CATEGORY_OPTIONS.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select>
                            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as IssuePriority })} className="rounded-xl border border-border bg-hover px-3 py-2.5 text-sm text-foreground outline-none focus:border-indigo-400">{PRIORITY_OPTIONS.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select>
                            <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as IssueScope })} className="col-span-2 rounded-xl border border-border bg-hover px-3 py-2.5 text-sm text-foreground outline-none focus:border-indigo-400">{SCOPE_OPTIONS.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}</select>
                        </div>
                        <input value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} placeholder={t("businessImpact")} className="w-full rounded-xl border border-border bg-hover px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-indigo-400" />
                        <input value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder={t("nextAction")} className="w-full rounded-xl border border-border bg-hover px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-indigo-400" />
                        <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t("saveIssue")}
                        </button>
                    </form>
                </section>
            </div>

            <section className="rounded-2xl border border-border bg-hover">
                <div className="flex flex-col gap-3 border-b border-border p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">{t("supportLog")}</h2>
                        <p className="text-sm text-muted-foreground">{t("supportLogDesc")}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchIssues")} className="w-full rounded-xl border border-border bg-hover py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-indigo-400 sm:w-56" />
                        </div>
                        <select value={issueStatus} onChange={(e) => setIssueStatus(e.target.value)} className="rounded-xl border border-border bg-hover px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-400">
                            <option value="all">{t("allStatuses")}</option>
                            {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
                        </select>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            <tr>
                                <th className="px-5 py-3">{t("issueColumn")}</th>
                                <th className="px-5 py-3">{t("tenantColumn")}</th>
                                <th className="px-5 py-3">{t("typeColumn")}</th>
                                <th className="px-5 py-3">{t("scopeColumn")}</th>
                                <th className="px-5 py-3">{t("priorityColumn")}</th>
                                <th className="px-5 py-3">{t("statusColumn")}</th>
                                <th className="px-5 py-3">{t("nextActionColumn")}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/8">
                            {issues.map((issue) => (
                                <tr key={issue.id} className="hover:bg-hover/50">
                                    <td className="px-5 py-4">
                                        <p className="font-medium text-foreground">{issue.title}</p>
                                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" /> {formatDate(issue.createdAt)}</p>
                                    </td>
                                    <td className="px-5 py-4 text-foreground">{issue.organization.name}</td>
                                    <td className="px-5 py-4 text-muted-foreground">{pretty(issue.category)}</td>
                                    <td className="px-5 py-4 text-muted-foreground">{pretty(issue.scope)}</td>
                                    <td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs ${PRIORITY_CLASS[issue.priority] || PRIORITY_CLASS.medium}`}>{pretty(issue.priority)}</span></td>
                                    <td className="px-5 py-4">
                                        <select value={issue.status} disabled={saving} onChange={(e) => void updateIssueStatus(issue, e.target.value as IssueStatus)} className="rounded-lg border border-border bg-hover px-2 py-1.5 text-xs text-foreground outline-none focus:border-indigo-400">
                                            {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{pretty(item)}</option>)}
                                        </select>
                                    </td>
                                    <td className="max-w-xs px-5 py-4 text-muted-foreground">{issue.nextAction || "—"}</td>
                                </tr>
                            ))}
                            {!issues.length && (
                                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">{t("noSupportIssuesFound")}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {selectedTenant && (
                <div className="rounded-2xl border border-indigo-500/15 bg-indigo-500/8 p-5 text-sm text-indigo-100">
                    {t("focusMode", { name: selectedTenant.tenant.name })}
                </div>
            )}
        </div>
    );
}
