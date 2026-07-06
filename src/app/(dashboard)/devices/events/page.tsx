"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, Fingerprint, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DeviceEvent = {
    id: string;
    serialNumber: string | null;
    eventType: string;
    method: string;
    status: string;
    recordsReceived: number;
    recordsSynced: number;
    recordsSkipped: number;
    unmappedUserIds: string[];
    errorMessage: string | null;
    remoteIp: string | null;
    createdAt: string;
    device: {
        id: string;
        name: string;
        location: string | null;
        cloudStatus: string;
        lastSeenAt: string | null;
        branch: { name: string; code: string } | null;
    } | null;
};

export default function DeviceEventsPage() {
    const t = useTranslations("DeviceEvents");
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const [events, setEvents] = useState<DeviceEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState("all");
    const [eventType, setEventType] = useState("all");
    const [search, setSearch] = useState("");

    const formatDateTime = (value: string) => new Intl.DateTimeFormat(dateLocale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: "120", status, eventType });
            if (search.trim()) params.set("serial", search.trim());
            const res = await fetch(`/api/biometric-devices/events?${params.toString()}`);
            if (res.ok) setEvents(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, eventType]);

    const stats = useMemo(() => ({
        total: events.length,
        processed: events.filter((e) => e.status === "processed").length,
        attention: events.filter((e) => ["partial", "failed", "unknown_device"].includes(e.status)).length,
        attendance: events.filter((e) => e.recordsReceived > 0 || e.recordsSynced > 0).length,
    }), [events]);

    const statusIcon = (event: DeviceEvent) => {
        if (event.status === "processed") return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
        if (["failed", "unknown_device"].includes(event.status)) return <XCircle className="h-4 w-4 text-red-400" />;
        if (event.status === "partial") return <AlertTriangle className="h-4 w-4 text-amber-400" />;
        return <Activity className="h-4 w-4 text-cyan-400" />;
    };

    const eventLabel = (event: DeviceEvent) => {
        if (event.status === "processed") return t("attendanceProcessed");
        if (event.status === "partial") return t("needsMapping");
        if (event.status === "unknown_device") return t("unknownDevice");
        if (event.status === "failed") return t("failed");
        if (event.eventType === "getrequest") return t("heartbeat");
        if (event.eventType === "cdata" && event.recordsReceived === 0) return t("operationLog");
        return t("captured");
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="flex items-center gap-3 text-3xl font-bold text-foreground">
                        <Database className="h-8 w-8 text-primary" />
                        {t("title")}
                    </h1>
                    <p className="mt-1 max-w-3xl text-muted-foreground">{t("subtitle")}</p>
                </div>
                <Button onClick={fetchEvents} disabled={loading} className="gap-2 self-start lg:self-auto">
                    <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    {t("refresh")}
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                {[
                    { label: t("totalEvents"), value: stats.total, icon: Activity, tone: "bg-blue-500/10 text-blue-400" },
                    { label: t("attendanceEvents"), value: stats.attendance, icon: Fingerprint, tone: "bg-cyan-500/10 text-cyan-400" },
                    { label: t("processed"), value: stats.processed, icon: ShieldCheck, tone: "bg-emerald-500/10 text-emerald-400" },
                    { label: t("attention"), value: stats.attention, icon: AlertTriangle, tone: "bg-amber-500/10 text-amber-400" },
                ].map((item) => {
                    const Icon = item.icon;
                    return (
                        <Card key={item.label} className="border-card-border bg-card">
                            <CardContent className="flex items-center gap-4 p-4">
                                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", item.tone)}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-2xl font-display font-bold text-foreground">{item.value}</p>
                                    <p className="text-sm text-muted-foreground">{item.label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            <Card className="border-card-border bg-card">
                <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative flex-1 lg:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && fetchEvents()} placeholder={t("searchSerial")} className="pl-9" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {["all", "processed", "partial", "failed", "unknown_device", "captured"].map((value) => (
                            <Button key={value} variant={status === value ? "default" : "outline"} size="sm" onClick={() => setStatus(value)}>
                                {t(`status_${value}`)}
                            </Button>
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {["all", "cdata", "getrequest", "registry"].map((value) => (
                            <Button key={value} variant={eventType === value ? "default" : "outline"} size="sm" onClick={() => setEventType(value)}>
                                {t(`type_${value}`)}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-card-border bg-card">
                <CardHeader>
                    <CardTitle className="text-lg">{t("eventTimeline")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {loading ? (
                        <div className="flex h-40 items-center justify-center text-muted-foreground">{t("loading")}</div>
                    ) : events.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-card-border p-8 text-center text-muted-foreground">{t("noEvents")}</div>
                    ) : events.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-card-border bg-hover p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex min-w-0 gap-3">
                                    <div className="mt-1">{statusIcon(event)}</div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-foreground">{eventLabel(event)}</p>
                                            <Badge variant="outline" className="border-card-border text-xs">{event.method} / {event.eventType}</Badge>
                                            <Badge className="border-0 bg-primary/10 text-primary text-xs">{event.status}</Badge>
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {event.device?.name || t("unknownDeviceName")} · {event.serialNumber || t("noSerial")} {event.device?.branch ? `· ${event.device.branch.name}` : ""}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {event.recordsSynced} {t("synced")} / {event.recordsSkipped} {t("skipped")}
                                            {event.unmappedUserIds.length ? ` · ${t("unmapped")}: ${event.unmappedUserIds.join(", ")}` : ""}
                                        </p>
                                        {event.errorMessage && <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">{event.errorMessage}</p>}
                                    </div>
                                </div>
                                <div className="shrink-0 text-left text-xs text-muted-foreground lg:text-right">
                                    <div className="flex items-center gap-1 lg:justify-end"><Clock className="h-3.5 w-3.5" />{formatDateTime(event.createdAt)}</div>
                                    {event.remoteIp && <div className="mt-1 font-mono">{event.remoteIp}</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
