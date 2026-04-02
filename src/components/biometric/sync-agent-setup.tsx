"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";
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

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function isOnline(lastHeartbeat: string | null): boolean {
    if (!lastHeartbeat) return false;
    const diff = Date.now() - new Date(lastHeartbeat).getTime();
    return diff < 10 * 60 * 1000; // Online if heartbeat within 10 minutes
}

// ── Component ────────────────────────────────────────────────────────

export function SyncAgentSetup({ open, onOpenChange, cloudUrl }: SyncAgentSetupProps) {
    const t = useTranslations("Devices");
    const { addToast } = useToast();

    const [keys, setKeys] = useState<SyncApiKeyInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState("Main Office Agent");
    const [newRawKey, setNewRawKey] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedCmd, setCopiedCmd] = useState(false);
    const [activeStep, setActiveStep] = useState(0);

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
                addToast({ title: "API Key Generated! 🔑", type: "success" });
            }
        } catch {
            addToast({ title: "Failed to create API key", type: "error" });
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
                addToast({ title: "API Key Revoked", type: "success" });
                await fetchKeys();
            }
        } catch {
            addToast({ title: "Failed to revoke key", type: "error" });
        }
    };

    // ── Copy Helpers ──────────────────────────────────────────────

    const copyToClipboard = (text: string, type: "key" | "cmd") => {
        navigator.clipboard.writeText(text);
        if (type === "key") {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } else {
            setCopiedCmd(true);
            setTimeout(() => setCopiedCmd(false), 2000);
        }
    };

    // Download URL for the pre-configured agent
    const downloadUrl = newRawKey
        ? `/api/sync-agent/download?key=${encodeURIComponent(newRawKey)}`
        : `/api/sync-agent/download`;
    const runCommand = `node peopleflow-sync.js`;

    // ── Render ─────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden bg-card border-card-border flex flex-col">
                <DialogHeader className="border-b border-card-border pb-4">
                    <DialogTitle className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/20">
                            <Zap className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">
                                {t("syncAgentTitle")}
                            </h2>
                            <p className="text-xs text-muted-foreground font-normal">
                                {t("syncAgentDesc")}
                            </p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0 py-4 space-y-5">

                    {/* ═══ Active Agents Status ═══════════════════════ */}
                    {keys.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                                Active Agents
                            </h3>
                            {keys.map((key) => {
                                const online = isOnline(key.lastHeartbeat);
                                return (
                                    <div
                                        key={key.id}
                                        className={cn(
                                            "rounded-xl border p-3 transition-all duration-200",
                                            online
                                                ? "bg-emerald-500/5 border-emerald-500/15"
                                                : "bg-card border-card-border"
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={cn(
                                                        "w-9 h-9 rounded-lg flex items-center justify-center",
                                                        online
                                                            ? "bg-emerald-500/15"
                                                            : "bg-muted-foreground/10"
                                                    )}
                                                >
                                                    {online ? (
                                                        <Wifi className="h-4 w-4 text-emerald-400" />
                                                    ) : (
                                                        <WifiOff className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">
                                                        {key.name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <Badge
                                                            className={cn(
                                                                "text-[10px] gap-1",
                                                                online
                                                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                                                    : "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20"
                                                            )}
                                                        >
                                                            <div
                                                                className={cn(
                                                                    "w-1.5 h-1.5 rounded-full",
                                                                    online ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"
                                                                )}
                                                            />
                                                            {online ? "Online" : "Offline"}
                                                        </Badge>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {key.keyPrefix}...
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {/* Stats */}
                                                <div className="hidden sm:flex items-center gap-4 text-center">
                                                    <div>
                                                        <p className="text-xs font-bold text-foreground">{key.syncCount}</p>
                                                        <p className="text-[9px] text-muted-foreground">Syncs</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-foreground">{key.totalRecords}</p>
                                                        <p className="text-[9px] text-muted-foreground">Records</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            <Clock className="inline h-3 w-3 mr-0.5" />
                                                            {timeAgo(key.lastHeartbeat)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        if (confirm("Revoke this API key? The agent will stop syncing.")) {
                                                            revokeKey(key.id);
                                                        }
                                                    }}
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Agent metadata */}
                                        {(key.agentIp || key.agentVersion) && (
                                            <div className="mt-2 pt-2 border-t border-card-border flex items-center gap-4 text-[10px] text-muted-foreground">
                                                {key.agentIp && (
                                                    <span className="flex items-center gap-1">
                                                        <Globe className="h-3 w-3" /> {key.agentIp}
                                                    </span>
                                                )}
                                                {key.agentVersion && (
                                                    <span className="flex items-center gap-1">
                                                        <Server className="h-3 w-3" /> v{key.agentVersion}
                                                    </span>
                                                )}
                                                {key.lastSyncAt && (
                                                    <span className="flex items-center gap-1">
                                                        <Activity className="h-3 w-3" /> Last sync: {timeAgo(key.lastSyncAt)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ═══ Setup Wizard ═══════════════════════════════ */}
                    <div className="rounded-xl border border-card-border overflow-hidden">
                        <div className="px-4 py-3 bg-linear-to-r from-emerald-500/10 via-cyan-500/5 to-transparent border-b border-card-border">
                            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Terminal className="h-4 w-4 text-emerald-400" />
                                {t("setupGuide")}
                            </h3>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* Step 1: Generate API Key */}
                            <div
                                className={cn(
                                    "rounded-lg border p-3 transition-all duration-200",
                                    activeStep === 0
                                        ? "border-emerald-500/30 bg-emerald-500/5"
                                        : "border-card-border bg-hover"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                        activeStep >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-hover text-muted-foreground"
                                    )}>
                                        1
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground mb-1">
                                            {t("step1Title")}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            {t("step1Desc")}
                                        </p>

                                        {activeStep === 0 && !newRawKey && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={newKeyName}
                                                    onChange={(e) => setNewKeyName(e.target.value)}
                                                    placeholder="Agent name..."
                                                    className="h-9 px-3 rounded-lg bg-hover border border-card-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 flex-1"
                                                />
                                                <Button
                                                    onClick={createKey}
                                                    disabled={creating || !newKeyName.trim()}
                                                    className="bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/20 gap-2 shrink-0"
                                                >
                                                    {creating ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Key className="h-4 w-4" />
                                                    )}
                                                    {t("generateKey")}
                                                </Button>
                                            </div>
                                        )}

                                        {/* Show Raw Key (one-time) */}
                                        {newRawKey && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                                                    <p className="text-xs text-amber-300">
                                                        {t("keyCopyWarning")}
                                                    </p>
                                                </div>
                                                <div className="relative">
                                                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-hover border border-card-border font-mono text-xs text-foreground overflow-x-auto">
                                                        <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
                                                        {showKey ? (
                                                            <span className="select-all break-all">{newRawKey}</span>
                                                        ) : (
                                                            <span>{"•".repeat(40)}</span>
                                                        )}
                                                    </div>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowKey(!showKey)}
                                                            className="p-1 hover:bg-hover rounded"
                                                        >
                                                            {showKey ? (
                                                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                                            ) : (
                                                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyToClipboard(newRawKey, "key")}
                                                            className="p-1 hover:bg-hover rounded"
                                                        >
                                                            {copied ? (
                                                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                            ) : (
                                                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Download Agent (one-click) */}
                            <div
                                className={cn(
                                    "rounded-lg border p-3 transition-all duration-200",
                                    activeStep === 1
                                        ? "border-cyan-500/30 bg-cyan-500/5"
                                        : "border-card-border bg-hover"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                        activeStep >= 1 ? "bg-cyan-500/15 text-cyan-400" : "bg-hover text-muted-foreground"
                                    )}>
                                        2
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground mb-1">
                                            {t("step2Title")}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            {t("step2Desc")}
                                        </p>
                                        {activeStep >= 1 && (
                                            <div className="space-y-2">
                                                <a
                                                    href={downloadUrl}
                                                    download="peopleflow-sync.js"
                                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white text-sm font-medium shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:scale-[1.02]"
                                                >
                                                    <Download className="h-4 w-4" />
                                                    Download Sync Agent
                                                </a>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    <Shield className="h-3 w-3 text-cyan-400/50" />
                                                    <span>Cloud URL &amp; API Key pre-configured • Zero-dependency • Node.js 16+</span>
                                                </div>
                                                <a
                                                    href="https://nodejs.org"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400/70 hover:text-cyan-300 transition-colors"
                                                >
                                                    Don&apos;t have Node.js? Download it from nodejs.org
                                                    <ArrowRight className="h-3 w-3" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Run the agent */}
                            <div
                                className={cn(
                                    "rounded-lg border p-3 transition-all duration-200",
                                    activeStep === 2
                                        ? "border-blue-500/30 bg-blue-500/5"
                                        : "border-card-border bg-hover"
                                )}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                                        activeStep >= 2 ? "bg-blue-500/15 text-blue-400" : "bg-hover text-muted-foreground"
                                    )}>
                                        3
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-foreground mb-1">
                                            {t("step3Title")}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-2">
                                            {t("step3Desc")}
                                        </p>
                                        {activeStep >= 1 && (
                                            <div className="space-y-2">
                                                <div className="relative">
                                                    <pre className="px-3 py-2.5 rounded-lg bg-[#0d1117] border border-card-border text-xs text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                                                        {runCommand}
                                                    </pre>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyToClipboard(runCommand, "cmd")}
                                                        className="absolute right-2 top-2 p-1 hover:bg-hover rounded"
                                                    >
                                                        {copiedCmd ? (
                                                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                                                        ) : (
                                                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                                        )}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">
                                                    The agent will ask for your device IP, then automatically start syncing attendance data.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Advance Step Button */}
                            {newRawKey && activeStep < 2 && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setActiveStep((s) => Math.min(s + 1, 2))}
                                    className="w-full gap-2"
                                >
                                    Next Step
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* ═══ Loading State ═══════════════════════════════ */}
                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {/* ═══ No Agents Yet ═══════════════════════════════ */}
                    {!loading && keys.length === 0 && !newRawKey && (
                        <div className="flex flex-col items-center justify-center py-8 gap-3">
                            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <Plus className="h-8 w-8 text-emerald-400/40" />
                            </div>
                            <p className="text-sm text-muted-foreground text-center max-w-xs">
                                {t("noAgentsYet")}
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
