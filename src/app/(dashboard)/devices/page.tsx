"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Fingerprint,
    Plus,
    Wifi,
    WifiOff,
    RefreshCw,
    Trash2,
    Settings2,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    Server,
    MapPin,
    Building,
    Activity,
    ChevronDown,
    ChevronUp,
    Zap,
    History,
    Link2,
    Router,
    ShieldCheck,
    AlertTriangle,
    Filter,
    ArrowRight,
    HelpCircle,
} from "lucide-react";
import { BiometricMappingHub } from "@/components/biometric/mapping-hub";
import { SyncAgentSetup } from "@/components/biometric/sync-agent-setup";
import { useBiometricDevices, type BiometricDeviceRecord } from "@/hooks/use-data";

// ── Types ─────────────────────────────────────────────────────────────

interface Branch {
    id: string;
    name: string;
    code: string;
}

interface SyncLog {
    id: string;
    status: string;
    recordsSynced: number;
    recordsSkipped: number;
    errorMessage: string | null;
    syncDuration: number | null;
    syncedAt: string;
}

interface CloudEventLog {
    id: string;
    eventType: string;
    status: string;
    recordsReceived: number;
    recordsSynced: number;
    recordsSkipped: number;
    unmappedUserIds: string[];
    errorMessage: string | null;
    createdAt: string;
}

type BiometricDevice = BiometricDeviceRecord & {
    syncLogs?: SyncLog[];
    cloudEvents?: CloudEventLog[];
};

interface DeviceFormData {
    name: string;
    ip: string;
    port: number;
    model: string;
    connectionType: string;
    connectionMode: string;
    cloudProtocol: string;
    serialNumber: string;
    timezone: string;
    setupNotes: string;
    location: string;
    branchId: string;
    syncInterval: number;
}

// ── Component ─────────────────────────────────────────────────────────

