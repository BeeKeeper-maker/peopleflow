"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";
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
    Users,
    Link2,
} from "lucide-react";
import { BiometricMappingHub } from "@/components/biometric/mapping-hub";
import { SyncAgentSetup } from "@/components/biometric/sync-agent-setup";

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

interface BiometricDevice {
    id: string;
    name: string;
    serialNumber: string | null;
    model: string;
    ip: string;
    port: number;
    connectionType: string;
    location: string | null;
    isActive: boolean;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    syncInterval: number;
    branchId: string | null;
    branch: Branch | null;
    _count?: { syncLogs: number };
    syncLogs?: SyncLog[];
    createdAt: string;
}

interface DeviceFormData {
    name: string;
    ip: string;
    port: number;
    model: string;
    connectionType: string;
    location: string;
    branchId: string;
    syncInterval: number;
}

// ── Component ─────────────────────────────────────────────────────────

export default function DevicesPage() {
    const t = useTranslations("Devices");
    const { addToast } = useToast();

    const [devices, setDevices] = useState<BiometricDevice[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editDevice, setEditDevice] = useState<BiometricDevice | null>(null);
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [expandedLogs, setExpandedLogs] = useState<SyncLog[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [mappingDevice, setMappingDevice] = useState<BiometricDevice | null>(null);
    const [syncAgentOpen, setSyncAgentOpen] = useState(false);

    const [form, setForm] = useState<DeviceFormData>({
        name: "",
        ip: "",
        port: 4370,
        model: "ZKTeco",
        connectionType: "tcp",
        location: "",
        branchId: "",
        syncInterval: 15,
    });

    // ── Fetch Devices ─────────────────────────────────────────────

    const fetchDevices = useCallback(async () => {
        try {
            const res = await fetch("/api/biometric-devices");
            if (res.ok) {
                const data = await res.json();
                setDevices(data);
            }
        } catch (error) {
            console.error("Failed to fetch devices:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchBranches = useCallback(async () => {
        try {
            const res = await fetch("/api/branches");
            if (res.ok) {
                const data = await res.json();
                setBranches(Array.isArray(data) ? data : data.branches || []);
            }
        } catch (error) {
            console.error("Failed to fetch branches:", error);
        }
    }, []);

    useEffect(() => {
        fetchDevices();
        fetchBranches();
    }, [fetchDevices, fetchBranches]);

    // ── Add/Edit Device ───────────────────────────────────────────

    const handleOpenAdd = () => {
        setForm({
            name: "",
            ip: "",
            port: 4370,
            model: "ZKTeco",
            connectionType: "tcp",
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
            location: device.location || "",
            branchId: device.branchId || "",
            syncInterval: device.syncInterval,
        });
        setEditDevice(device);
        setShowAddDialog(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.ip) {
            addToast({ title: t("nameIpRequired"), type: "error" });
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
                fetchDevices();
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

    // ── Delete Device ─────────────────────────────────────────────

    const handleDelete = async (id: string) => {
        if (!confirm(t("confirmDelete"))) return;

        try {
            const res = await fetch(`/api/biometric-devices/${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                addToast({ title: t("deviceDeleted"), type: "success" });
                fetchDevices();
            } else {
                addToast({ title: t("deleteFailed"), type: "error" });
            }
        } catch {
            addToast({ title: t("deleteFailed"), type: "error" });
        }
    };

    // ── Test Connection ───────────────────────────────────────────

    const handleTest = async (id: string) => {
        setTestingId(id);
        try {
            const res = await fetch(`/api/biometric-devices/${id}/test`, {
                method: "POST",
            });
            const result = await res.json();
            if (result.success) {
                addToast({ title: `✅ ${t("connectionSuccess")}${result.deviceInfo?.serialNumber ? ` — SN: ${result.deviceInfo.serialNumber}` : ""}`, type: "success" });
            } else {
                addToast({ title: `❌ ${t("connectionFailed")}: ${result.message}`, type: "error" });
            }
        } catch {
            addToast({ title: t("connectionFailed"), type: "error" });
        } finally {
            setTestingId(null);
        }
    };

    // ── Sync Device ───────────────────────────────────────────────

    const handleSync = async (id: string) => {
        setSyncingId(id);
        try {
            const res = await fetch(`/api/biometric-devices/${id}/sync`, {
                method: "POST",
            });
            const result = await res.json();
            if (result.success) {
                addToast({ title: `✅ ${t("syncComplete")}: ${result.recordsSynced} ${t("recordsSynced")}`, type: "success" });
                fetchDevices();
            } else {
                addToast({ title: `❌ ${t("syncFailed")}: ${result.error || "Unknown error"}`, type: "error" });
            }
        } catch {
            addToast({ title: t("syncFailed"), type: "error" });
        } finally {
            setSyncingId(null);
        }
    };

    // ── Toggle Sync Logs ──────────────────────────────────────────

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
            }
        } catch {
            setExpandedLogs([]);
        } finally {
            setLoadingLogs(false);
        }
    };

    // ── Helpers ───────────────────────────────────────────────────

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return t("never");
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

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

    // ── Render ─────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                        <Fingerprint className="h-8 w-8 text-primary" />
                        {t("title")}
                    </h1>
                    <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setSyncAgentOpen(true)}
                        className="gap-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                    >
                        <Zap className="h-4 w-4" />
                        {t("syncAgentBtn")}
                    </Button>
                    <Button onClick={handleOpenAdd} className="gap-2">
                        <Plus className="h-4 w-4" />
                        {t("addDevice")}
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Server className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{devices.length}</p>
                            <p className="text-sm text-muted-foreground">{t("totalDevices")}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <Wifi className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">
                                {devices.filter((d) => d.isActive).length}
                            </p>
                            <p className="text-sm text-muted-foreground">{t("activeDevices")}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-card-border">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <RefreshCw className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">
                                {devices.filter((d) => d.lastSyncStatus === "success").length}
                            </p>
                            <p className="text-sm text-muted-foreground">{t("lastSyncOk")}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Empty State */}
            {devices.length === 0 && (
                <Card className="bg-card border-card-border border-dashed">
                    <CardContent className="p-12 text-center">
                        <Fingerprint className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-foreground mb-2">{t("noDevices")}</h3>
                        <p className="text-muted-foreground mb-6">{t("noDevicesDesc")}</p>
                        <Button onClick={handleOpenAdd} className="gap-2">
                            <Plus className="h-4 w-4" />
                            {t("addFirstDevice")}
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Device List */}
            <div className="grid grid-cols-1 gap-4">
                {devices.map((device) => (
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
                                            device.isActive
                                                ? "bg-emerald-500/10"
                                                : "bg-zinc-500/10"
                                        )}
                                    >
                                        {device.isActive ? (
                                            <Wifi className="h-6 w-6 text-emerald-400" />
                                        ) : (
                                            <WifiOff className="h-6 w-6 text-zinc-400" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-foreground">
                                                {device.name}
                                            </h3>
                                            <Badge className="bg-primary/10 text-primary border-0 text-xs">
                                                {device.model}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Server className="h-3.5 w-3.5" />
                                                {device.ip}:{device.port}
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
                                        {getSyncStatusBadge(device.lastSyncStatus)}
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t("lastSync")}: {formatDateTime(device.lastSyncAt)}
                                        </p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleTest(device.id)}
                                            disabled={testingId === device.id}
                                            className="gap-1"
                                        >
                                            {testingId === device.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Zap className="h-3.5 w-3.5" />
                                            )}
                                            {t("test")}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleSync(device.id)}
                                            disabled={syncingId === device.id}
                                            className="gap-1"
                                        >
                                            {syncingId === device.id ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-3.5 w-3.5" />
                                            )}
                                            {t("sync")}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setMappingDevice(device)}
                                            className="gap-1"
                                        >
                                            <Link2 className="h-3.5 w-3.5" />
                                            {t("viewDeviceUsers")}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleOpenEdit(device)}
                                        >
                                            <Settings2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => toggleSyncLogs(device.id)}
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
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Expandable Sync Logs */}
                            {expandedId === device.id && (
                                <div className="mt-4 pt-4 border-t border-card-border">
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                        <History className="h-4 w-4" />
                                        {t("syncHistory")}
                                    </h4>
                                    {loadingLogs ? (
                                        <div className="flex items-center justify-center py-4">
                                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                        </div>
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
                                                            <span>{Math.round(log.syncDuration / 1000)}s</span>
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
                ))}
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="sm:max-w-lg bg-card border-card-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Fingerprint className="h-5 w-5 text-primary" />
                            {editDevice ? t("editDevice") : t("addDevice")}
                        </DialogTitle>
                        <DialogDescription>
                            {editDevice ? t("editDeviceDesc") : t("addDeviceDesc")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        {/* Name */}
                        <div className="grid gap-2">
                            <Label>{t("deviceName")}</Label>
                            <Input
                                placeholder={t("deviceNamePlaceholder")}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </div>

                        {/* IP + Port */}
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
                                    <option value="tcp">TCP</option>
                                    <option value="udp">UDP</option>
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
                                <Label>{t("syncIntervalMin")}</Label>
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

                    <DialogFooter>
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
                cloudUrl={typeof window !== "undefined" ? window.location.origin : "https://drdf.ailearnersbd.com"}
            />
        </div>
    );
}
