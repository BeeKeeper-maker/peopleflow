"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { useNotificationPreferences, queryKeys } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, Smartphone, Clock, Save } from "lucide-react";

interface NotificationPreferences {
    id: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    pushEnabled: boolean;
    digestMode: string;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    categoryOverrides: Record<string, { inApp?: boolean; email?: boolean; push?: boolean }> | null;
}

const CATEGORIES = [
    { key: "leave", label: "Leave Management", icon: "📅" },
    { key: "payroll", label: "Payroll & Payslips", icon: "💰" },
    { key: "attendance", label: "Attendance", icon: "⏰" },
    { key: "expense", label: "Expense Claims", icon: "🧾" },
    { key: "announcement", label: "Announcements", icon: "📢" },
    { key: "alert", label: "Alerts & Warnings", icon: "⚠️" },
];

export default function NotificationSettingsPage() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const { data: initialPrefs, isLoading: loading } = useNotificationPreferences();
    const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
    const [saving, setSaving] = useState(false);
    const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");

    // Hydrate local form state whenever the cached preferences change (initial
    // load + post-mutation refetch). This keeps the form editable while still
    // leveraging TanStack Query for cache + invalidation.
    useEffect(() => {
        if (initialPrefs) {
            setPrefs(initialPrefs as unknown as NotificationPreferences);
        }
    }, [initialPrefs]);

    useEffect(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            setPushPermission(Notification.permission);
        } else {
            setPushPermission("unsupported");
        }
    }, []);

    const handleSave = async () => {
        if (!prefs) return;
        setSaving(true);
        try {
            const res = await fetch("/api/notifications/preferences", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    inAppEnabled: prefs.inAppEnabled,
                    emailEnabled: prefs.emailEnabled,
                    pushEnabled: prefs.pushEnabled,
                    digestMode: prefs.digestMode,
                    quietHoursStart: prefs.quietHoursStart,
                    quietHoursEnd: prefs.quietHoursEnd,
                    categoryOverrides: prefs.categoryOverrides || {},
                }),
            });
            if (res.ok) {
                addToast({ title: "Preferences saved", type: "success" });
                void queryClient.invalidateQueries({ queryKey: queryKeys.settings.notificationPreferences() });
            }
        } catch {
            addToast({ title: "Error", description: "Failed to save", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const enablePush = async () => {
        if (!("Notification" in window)) {
            addToast({ title: "Push not supported", description: "Your browser doesn't support push notifications", type: "error" });
            return;
        }

        const permission = await Notification.requestPermission();
        setPushPermission(permission);

        if (permission !== "granted") {
            addToast({ title: "Permission denied", description: "Please allow notifications in your browser settings", type: "error" });
            return;
        }

        // Register with service worker
        try {
            // 1. Fetch the VAPID public key from the server. Without this, the
            //    subscription would be tied to no sender identity and the server
            //    would be unable to deliver pushes.
            const vapidRes = await fetch("/api/notifications/push/vapid-key");
            if (!vapidRes.ok) {
                addToast({ title: "Push not configured", description: "Web push is not enabled on the server. Ask an admin to set VAPID keys.", type: "error" });
                return;
            }
            const { publicKey } = (await vapidRes.json()) as { publicKey: string };

            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });

            const subJson = subscription.toJSON();
            const res = await fetch("/api/notifications/push/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(subJson),
            });

            if (res.ok) {
                addToast({ title: "Push enabled", description: "You'll receive push notifications on this device", type: "success" });
                setPrefs({ ...prefs!, pushEnabled: true });
            }
        } catch (err) {
            addToast({ title: "Push setup failed", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
        }
    };

    const disablePush = async () => {
        try {
            await fetch("/api/notifications/push/unsubscribe", { method: "POST" });
            addToast({ title: "Push disabled", type: "success" });
            setPrefs({ ...prefs!, pushEnabled: false });
        } catch {
            addToast({ title: "Error", description: "Failed to disable", type: "error" });
        }
    };

    const toggleCategory = (category: string, channel: "inApp" | "email" | "push") => {
        if (!prefs) return;
        const overrides = prefs.categoryOverrides || {};
        if (!overrides[category]) overrides[category] = {};
        overrides[category][channel] = !overrides[category][channel];
        setPrefs({ ...prefs, categoryOverrides: { ...overrides } });
    };

    if (loading || !prefs) {
        return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                    <Bell className="h-6 w-6" />
                    Notification Preferences
                </h1>
                <p className="text-muted-foreground mt-1">
                    Control how and when you receive notifications.
                </p>
            </div>

            {/* Global Channel Toggles */}
            <Card>
                <CardHeader>
                    <CardTitle>Notification Channels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ChannelToggle
                        icon={<Bell className="h-5 w-5" />}
                        label="In-App Notifications"
                        description="Bell icon in the dashboard"
                        enabled={prefs.inAppEnabled}
                        onToggle={() => setPrefs({ ...prefs, inAppEnabled: !prefs.inAppEnabled })}
                    />
                    <ChannelToggle
                        icon={<Mail className="h-5 w-5" />}
                        label="Email Notifications"
                        description="Receive notifications via email"
                        enabled={prefs.emailEnabled}
                        onToggle={() => setPrefs({ ...prefs, emailEnabled: !prefs.emailEnabled })}
                    />
                    <div className="flex items-center justify-between py-3 border-t border-card-border">
                        <div className="flex items-center gap-3">
                            <Smartphone className="h-5 w-5 text-muted-foreground" />
                            <div>
                                <div className="font-medium">Push Notifications</div>
                                <div className="text-sm text-muted-foreground">
                                    {pushPermission === "unsupported"
                                        ? "Not supported by your browser"
                                        : pushPermission === "granted"
                                          ? "Enabled on this device"
                                          : "Requires browser permission"}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {prefs.pushEnabled ? (
                                <Button variant="outline" size="sm" onClick={disablePush}>
                                    Disable
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    onClick={enablePush}
                                    disabled={pushPermission === "unsupported"}
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    Enable Push
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Digest Mode */}
            <Card>
                <CardHeader>
                    <CardTitle>Email Delivery Mode</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { value: "instant", label: "Instant", desc: "Send each notification immediately" },
                            { value: "daily", label: "Daily Digest", desc: "One summary email per day" },
                            { value: "weekly", label: "Weekly Digest", desc: "One summary email per week" },
                        ].map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setPrefs({ ...prefs, digestMode: option.value })}
                                className={`p-4 rounded-lg border text-left transition-colors ${
                                    prefs.digestMode === option.value
                                        ? "border-blue-500 bg-blue-500/10"
                                        : "border-card-border hover:bg-hover/50"
                                }`}
                            >
                                <div className="font-medium">{option.label}</div>
                                <div className="text-xs text-muted-foreground mt-1">{option.desc}</div>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Quiet Hours */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Quiet Hours
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        No email or push notifications during these hours (Bangladesh time).
                        In-app notifications still appear but won't make a sound.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium block mb-1">Start</label>
                            <input
                                type="time"
                                value={prefs.quietHoursStart || ""}
                                onChange={(e) =>
                                    setPrefs({ ...prefs, quietHoursStart: e.target.value || null })
                                }
                                className="w-full bg-hover border border-card-border rounded-md px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium block mb-1">End</label>
                            <input
                                type="time"
                                value={prefs.quietHoursEnd || ""}
                                onChange={(e) =>
                                    setPrefs({ ...prefs, quietHoursEnd: e.target.value || null })
                                }
                                className="w-full bg-hover border border-card-border rounded-md px-3 py-2"
                            />
                        </div>
                    </div>
                    {(prefs.quietHoursStart || prefs.quietHoursEnd) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2"
                            onClick={() => setPrefs({ ...prefs, quietHoursStart: null, quietHoursEnd: null })}
                        >
                            Clear quiet hours
                        </Button>
                    )}
                </CardContent>
            </Card>

            {/* Per-Category Overrides */}
            <Card>
                <CardHeader>
                    <CardTitle>Per-Category Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Override global settings for specific notification categories.
                    </p>
                    <div className="space-y-2">
                        {CATEGORIES.map((cat) => {
                            const override = prefs.categoryOverrides?.[cat.key] || {};
                            return (
                                <div
                                    key={cat.key}
                                    className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-hover/30"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{cat.icon}</span>
                                        <span className="font-medium text-sm">{cat.label}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <CategoryToggle
                                            label="In-App"
                                            enabled={override.inApp ?? prefs.inAppEnabled}
                                            onToggle={() => toggleCategory(cat.key, "inApp")}
                                        />
                                        <CategoryToggle
                                            label="Email"
                                            enabled={override.email ?? prefs.emailEnabled}
                                            onToggle={() => toggleCategory(cat.key, "email")}
                                        />
                                        <CategoryToggle
                                            label="Push"
                                            enabled={override.push ?? prefs.pushEnabled}
                                            onToggle={() => toggleCategory(cat.key, "push")}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Save */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save Preferences"}
                </Button>
            </div>
        </div>
    );
}

function ChannelToggle({
    icon,
    label,
    description,
    enabled,
    onToggle,
}: {
    icon: React.ReactNode;
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-card-border last:border-0">
            <div className="flex items-center gap-3">
                <div className="text-muted-foreground">{icon}</div>
                <div>
                    <div className="font-medium">{label}</div>
                    <div className="text-sm text-muted-foreground">{description}</div>
                </div>
            </div>
            <button
                onClick={onToggle}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                    enabled ? "bg-blue-600" : "bg-muted"
                }`}
            >
                <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        enabled ? "translate-x-6" : "translate-x-0.5"
                    }`}
                />
            </button>
        </div>
    );
}

function CategoryToggle({
    label,
    enabled,
    onToggle,
}: {
    label: string;
    enabled: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                enabled
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "bg-muted text-muted-foreground border border-transparent"
            }`}
        >
            {label}
        </button>
    );
}

/**
 * Convert a VAPID public key (URL-safe base64) into the Uint8Array form
 * expected by `pushManager.subscribe({ applicationServerKey })`.
 *
 * The VAPID key from the server is a base64url-encoded string. The Push API
 * requires the raw bytes. Padding is added back before atob because browsers
 * strip it from base64url values.
 *
 * The explicit `<ArrayBuffer>` type param (and `new ArrayBuffer(...)`) is
 * needed so the returned view is `Uint8Array<ArrayBuffer>` rather than the
 * default `Uint8Array<ArrayBufferLike>` — PushManager.subscribe's
 * BufferSource parameter rejects the ArrayBufferLike shape because
 * SharedArrayBuffer is not assignable to ArrayBuffer.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    const buffer = new ArrayBuffer(raw.length);
    const output = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; ++i) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}
