"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
    Shield,
    Save,
    Loader2,
    CheckCircle2,
    Smartphone,
    TestTube,
    Zap,
} from "lucide-react";

interface BkashFormState {
    appKey: string;
    appSecret: string;
    username: string;
    password: string;
    sandbox: boolean;
}

const EMPTY_FORM: BkashFormState = {
    appKey: "",
    appSecret: "",
    username: "",
    password: "",
    sandbox: true,
};

interface BkashSettingsResponse {
    configured?: boolean;
    sandbox?: boolean;
    appKey?: string;
    username?: string;
}

export default function BkashSettingsPage() {
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [config, setConfig] = useState<BkashFormState>(EMPTY_FORM);
    const [configured, setConfigured] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch("/api/settings", { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    const bkash = data?.organization?.settings?.bkashConfig as BkashSettingsResponse | undefined;
                    if (bkash && bkash.configured) {
                        setConfigured(true);
                        // Pre-fill non-secret identifiers for orientation.
                        // Secrets are never echoed back by the API.
                        setConfig({
                            appKey: bkash.appKey || "",
                            appSecret: "",
                            username: bkash.username || "",
                            password: "",
                            sandbox: bkash.sandbox ?? true,
                        });
                    }
                }
            } catch {
                // Silent fail — the form just stays empty.
            } finally {
                setLoading(false);
            }
        };
        void fetchConfig();
    }, []);

    const handleSave = async () => {
        if (!config.appKey || !config.appSecret || !config.username || !config.password) {
            addToast({
                title: "All four credential fields are required",
                description: "Re-enter appKey, appSecret, username, and password to save.",
                type: "error",
            });
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bkashConfig: {
                        appKey: config.appKey,
                        appSecret: config.appSecret,
                        username: config.username,
                        password: config.password,
                        sandbox: config.sandbox,
                    },
                }),
            });

            if (res.ok) {
                addToast({ title: "bKash credentials saved", type: "success" });
                setConfigured(true);
                // Clear secret fields so they never linger in DOM state.
                setConfig((prev) => ({ ...prev, appSecret: "", password: "" }));
            } else {
                const err = await res.json().catch(() => ({}));
                addToast({
                    title: "Failed to save credentials",
                    description: typeof err.error === "string" ? err.error : undefined,
                    type: "error",
                });
            }
        } catch {
            addToast({ title: "Network error while saving", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!configured) {
            addToast({
                title: "Save credentials first",
                description: "Test Connection uses the saved credentials, not the form fields.",
                type: "info",
            });
            return;
        }
        setTesting(true);
        try {
            const res = await fetch("/api/settings/bkash/test", { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                addToast({
                    title: "bKash connection verified",
                    description: typeof data.message === "string" ? data.message : undefined,
                    type: "success",
                });
            } else {
                addToast({
                    title: "bKash connection failed",
                    description: typeof data.error === "string" ? data.error : undefined,
                    type: "error",
                });
            }
        } catch {
            addToast({ title: "Network error during test", type: "error" });
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="bKash Disbursement Settings"
                subtitle="Configure bKash API credentials for salary disbursement"
                icon={Smartphone}
                iconColor="primary"
                actions={
                    configured ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Configured
                        </Badge>
                    ) : null
                }
            />

            <Card className="border-card-border bg-card">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Shield className="h-4 w-4 text-pink-400" />
                        API Credentials
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {configured && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                            bKash credentials are already configured. To rotate, re-enter all four
                            fields and click Save — the API rejects partial updates to prevent
                            accidentally wiping the stored secrets.
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>App Key</Label>
                            <Input
                                value={config.appKey}
                                onChange={(e) => setConfig({ ...config, appKey: e.target.value })}
                                placeholder="Enter bKash App Key"
                                className="bg-hover border-card-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>App Secret</Label>
                            <Input
                                type="password"
                                value={config.appSecret}
                                onChange={(e) => setConfig({ ...config, appSecret: e.target.value })}
                                placeholder={configured ? "•••••••• (re-enter to update)" : "Enter bKash App Secret"}
                                className="bg-hover border-card-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Username</Label>
                            <Input
                                value={config.username}
                                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                                placeholder="Enter bKash Username"
                                className="bg-hover border-card-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input
                                type="password"
                                value={config.password}
                                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                                placeholder={configured ? "•••••••• (re-enter to update)" : "Enter bKash Password"}
                                className="bg-hover border-card-border"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <Label>Mode:</Label>
                        <div className="flex gap-2">
                            <Button
                                variant={config.sandbox ? "default" : "outline"}
                                size="sm"
                                onClick={() => setConfig({ ...config, sandbox: true })}
                                className="gap-2"
                            >
                                <TestTube className="h-3.5 w-3.5" />
                                Sandbox
                            </Button>
                            <Button
                                variant={!config.sandbox ? "default" : "outline"}
                                size="sm"
                                onClick={() => setConfig({ ...config, sandbox: false })}
                                className="gap-2"
                            >
                                <Shield className="h-3.5 w-3.5" />
                                Live
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={handleTestConnection}
                            disabled={!configured || testing}
                            className="gap-2 border-card-border"
                        >
                            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            Test Connection
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="gap-2 bg-pink-600 hover:bg-pink-700"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Credentials
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-card-border bg-card">
                <CardHeader>
                    <CardTitle className="text-base">How it works</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>
                        Credentials are encrypted with AES-256-GCM before being stored in your
                        organization&apos;s settings. The disbursement engine decrypts them server-side
                        when calling the bKash API — secrets never reach the browser.
                    </p>
                    <p>
                        On the Payroll page, approved salary slips expose a{" "}
                        <span className="text-foreground font-medium">Disburse via bKash</span> action
                        that calls the bKash B2C API to send the net salary directly to the
                        employee&apos;s bKash wallet.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
