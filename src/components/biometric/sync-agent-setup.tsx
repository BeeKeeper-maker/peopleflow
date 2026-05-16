"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";
import type { TranslationValues } from "next-intl";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Key,
    Plus,
    Copy,
    Check,
    Trash2,
    Loader2,
    Wifi,
    WifiOff,
    Clock,
    Shield,
    Terminal,
    Download,
    ArrowRight,
    Activity,
    Globe,
    Server,
    Zap,
    Eye,
    EyeOff,
    AlertTriangle,
    CheckCircle2,
    Users,
    PlayCircle,
    MonitorCheck,
    Router,
    HelpCircle,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface SyncApiKeyInfo {
    id: string;
    keyPrefix: string;
    name: string;
    isActive: boolean;
    lastHeartbeat: string | null;
    lastSyncAt: string | null;
    agentVersion: string | null;
    agentIp: string | null;
    syncCount: number;
    totalRecords: number;
    createdAt: string;
}

interface SyncAgentSetupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cloudUrl: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null, t?: (key: string, values?: TranslationValues) => string): string {
    if (!dateStr) return t ? t("timeNever") : "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t ? t("timeJustNow") : "Just now";
    if (mins < 60) return t ? t("timeMinutesAgo", { count: mins }) : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t ? t("timeHoursAgo", { count: hours }) : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return t ? t("timeDaysAgo", { count: days }) : `${days}d ago`;
}

function isOnline(lastHeartbeat: string | null): boolean {
    if (!lastHeartbeat) return false;
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    return diff < 10 * 60 * 1000;
}

// ── Component ────────────────────────────────────────────────────────