export default function DevicesPage() {
    const t = useTranslations("Devices");
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const { addToast } = useToast();
    const { confirm } = useConfirmDialog();
    const queryClient = useQueryClient();

    // ── TanStack Query: devices ──
    const { data: devicesData = [], isLoading: loading } = useBiometricDevices();
    const devices = devicesData as BiometricDevice[];

    const [branches, setBranches] = useState<Branch[]>([]);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editDevice, setEditDevice] = useState<BiometricDevice | null>(null);
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [expandedLogs, setExpandedLogs] = useState<SyncLog[]>([]);
    const [expandedCloudEvents, setExpandedCloudEvents] = useState<CloudEventLog[]>([]);
    const [deviceFilter, setDeviceFilter] = useState<"all" | "attention" | "direct_cloud" | "sync_agent">("all");
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [mappingDevice, setMappingDevice] = useState<BiometricDevice | null>(null);
    const [syncAgentOpen, setSyncAgentOpen] = useState(false);
    const [showSetupGuide, setShowSetupGuide] = useState(false);

    const [form, setForm] = useState<DeviceFormData>({
        name: "",
        ip: "",
        port: 4370,
        model: "ZKTeco",
        connectionType: "tcp",
        connectionMode: "sync_agent",
        cloudProtocol: "adms",
        serialNumber: "",
        timezone: "Asia/Dhaka",
        setupNotes: "",
        location: "",
        branchId: "",
        syncInterval: 15,
    });

    // ── Fetch Branches (one-time) ────────────────────────────────────
    // Branches don't change often; fetch once on mount. Not worth a
    // TanStack Query hook for a one-time fetch.
    useState(() => {
        fetch("/api/branches")
            .then((r) => r.json())
            .then((data) => setBranches(Array.isArray(data) ? data : data.branches || []))
            .catch(() => { /* silent — branches are optional */ });
    });

    const invalidateDevices = () => {
        queryClient.invalidateQueries({ queryKey: ["biometric-devices"] });
    };

    // ── Add/Edit Device ───────────────────────────────────────────────

    const handleOpenAdd = (mode: "sync_agent" | "direct_cloud" = "sync_agent") => {
        setForm({
            name: "",
            ip: "",
            port: 4370,
            model: "ZKTeco",
            connectionType: mode === "direct_cloud" ? "adms" : "tcp",
            connectionMode: mode,
            cloudProtocol: "adms",
            serialNumber: "",
            timezone: "Asia/Dhaka",
            setupNotes: "",
            location: "",
            branchId: "",
            syncInterval: 15,
        });
        setEditDevice(null);
        setShowAddDialog(true);
    };

    const handleOpenEdit = (device: BiometricDevice) => {
        setForm({
            name: device.name,
            ip: device.ip,
            port: device.port,
            model: device.model,
            connectionType: device.connectionType,
            connectionMode: device.connectionMode || "sync_agent",
            cloudProtocol: device.cloudProtocol || "adms",
            serialNumber: device.serialNumber || "",
            timezone: device.timezone || "Asia/Dhaka",
            setupNotes: device.setupNotes || "",
            location: device.location || "",
            branchId: device.branchId || "",
            syncInterval: device.syncInterval,
        });
        setEditDevice(device);
        setShowAddDialog(true);
    };

    const handleSave = async () => {
        if (!form.name || (form.connectionMode === "sync_agent" && !form.ip) || (form.connectionMode === "direct_cloud" && !form.serialNumber)) {
            addToast({ title: form.connectionMode === "direct_cloud" ? t("nameSerialRequired") : t("nameIpRequired"), type: "error" });
            return;
        }

        setSaving(true);
        try {
            const url = editDevice
                ? `/api/biometric-devices/${editDevice.id}`
                : "/api/biometric-devices";
            const method = editDevice ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            if (res.ok) {
                addToast({ title: editDevice ? t("deviceUpdated") : t("deviceAdded"), type: "success" });
                setShowAddDialog(false);
                invalidateDevices();
            } else {
                const err = await res.json().catch(() => ({}));
                addToast({ title: err.error || t("saveFailed"), type: "error" });
            }
        } catch {
            addToast({ title: t("saveFailed"), type: "error" });
        } finally {
            setSaving(false);
        }
    };

    // ── Delete Device ─────────────────────────────────────────────────

    const handleDelete = async (id: string) => {
        const _ok = await confirm({ title: t("confirmDelete"), description: "This device will be removed.", confirmLabel: "Delete", variant: "destructive" }); if (!_ok) return;

        try {
            const res = await fetch(`/api/biometric-devices/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                addToast({ title: t("deviceDeleted"), type: "success" });
                invalidateDevices();
            } else {
                addToast({ title: t("deleteFailed"), type: "error" });
            }
        } catch {
            addToast({ title: t("deleteFailed"), type: "error" });
        }
    };

    // ── Test Connection ───────────────────────────────────────────────

    const handleTest = async (id: string) => {
        setTestingId(id);
        try {
            const res = await fetch(`/api/biometric-devices/${id}/test`, {
                method: "POST",
            });
            const result = await res.json();
            if (result.success) {
                addToast({ title: `${t("connectionSuccess")}${result.deviceInfo?.serialNumber ? ` — SN: ${result.deviceInfo.serialNumber}` : ""}`, type: "success" });
            } else {
                addToast({ title: `${t("connectionFailed")}: ${result.message}`, type: "error" });
            }
        } catch {
            addToast({ title: t("connectionFailed"), type: "error" });
        } finally {
            setTestingId(null);
        }
    };

    // ── Sync Device ───────────────────────────────────────────────────

    const handleSync = async (id: string) => {
        setSyncingId(id);
        try {
            const res = await fetch(`/api/biometric-devices/${id}/sync`, {
                method: "POST",
            });
            const result = await res.json();
            if (result.success) {
                addToast({ title: `${t("syncComplete")}: ${result.recordsSynced} ${t("recordsSynced")}`, type: "success" });
                invalidateDevices();
            } else {
                addToast({ title: `${t("syncFailed")}: ${result.error || "Unknown error"}`, type: "error" });
            }
        } catch {
            addToast({ title: t("syncFailed"), type: "error" });
        } finally {
            setSyncingId(null);
        }
    };

    // ── Toggle Sync Logs ──────────────────────────────────────────────

    const toggleSyncLogs = async (id: string) => {
        if (expandedId === id) {
            setExpandedId(null);
            return;
        }

        setExpandedId(id);
        setLoadingLogs(true);
        try {
            const res = await fetch(`/api/biometric-devices/${id}`);
            if (res.ok) {
                const data = await res.json();
                setExpandedLogs(data.syncLogs || []);
                setExpandedCloudEvents(data.cloudEvents || []);
            }
        } catch {
            setExpandedLogs([]);
            setExpandedCloudEvents([]);
        } finally {
            setLoadingLogs(false);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return t("never");
        return new Intl.DateTimeFormat(dateLocale, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(dateStr));
    };

    const isPrivateLanIp = (ip: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.)/.test(ip);

    const isFresh = (dateStr: string | null, minutes = 30) => {
        if (!dateStr) return false;
        return Date.now() - new Date(dateStr).getTime() <= minutes * 60 * 1000;
    };

    const isDeviceOnline = (device: BiometricDevice) => {
        if (!device.isActive) return false;
        if (device.connectionMode === "direct_cloud") return device.cloudStatus === "connected" && isFresh(device.lastSeenAt, 30);
        return device.isOnline || isFresh(device.lastSyncAt, Math.max(device.syncInterval * 3, 30));
    };

    const getCloudEventLabel = (event: CloudEventLog) => {
        if (event.status === "processed") return t("attendanceUploadProcessed");
        if (event.status === "partial") return t("attendanceUploadNeedsMapping");
        if (event.status === "unknown_device") return t("unknownDeviceEvent");
        if (event.status === "failed") return t("deviceEventFailed");
        if (event.eventType === "getrequest") return t("deviceHeartbeatEvent");
        if (event.eventType === "cdata" && event.recordsReceived === 0) return t("deviceOperationEvent");
        return t("deviceEventCaptured");
    };

    const hasAttention = (device: BiometricDevice) => {
        if (!device.isActive) return false;
        if (device.connectionMode === "direct_cloud") {
            return !isDeviceOnline(device) || device.cloudStatus === "failed" || device.cloudStatus === "unknown_device" || device.lastSyncStatus === "partial" || device.lastSyncStatus === "failed";
        }
        return !isDeviceOnline(device) || device.lastSyncStatus === "failed";
    };

    const directCloudCount = devices.filter((d) => d.connectionMode === "direct_cloud").length;
    const syncAgentCount = devices.filter((d) => d.connectionMode !== "direct_cloud").length;
    const attentionCount = devices.filter(hasAttention).length;
    const filteredDevices = useMemo(() => {
        if (deviceFilter === "attention") return devices.filter(hasAttention);
        if (deviceFilter === "direct_cloud") return devices.filter((d) => d.connectionMode === "direct_cloud");
        if (deviceFilter === "sync_agent") return devices.filter((d) => d.connectionMode !== "direct_cloud");
        return devices;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [devices, deviceFilter]);

    const getSyncStatusBadge = (status: string | null) => {
        switch (status) {
            case "success":
                return (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-0 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("syncSuccess")}
                    </Badge>
                );
            case "failed":
                return (
                    <Badge className="bg-red-500/20 text-red-400 border-0 gap-1">
                        <XCircle className="h-3 w-3" />
                        {t("syncFailed")}
                    </Badge>
                );
            case "partial":
                return (
                    <Badge className="bg-amber-500/20 text-amber-400 border-0 gap-1">
                        <Activity className="h-3 w-3" />
                        {t("syncPartial")}
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-zinc-500/20 text-zinc-400 border-0 gap-1">
                        <Clock className="h-3 w-3" />
                        {t("neverSynced")}
                    </Badge>
                );
        }
    };

    // ── Render ─────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── Clean Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
                        <Fingerprint className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground">{t("title")}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Link href="/devices/events">
                        <Button variant="outline" className="gap-2 border-card-border">
                            <History className="h-4 w-4" />
                            <span className="hidden sm:inline">{t("eventsLink")}</span>
                        </Button>
                    </Link>
                    <Button
                        variant="outline"
                        onClick={() => setSyncAgentOpen(true)}
                        className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                    >
                        <Zap className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("syncAgentBtn")}</span>
                    </Button>
                    <Button onClick={() => handleOpenAdd("sync_agent")} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="h-4 w-4" />
                        {t("addDevice")}
                    </Button>
                </div>
            </div>

            {/* ── Summary Stats (compact, 4 cards) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border-card-border bg-card overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{t("totalDevices")}</p>
                                <p className="text-2xl font-display font-bold text-foreground mt-1 tabular-nums">{devices.length}</p>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                                <Server className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-card overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{t("onlineDevices")}</p>
                                <p className="text-2xl font-display font-bold text-emerald-400 mt-1 tabular-nums">
                                    {devices.filter((d) => isDeviceOnline(d)).length}
                                </p>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                                <Wifi className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border border-blue-500/20 bg-card overflow-hidden">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{t("cloudDevices")}</p>
                                <p className="text-2xl font-display font-bold text-blue-400 mt-1 tabular-nums">{directCloudCount}</p>
                            </div>
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                                <ShieldCheck className="h-5 w-5" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className={cn("border bg-card overflow-hidden", attentionCount > 0 ? "border-amber-500/20" : "border-card-border")}>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground truncate">{t("needsAttention")}</p>
                                <p className={cn("text-2xl font-display font-bold mt-1 tabular-nums", attentionCount > 0 ? "text-amber-400" : "text-foreground")}>
                                    {attentionCount}
                                </p>
                            </div>
                            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", attentionCount > 0 ? "bg-amber-500/15 text-amber-400" : "bg-muted/15 text-muted-foreground")}>
                                {attentionCount > 0 ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Filter Bar ── */}
            {devices.length > 0 && (
                <div className="flex flex-col gap-3 rounded-xl border border-card-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        {t("deviceViewFilter")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {[
                            ["all", t("filterAll"), devices.length],
                            ["attention", t("filterAttention"), attentionCount],
                            ["direct_cloud", t("filterDirectCloud"), directCloudCount],
                            ["sync_agent", t("filterSyncAgent"), syncAgentCount],
                        ].map(([value, label, count]) => (
                            <Button
                                key={String(value)}
                                variant={deviceFilter === value ? "default" : "outline"}
                                size="sm"
                                onClick={() => setDeviceFilter(value as typeof deviceFilter)}
                                className="gap-2"
                            >
                                {label}
                                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{count}</Badge>
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Empty State (clean, 2-path choice) ── */}
            {devices.length === 0 && (
                <Card className="bg-card border-card-border border-dashed">
                    <CardContent className="p-12 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
                            <Fingerprint className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">{t("noDevices")}</h3>
                        <p className="text-muted-foreground mb-6 max-w-xl mx-auto">{t("emptyGuidedDesc")}</p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <Button onClick={() => handleOpenAdd("direct_cloud")} className="gap-2 bg-linear-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700">
                                <ShieldCheck className="h-4 w-4" />
                                {t("addDirectCloudDevice")}
                            </Button>
                            <Button variant="outline" onClick={() => setSyncAgentOpen(true)} className="gap-2">
                                <Zap className="h-4 w-4" />
                                {t("guidedSetup")}
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Device List ── */}
            <div className="grid grid-cols-1 gap-4">
                {filteredDevices.map((device) => {
                    const isDirectCloudDevice = device.connectionMode === "direct_cloud";
                    const isPrivateLanDevice = !isDirectCloudDevice && isPrivateLanIp(device.ip);
                    const online = isDeviceOnline(device);
                    const needsAttention = hasAttention(device);
                    const healthCopy = !device.isActive
                        ? t("inactiveDeviceHint")
                        : needsAttention
                            ? isDirectCloudDevice
                                ? t("directCloudAttentionHint")
                                : t("syncAgentAttentionHint")
                            : isDirectCloudDevice
                                ? t("directCloudHealthyHint")
                                : t("syncAgentHealthyHint");

                    return (
                    <Card
                        key={device.id}
                        className={cn(
                            "bg-card border-card-border transition-all",
                            !device.isActive && "opacity-60"
                        )}
                    >
                        <CardContent className="p-5">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                {/* Device Info */}
                                <div className="flex items-start gap-4">
                                    <div
                                        className={cn(
                                            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                                            online
                                                ? "bg-emerald-500/10"
                                                : "bg-zinc-500/10"
                                        )}
                                    >
                                        {online ? (
                                            <Wifi className="h-6 w-6 text-emerald-400" />
                                        ) : (
                                            <WifiOff className="h-6 w-6 text-zinc-400" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <h3 className="font-semibold text-foreground">
                                                {device.name}
                                            </h3>
                                            <Badge className="bg-primary/10 text-primary border-0 text-xs">
                                                {device.model}
                                            </Badge>
                                            {isDirectCloudDevice && (
                                                <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20 text-xs">
                                                    {t("directCloudDevice")}
                                                </Badge>
                                            )}
                                            {isPrivateLanDevice && (
                                                <Badge className="bg-amber-500/10 text-amber-300 border-amber-500/20 text-xs">
                                                    {t("privateLanDevice")}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Server className="h-3.5 w-3.5" />
                                                {isDirectCloudDevice ? `${t("serialShort")}: ${device.serialNumber || "—"}` : `${device.ip}:${device.port}`}
                                            </span>
                                            {device.branch && (
                                                <span className="flex items-center gap-1">
                                                    <Building className="h-3.5 w-3.5" />
                                                    {device.branch.name}
                                                </span>
                                            )}
                                            {device.location && (
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                    {device.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Status + Actions */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                    {/* Sync Status */}
                                    <div className="text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge className={cn("border-0 gap-1", online ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/20 text-zinc-400")}>
                                                {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                                                {online ? t("online") : t("offline")}
                                            </Badge>
                                            {getSyncStatusBadge(device.lastSyncStatus)}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {isDirectCloudDevice ? t("lastSeen") : t("lastSync")}: {formatDateTime(isDirectCloudDevice ? device.lastSeenAt : device.lastSyncAt)}
                                        </p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleTest(device.id)}
                                            disabled={testingId === device.id || isPrivateLanDevice || isDirectCloudDevice}
                                            title={isDirectCloudDevice ? t("directCloudPassiveTooltip") : isPrivateLanDevice ? t("privateLanActionTooltip") : t("advancedTestTooltip")}
                                            className="gap-1"
                                        >
                                            {testingId === device.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Zap className="h-3.5 w-3.5" />
                                            )}
                                            <span className="hidden lg:inline">{t("test")}</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSync(device.id)}
                                            disabled={syncingId === device.id || isPrivateLanDevice || isDirectCloudDevice}
                                            title={isDirectCloudDevice ? t("directCloudPassiveTooltip") : isPrivateLanDevice ? t("privateLanActionTooltip") : t("advancedSyncTooltip")}
                                            className="gap-1"
                                        >
                                            {syncingId === device.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-3.5 w-3.5" />
                                            )}
                                            <span className="hidden lg:inline">{t("sync")}</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setMappingDevice(device)}
                                            disabled={isPrivateLanDevice || isDirectCloudDevice}
                                            title={isDirectCloudDevice ? t("directCloudMappingTooltip") : isPrivateLanDevice ? t("privateLanUsersTooltip") : t("mapUsersTooltip")}
                                            className="gap-1"
                                        >
                                            <Link2 className="h-3.5 w-3.5" />
                                            <span className="hidden lg:inline">{t("viewDeviceUsers")}</span>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleOpenEdit(device)}
                                            title={t("editDevice")}
                                        >
                                            <Settings2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleSyncLogs(device.id)}
                                            title={t("syncHistory")}
                                        >
                                            {expandedId === device.id ? (
                                                <ChevronUp className="h-4 w-4" />
                                            ) : (
                                                <ChevronDown className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-400 hover:text-red-300"
                                            onClick={() => handleDelete(device.id)}
                                            title={t("confirmDelete")}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Health Status Banner */}
                            <div className={cn(
                                "mt-4 rounded-xl border p-3 text-sm",
                                needsAttention ? "border-amber-500/20 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5"
                            )}>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-start gap-2">
                                        {needsAttention ? (
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                                        ) : (
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                                        )}
                                        <div>
                                            <p className="font-medium text-foreground">{needsAttention ? t("attentionRequired") : t("readyForAttendance")}</p>
                                            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{healthCopy}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expandable Sync Logs */}
                            {expandedId === device.id && (
                                <div className="mt-4 pt-4 border-t border-card-border">
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                        <History className="h-4 w-4" />
                                        {isDirectCloudDevice ? t("deviceEventHistory") : t("syncHistory")}
                                    </h4>
                                    {loadingLogs ? (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : isDirectCloudDevice ? (
                                        expandedCloudEvents.length === 0 ? (
                                            <p className="text-sm text-muted-foreground py-2">{t("noDeviceEvents")}</p>
                                        ) : (
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {expandedCloudEvents.map((event) => (
                                                    <div
                                                        key={event.id}
                                                        className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-hover text-sm"
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            {event.status === "processed" ? (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                                            ) : event.status === "failed" || event.status === "unknown_device" ? (
                                                                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                                                            ) : (
                                                                <Activity className="h-4 w-4 text-cyan-400 shrink-0" />
                                                            )}
                                                            <div className="min-w-0">
                                                                <p className="text-foreground">{getCloudEventLabel(event)}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {event.recordsSynced} {t("synced")} / {event.recordsSkipped} {t("skipped")}
                                                                    {event.unmappedUserIds.length > 0 ? ` • ${t("unmappedUsers")}: ${event.unmappedUserIds.join(", ")}` : ""}
                                                                </p>
                                                                {event.errorMessage && <p className="truncate text-xs text-red-400">{event.errorMessage}</p>}
                                                            </div>
                                                        </div>
                                                        <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    ) : expandedLogs.length === 0 ? (
                                        <p className="text-sm text-muted-foreground py-2">{t("noSyncHistory")}</p>
                                    ) : (
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {expandedLogs.map((log) => (
                                                <div
                                                    key={log.id}
                                                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-hover text-sm"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {log.status === "success" ? (
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                                        ) : log.status === "failed" ? (
                                                            <XCircle className="h-4 w-4 text-red-400" />
                                                        ) : (
                                                            <Activity className="h-4 w-4 text-amber-400" />
                                                        )}
                                                        <span className="text-foreground">
                                                            {log.recordsSynced} {t("synced")} / {log.recordsSkipped} {t("skipped")}
                                                        </span>
                                                        {log.errorMessage && (
                                                            <span className="text-red-400 text-xs truncate max-w-[200px]">
                                                                {log.errorMessage}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-muted-foreground text-xs">
                                                        {log.syncDuration && (
                                                            <span>{t("secondsShort", { count: Math.round(log.syncDuration / 1000) })}</span>
                                                        )}
                                                        <span>{formatDateTime(log.syncedAt)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    );
                })}
            </div>

            {/* ── Collapsible Setup Guide — 2-path "Choose your setup" ── */}
            {devices.length > 0 && (
                <Card className="border-card-border bg-card">
                    <button
                        onClick={() => setShowSetupGuide(!showSetupGuide)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-hover/50 transition-colors rounded-xl"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                                <HelpCircle className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-foreground">{t("chooseSetupTitle")}</p>
                                <p className="text-xs text-muted-foreground">{t("chooseSetupDesc")}</p>
                            </div>
                        </div>
                        {showSetupGuide ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                    </button>
                    {showSetupGuide && (
                        <CardContent className="pt-0">
                            {/* 2-path cards */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                                {/* Direct Cloud Path */}
                                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
                                            <ShieldCheck className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground">{t("pathDirectCloudTitle")}</h3>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("pathDirectCloudDesc")}</p>
                                        </div>
                                    </div>
                                    <ol className="space-y-2 mb-4">
                                        {[
                                            t("pathDirectCloudStep1"),
                                            t("pathDirectCloudStep2"),
                                            t("pathDirectCloudStep3"),
                                        ].map((step, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-300 text-[10px] font-mono font-bold mt-0.5">
                                                    {i + 1}
                                                </span>
                                                <span className="leading-relaxed pt-0.5">{step}</span>
                                            </li>
                                        ))}
                                    </ol>
                                    <Button
                                        onClick={() => handleOpenAdd("direct_cloud")}
                                        className="w-full gap-2 bg-linear-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700"
                                        size="sm"
                                    >
                                        <ShieldCheck className="h-4 w-4" />
                                        {t("pathDirectCloudCta")}
                                    </Button>
                                </div>

                                {/* Sync Agent Path */}
                                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                                            <Router className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-semibold text-foreground">{t("pathSyncAgentTitle")}</h3>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("pathSyncAgentDesc")}</p>
                                        </div>
                                    </div>
                                    <ol className="space-y-2 mb-4">
                                        {[
                                            t("pathSyncAgentStep1"),
                                            t("pathSyncAgentStep2"),
                                            t("pathSyncAgentStep3"),
                                        ].map((step, i) => (
                                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 text-[10px] font-mono font-bold mt-0.5">
                                                    {i + 1}
                                                </span>
                                                <span className="leading-relaxed pt-0.5">{step}</span>
                                            </li>
                                        ))}
                                    </ol>
                                    <Button
                                        onClick={() => setSyncAgentOpen(true)}
                                        className="w-full gap-2 bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                                        size="sm"
                                    >
                                        <Zap className="h-4 w-4" />
                                        {t("pathSyncAgentCta")}
                                    </Button>
                                </div>
                            </div>

                            {/* After-connect note */}
                            <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-xs text-amber-200 leading-relaxed">{t("setupAfterConnect")}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 shrink-0"
                                    onClick={() => {
                                        setShowSetupGuide(false);
                                        if (devices.length > 0) {
                                            setMappingDevice(devices[0]);
                                        }
                                    }}
                                    disabled={devices.length === 0}
                                >
                                    <Link2 className="h-3.5 w-3.5" />
                                    {t("setupMapEmployees")}
                                </Button>
                            </div>
                        </CardContent>
                    )}
                </Card>
            )}

            {/* ── Add/Edit Dialog (unchanged) ── */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden bg-card p-0 sm:max-w-lg border-card-border">
                    <DialogHeader className="shrink-0 border-b border-card-border px-6 py-4">
                        <DialogTitle className="flex items-center gap-2">
                            <Fingerprint className="h-5 w-5 text-primary" />
                            {editDevice ? t("editDevice") : t("addDevice")}
                        </DialogTitle>
                        <DialogDescription>
                            {editDevice ? t("editDeviceDesc") : t("addDeviceDesc")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 overflow-y-auto px-6 py-4">
                        {/* Setup Type */}
                        <div className="grid gap-2">
                            <Label>{t("setupType")}</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, connectionMode: "direct_cloud", connectionType: "adms", ip: "" })}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition-all",
                                        form.connectionMode === "direct_cloud"
                                            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-100"
                                            : "border-card-border bg-background hover:bg-hover"
                                    )}
                                >
                                    <div className="flex items-center gap-2 font-semibold text-sm">
                                        <ShieldCheck className="h-4 w-4" /> {t("directCloudOption")}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{t("directCloudOptionDesc")}</p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, connectionMode: "sync_agent", connectionType: "tcp" })}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition-all",
                                        form.connectionMode === "sync_agent"
                                            ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-100"
                                            : "border-card-border bg-background hover:bg-hover"
                                    )}
                                >
                                    <div className="flex items-center gap-2 font-semibold text-sm">
                                        <Router className="h-4 w-4" /> {t("syncAgentOption")}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{t("syncAgentOptionDesc")}</p>
                                </button>
                            </div>
                        </div>

                        {/* Name */}
                        <div className="grid gap-2">
                            <Label>{t("deviceName")}</Label>
                            <Input
                                placeholder={t("deviceNamePlaceholder")}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </div>

                        {form.connectionMode === "direct_cloud" ? (
                            <div className="grid gap-3">
                                <div className="grid gap-2">
                                    <Label>{t("serialNumber")}</Label>
                                    <Input
                                        placeholder="FQQ2251600165"
                                        value={form.serialNumber}
                                        onChange={(e) => setForm({ ...form, serialNumber: e.target.value.toUpperCase().trim() })}
                                    />
                                </div>
                                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-muted-foreground leading-relaxed">
                                    <p className="font-semibold text-cyan-200 mb-1">{t("directCloudServerBoxTitle")}</p>
                                    <p>{t("directCloudServerBoxDesc")}</p>
                                    <div className="mt-2 grid gap-1 font-mono text-foreground">
                                        <span>Server: peopleflowbd.online</span>
                                        <span>Port: 80</span>
                                        <span>Path: /iclock/cdata</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2 grid gap-2">
                                    <Label>{t("ipAddress")}</Label>
                                    <Input
                                        placeholder="192.168.1.201"
                                        value={form.ip}
                                        onChange={(e) => setForm({ ...form, ip: e.target.value })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>{t("port")}</Label>
                                    <Input
                                        type="number"
                                        value={form.port}
                                        onChange={(e) =>
                                            setForm({ ...form, port: parseInt(e.target.value) || 4370 })
                                        }
                                    />
                                </div>
                            </div>
                        )}

                        {/* Model + Connection Type */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label>{t("deviceModel")}</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={form.model}
                                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                                >
                                    <option value="ZKTeco">ZKTeco</option>
                                    <option value="Suprema">Suprema</option>
                                    <option value="HikVision">HikVision</option>
                                    <option value="Anviz">Anviz</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label>{t("connectionType")}</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={form.connectionType}
                                    onChange={(e) =>
                                        setForm({ ...form, connectionType: e.target.value })
                                    }
                                >
                                    {form.connectionMode === "direct_cloud" ? (
                                        <option value="adms">ADMS / iClock</option>
                                    ) : (
                                        <>
                                            <option value="tcp">TCP</option>
                                            <option value="udp">UDP</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>

                        {/* Branch */}
                        <div className="grid gap-2">
                            <Label>{t("branch")}</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={form.branchId}
                                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                            >
                                <option value="">{t("noBranch")}</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}{b.code ? ` (${b.code})` : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Location + Sync Interval */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label>{t("physicalLocation")}</Label>
                                <Input
                                    placeholder={t("locationPlaceholder")}
                                    value={form.location}
                                    onChange={(e) =>
                                        setForm({ ...form, location: e.target.value })
                                    }
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>{form.connectionMode === "direct_cloud" ? t("heartbeatIntervalMin") : t("syncIntervalMin")}</Label>
                                <Input
                                    type="number"
                                    min={5}
                                    max={1440}
                                    value={form.syncInterval}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            syncInterval: parseInt(e.target.value) || 15,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="shrink-0 border-t border-card-border bg-card/95 px-6 py-4 shadow-[0_-10px_30px_rgba(0,0,0,0.25)] backdrop-blur sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setShowAddDialog(false)}
                        >
                            {t("cancel")}
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {editDevice ? t("updateDevice") : t("addDevice")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Biometric Mapping Hub */}
            {mappingDevice && (
                <BiometricMappingHub
                    open={!!mappingDevice}
                    onOpenChange={(open) => !open && setMappingDevice(null)}
                    deviceId={mappingDevice.id}
                    deviceName={mappingDevice.name}
                    deviceModel={mappingDevice.model}
                />
            )}

            {/* Sync Agent Setup */}
            <SyncAgentSetup
                open={syncAgentOpen}
                onOpenChange={setSyncAgentOpen}
                cloudUrl={typeof window !== "undefined" ? window.location.origin : "https://peopleflowbd.online"}
            />
        </div>
    );
}