export function SyncAgentSetup({ open, onOpenChange, cloudUrl }: SyncAgentSetupProps) {
    const { addToast } = useToast();
    const t = useTranslations("Devices");

    const [keys, setKeys] = useState<SyncApiKeyInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState("Main Office Agent");
    const [newRawKey, setNewRawKey] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [activeStep, setActiveStep] = useState(0);
    const [platform, setPlatform] = useState<"windows" | "mac">("windows");

    // ── Fetch Keys ────────────────────────────────────────────────

    const fetchKeys = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/sync-agent/keys");
            const data = await res.json();
            if (data.success) {
                setKeys(data.keys || []);
            }
        } catch {
            console.error("Failed to fetch sync keys");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) {
            fetchKeys();
            setNewRawKey(null);
            setActiveStep(0);
            setCopied(null);
        }
    }, [open, fetchKeys]);

    // ── Create Key ────────────────────────────────────────────────

    const createKey = async () => {
        setCreating(true);
        try {
            const res = await fetch("/api/sync-agent/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newKeyName }),
            });
            const data = await res.json();
            if (data.success) {
                setNewRawKey(data.apiKey.rawKey);
                setShowKey(true);
                setActiveStep(1);
                await fetchKeys();
                addToast({ title: t("agentKeyGenerated"), type: "success" });
            } else {
                addToast({ title: data.error || t("agentKeyCreateFailed"), type: "error" });
            }
        } catch {
            addToast({ title: t("agentKeyCreateFailed"), type: "error" });
        } finally {
            setCreating(false);
        }
    };

    // ── Revoke Key ────────────────────────────────────────────────

    const revokeKey = async (id: string) => {
        try {
            const res = await fetch(`/api/sync-agent/keys/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                addToast({ title: t("agentKeyRevoked"), type: "success" });
                await fetchKeys();
            }
        } catch {
            addToast({ title: t("agentKeyRevokeFailed"), type: "error" });
        }
    };

    // ── Copy Helpers ──────────────────────────────────────────────

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    const downloadUrl = newRawKey
        ? `/api/sync-agent/download?key=${encodeURIComponent(newRawKey)}&v=1.1.1`
        : `/api/sync-agent/download?v=1.1.1`;

    const dryRunCommand = platform === "windows"
        ? "cd %USERPROFILE%\\Downloads && node peopleflow-sync.js --dry-run=true --once=true"
        : "cd ~/Downloads && node peopleflow-sync.js --dry-run=true --once=true";
    const liveCommand = platform === "windows"
        ? "cd %USERPROFILE%\\Downloads && node peopleflow-sync.js"
        : "cd ~/Downloads && node peopleflow-sync.js";

    const visibleSetupSteps = [
        { title: t("agentStep1Title"), desc: t("agentStep1Desc"), icon: Key },
        { title: t("agentStep2Title"), desc: t("agentStep2Desc"), icon: Download },
        { title: t("agentStep3Title"), desc: t("agentStep3Desc"), icon: MonitorCheck },
        { title: t("agentStep4Title"), desc: t("agentStep4Desc"), icon: Users },
    ];

    const visibleSuccessChecks = [t("agentSuccessCloud"), t("agentSuccessDevice"), t("agentSuccessInfo"), t("agentSuccessDryRun")];

    const visibleCommonProblems = [
        { problem: "MODULE_NOT_FOUND", fix: t("agentProblemModuleNotFound") },
        { problem: "ECONNRESET on v1.0.0", fix: t("agentProblemOldVersion") },
        { problem: "Timeout / EHOSTUNREACH", fix: t("agentProblemTimeout") },
        { problem: t("agentProblemCloudTestTitle"), fix: t("agentProblemCloudTestFix") },
    ];

    // ── Render ─────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-hidden bg-card border-card-border flex flex-col p-0">
                <DialogHeader className="border-b border-card-border px-6 py-5 bg-linear-to-r from-emerald-500/10 via-cyan-500/5 to-transparent">
                    <DialogTitle className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-linear-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                            <Zap className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">{t("agentSetupTitle")}</h2>
                            <p className="text-sm text-muted-foreground font-normal">
                                {t("agentSetupSubtitle")}
                            </p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
                    {/* Top explanation */}
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                            <div className="flex items-start gap-4">
                                <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                                    <Router className="h-6 w-6 text-emerald-400" />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <h3 className="text-base font-semibold text-foreground">{t("recommendedForEveryOffice")}</h3>
                                        <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20">{t("productionFlow")}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {t.rich("agentOfficeLanDesc", { ip: (chunks) => <span className="font-mono text-foreground">{chunks}</span> })}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-card-border bg-hover p-5">
                            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-cyan-400" />
                                {t("officeStaffNeed")}
                            </p>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" /> {t("needOfficePc")}</li>
                                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" /> {t("needNode")}</li>
                                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" /> {t("needDeviceIpPort")}</li>
                                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400 shrink-0" /> {t("needAgentFile")}</li>
                            </ul>
                        </div>
                    </div>

                    {/* Active Agents Status */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">{t("officeSyncAgents")}</h3>
                                <p className="text-xs text-muted-foreground">{t("agentOnlineDesc")}</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={fetchKeys} disabled={loading} className="gap-2">
                                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
                                {t("refreshAgents")}
                            </Button>
                        </div>

                        {keys.length > 0 ? (
                            <div className="grid gap-3 md:grid-cols-2">
                                {keys.map((key) => {
                                    const online = isOnline(key.lastHeartbeat);
                                    return (
                                        <div
                                            key={key.id}
                                            className={cn(
                                                "rounded-2xl border p-4 transition-all duration-200",
                                                online
                                                    ? "bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5"
                                                    : "bg-hover border-card-border"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", online ? "bg-emerald-500/15" : "bg-muted-foreground/10")}>
                                                        {online ? <Wifi className="h-5 w-5 text-emerald-400" /> : <WifiOff className="h-5 w-5 text-muted-foreground" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-foreground truncate">{key.name}</p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            <Badge className={cn("text-[10px] gap-1", online ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20")}>
                                                                <span className={cn("w-1.5 h-1.5 rounded-full", online ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground")} />
                                                                {online ? t("online") : t("offline")}
                                                            </Badge>
                                                            <span className="text-[10px] text-muted-foreground font-mono">{key.keyPrefix}...</span>
                                                            {key.agentVersion && (
                                                                <Badge className="text-[10px] bg-cyan-500/10 text-cyan-300 border-cyan-500/20">v{key.agentVersion}</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (confirm(t("confirmRevokeAgentKey"))) revokeKey(key.id);
                                                    }}
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>

                                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                                <div className="rounded-xl bg-background/50 border border-card-border p-2">
                                                    <p className="text-sm font-bold text-foreground">{key.syncCount}</p>
                                                    <p className="text-[10px] text-muted-foreground">{t("syncRuns")}</p>
                                                </div>
                                                <div className="rounded-xl bg-background/50 border border-card-border p-2">
                                                    <p className="text-sm font-bold text-foreground">{key.totalRecords}</p>
                                                    <p className="text-[10px] text-muted-foreground">{t("records")}</p>
                                                </div>
                                                <div className="rounded-xl bg-background/50 border border-card-border p-2">
                                                    <p className="text-sm font-bold text-foreground">{timeAgo(key.lastHeartbeat)}</p>
                                                    <p className="text-[10px] text-muted-foreground">{t("heartbeat")}</p>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                                                {key.agentIp && <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {key.agentIp}</span>}
                                                {key.lastSyncAt && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t("lastSync")}: {timeAgo(key.lastSyncAt, t)}</span>}
                                                <span className="flex items-center gap-1"><Server className="h-3 w-3" /> {cloudUrl}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-card-border bg-hover p-6 text-center">
                                <Plus className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                                <p className="text-sm font-medium text-foreground">{t("noOfficeAgentConfigured")}</p>
                                <p className="text-xs text-muted-foreground mt-1">{t("noOfficeAgentDesc")}</p>
                            </div>
                        )}
                    </div>

                    {/* Guided setup */}
                    <div className="rounded-2xl border border-card-border overflow-hidden">
                        <div className="px-5 py-4 bg-linear-to-r from-emerald-500/10 via-cyan-500/5 to-transparent border-b border-card-border">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                                        <Terminal className="h-4 w-4 text-emerald-400" />
                                        {t("selfServiceWizard")}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">{t("wizardSafetyDesc")}</p>
                                </div>
                                <Badge className="w-fit bg-blue-500/10 text-blue-300 border-blue-500/20">{t("agentVersionBadge")}</Badge>
                            </div>
                        </div>

                        <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                            <div className="border-b lg:border-b-0 lg:border-r border-card-border bg-hover/50 p-4 space-y-3">
                                {visibleSetupSteps.map((step, index) => {
                                    const Icon = step.icon;
                                    const isActive = activeStep === index;
                                    const isDone = activeStep > index || (index === 0 && !!newRawKey);
                                    return (
                                        <button
                                            key={step.title}
                                            type="button"
                                            onClick={() => setActiveStep(index)}
                                            className={cn(
                                                "w-full text-left rounded-xl border p-3 transition-all",
                                                isActive ? "border-emerald-500/30 bg-emerald-500/10" : "border-card-border bg-card/60 hover:bg-card",
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", isDone ? "bg-emerald-500/15 text-emerald-400" : isActive ? "bg-cyan-500/15 text-cyan-400" : "bg-muted-foreground/10 text-muted-foreground")}>
                                                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{index + 1}. {step.title}</p>
                                                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="p-5 space-y-5">
                                {activeStep === 0 && (
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-lg font-semibold text-foreground">{t("createSecureOfficeKey")}</h4>
                                            <p className="text-sm text-muted-foreground mt-1">{t("createSecureOfficeKeyDesc")}</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                value={newKeyName}
                                                onChange={(e) => setNewKeyName(e.target.value)}
                                                placeholder={t("mainOfficeAgentPlaceholder")}
                                                className="h-11 px-3 rounded-xl bg-hover border border-card-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 flex-1"
                                            />
                                            <Button onClick={createKey} disabled={creating || !newKeyName.trim()} className="gap-2 bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white">
                                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
                                                {t("generateOfficeKey")}
                                            </Button>
                                        </div>

                                        {newRawKey && (
                                            <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                                                <div className="flex items-start gap-2 text-amber-200">
                                                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                                    <p className="text-sm">{t("keyShownOnce")}</p>
                                                </div>
                                                <div className="relative">
                                                    <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-[#0d1117] border border-card-border font-mono text-xs text-emerald-300 overflow-x-auto pr-20">
                                                        <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
                                                        {showKey ? <span className="select-all break-all">{newRawKey}</span> : <span>{"•".repeat(44)}</span>}
                                                    </div>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                        <button type="button" onClick={() => setShowKey(!showKey)} className="p-1.5 hover:bg-white/10 rounded">
                                                            {showKey ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                                                        </button>
                                                        <button type="button" onClick={() => copyToClipboard(newRawKey, "key")} className="p-1.5 hover:bg-white/10 rounded">
                                                            {copied === "key" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeStep === 1 && (
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-lg font-semibold text-foreground">{t("downloadFreshAgent")}</h4>
                                            <p className="text-sm text-muted-foreground mt-1">{t("downloadFreshAgentDesc")}</p>
                                        </div>
                                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-foreground">{t("preconfiguredFile")}</p>
                                                <p className="text-xs text-muted-foreground mt-1">Cloud URL: <span className="font-mono text-foreground">{cloudUrl}</span></p>
                                                <p className="text-xs text-muted-foreground">{t("deviceIpAsked")}</p>
                                            </div>
                                            <a
                                                href={downloadUrl}
                                                download="peopleflow-sync.js"
                                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white text-sm font-medium shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:scale-[1.02]"
                                            >
                                                <Download className="h-4 w-4" />
                                                {t("downloadAgentVersion")}
                                            </a>
                                        </div>
                                        <div className="rounded-xl border border-card-border bg-hover p-3 text-xs text-muted-foreground flex gap-2">
                                            <HelpCircle className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                                            {t("nodeHelpBefore")} <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">nodejs.org</a>{t("nodeHelpAfter")}
                                        </div>
                                    </div>
                                )}

                                {activeStep === 2 && (
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-lg font-semibold text-foreground">{t("runDryRunFirst")}</h4>
                                            <p className="text-sm text-muted-foreground mt-1">{t("dryRunDesc")}</p>
                                        </div>

                                        <div className="flex rounded-xl border border-card-border bg-hover p-1 w-fit">
                                            <button type="button" onClick={() => setPlatform("windows")} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", platform === "windows" ? "bg-card text-foreground shadow" : "text-muted-foreground")}>{t("windowsPc")}</button>
                                            <button type="button" onClick={() => setPlatform("mac")} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", platform === "mac" ? "bg-card text-foreground shadow" : "text-muted-foreground")}>{t("macLinux")}</button>
                                        </div>

                                        <CommandBox label={t("copyDryRunCommand")} command={dryRunCommand} copied={copied === "dry-run"} onCopy={() => copyToClipboard(dryRunCommand, "dry-run")} />

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                                                <p className="text-sm font-semibold text-emerald-300 mb-3">{t("successShouldShow")}</p>
                                                <ul className="space-y-2">
                                                    {visibleSuccessChecks.map((item) => (
                                                        <li key={item} className="flex gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" /> {item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                                <p className="text-sm font-semibold text-amber-300 mb-2">{t("importantSafetyRule")}</p>
                                                <p className="text-xs text-muted-foreground leading-relaxed">{t("doNotUse")} <span className="font-mono text-foreground">--sync-all-history=true</span> {t("syncAllHistoryWarning")}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeStep === 3 && (
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-lg font-semibold text-foreground">{t("goLiveAfterMapping")}</h4>
                                            <p className="text-sm text-muted-foreground mt-1">{t("goLiveAfterMappingDesc")}</p>
                                        </div>
                                        <CommandBox label={t("liveSyncCommand")} command={liveCommand} copied={copied === "live"} onCopy={() => copyToClipboard(liveCommand, "live")} />
                                        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                                            <p className="text-sm font-semibold text-blue-300 mb-2 flex items-center gap-2"><PlayCircle className="h-4 w-4" /> {t("operationalRecommendation")}</p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">{t("operationalRecommendationDesc")}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center justify-between border-t border-card-border pt-4">
                                    <Button variant="outline" size="sm" onClick={() => setActiveStep((s) => Math.max(s - 1, 0))} disabled={activeStep === 0}>{t("back")}</Button>
                                    <Button size="sm" onClick={() => setActiveStep((s) => Math.min(s + 1, visibleSetupSteps.length - 1))} className="gap-2">
                                        {activeStep === visibleSetupSteps.length - 1 ? t("done") : t("next")}
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Troubleshooting */}
                    <div className="rounded-2xl border border-card-border bg-hover p-5">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            {t("commonMessagesTitle")}
                        </h3>
                        <div className="grid gap-3 md:grid-cols-3">
                            {visibleCommonProblems.map((item) => (
                                <div key={item.problem} className="rounded-xl border border-card-border bg-card/70 p-3">
                                    <p className="text-xs font-mono text-amber-300 mb-2">{item.problem}</p>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{item.fix}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function CommandBox({
    label,
    command,
    copied,
    onCopy,
}: {
    label: string;
    command: string;
    copied: boolean;
    onCopy: () => void;
}) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <div className="relative">
                <pre className="px-4 py-3 pr-12 rounded-xl bg-[#0d1117] border border-card-border text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {command}
                </pre>
                <button type="button" onClick={onCopy} className="absolute right-2 top-2 p-1.5 hover:bg-white/10 rounded">
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
            </div>
        </div>
    );
}
