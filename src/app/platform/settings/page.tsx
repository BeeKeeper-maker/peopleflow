"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
    Settings,
    Shield,
    Mail,
    Plus,
    Loader2,
    CheckCircle2,
    XCircle,
    Lock,
    Clock,
    RefreshCw,
    AlertCircle,
    Server,
    Database,
    Cloud,
    Globe,
    KeyRound,
} from "lucide-react";

interface PlatformAdmin {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    lastLogin: string | null;
    twoFactorEnabled: boolean;
    createdAt: string;
}

export default function PlatformSettingsPage() {
    const t = useTranslations("Platform");
    const [admins, setAdmins] = useState<PlatformAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "platform_admin" as "platform_admin" | "platform_super",
    });
    const [createError, setCreateError] = useState<string | null>(null);

    const fetchAdmins = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/platform/settings/admins", {
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Failed to load admins");
            }
            const data = await res.json();
            setAdmins(data.admins || []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAdmins();
    }, [fetchAdmins]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setCreateError(null);
        try {
            const res = await fetch("/api/platform/settings/admins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(createForm),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to create admin");
            }
            setShowCreateForm(false);
            setCreateForm({ name: "", email: "", password: "", role: "platform_admin" });
            fetchAdmins();
        } catch (e) {
            setCreateError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setCreating(false);
        }
    };

    const formatDate = (iso: string | null) => {
        if (!iso) return t("never");
        return new Date(iso).toLocaleString("en-US", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/20">
                        <Settings className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-foreground">{t("settings")}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {t("settingsSubtitle")}
                        </p>
                    </div>
                </div>
                <button
                    onClick={fetchAdmins}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-hover text-sm text-foreground hover:text-foreground hover:bg-hover transition-colors"
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {t("refresh")}
                </button>
            </div>

            {/* System Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-hover/50 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Server className="w-[18px] h-[18px] text-emerald-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{t("application")}</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("name")}</span>
                            <span className="text-foreground">PeopleFlow HR</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("version")}</span>
                            <span className="text-foreground font-mono">v2.0</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("stack")}</span>
                            <span className="text-foreground">Next.js 16 · Prisma</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("region")}</span>
                            <span className="text-foreground">Asia (Singapore)</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-hover/50 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Database className="w-[18px] h-[18px] text-blue-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{t("dataLayer")}</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("database")}</span>
                            <span className="text-foreground">PostgreSQL + RLS</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("cache")}</span>
                            <span className="text-foreground">Redis + BullMQ</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("pooler")}</span>
                            <span className="text-foreground">PgBouncer</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("backup")}</span>
                            <span className="text-foreground">Daily + S3</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-hover/50 p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                            <Cloud className="w-[18px] h-[18px] text-violet-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{t("integrations")}</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("payments")}</span>
                            <span className="text-foreground">Stripe</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("storage")}</span>
                            <span className="text-foreground">S3 / R2</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("auth")}</span>
                            <span className="text-foreground">Auth.js v5</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{t("sms")}</span>
                            <span className="text-foreground">{t("notConfigured")}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin Accounts Section */}
            <div className="rounded-xl border border-border bg-hover/50 overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-indigo-400" />
                        <h3 className="text-sm font-semibold text-foreground">{t("platformAdminAccounts")}</h3>
                        <span className="text-xs text-muted-foreground">({admins.length})</span>
                    </div>
                    <button
                        onClick={() => setShowCreateForm(!showCreateForm)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors border border-indigo-500/30"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {t("addAdmin")}
                    </button>
                </div>

                {/* Create Form */}
                {showCreateForm && (
                    <form onSubmit={handleCreate} className="px-5 py-4 border-b border-border bg-indigo-500/[0.02]">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <label className="block">
                                <span className="mb-1 block text-xs text-muted-foreground">{t("name")}</span>
                                <input
                                    type="text"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    placeholder="John Doe"
                                    required
                                    minLength={2}
                                    className="w-full h-9 px-3 rounded-lg bg-hover border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs text-muted-foreground">{t("email")}</span>
                                <input
                                    type="email"
                                    value={createForm.email}
                                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                    placeholder="admin@peopleflow.com"
                                    required
                                    className="w-full h-9 px-3 rounded-lg bg-hover border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs text-muted-foreground">{t("passwordMinChars")}</span>
                                <input
                                    type="password"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                    className="w-full h-9 px-3 rounded-lg bg-hover border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/50"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1 block text-xs text-muted-foreground">{t("role")}</span>
                                <select
                                    value={createForm.role}
                                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as "platform_admin" | "platform_super" })}
                                    className="w-full h-9 px-3 rounded-lg bg-hover border border-border text-sm text-foreground focus:outline-none focus:border-indigo-500/50"
                                >
                                    <option value="platform_admin">{t("platformAdminRole")}</option>
                                    <option value="platform_super">{t("superAdminRole")}</option>
                                </select>
                            </label>
                        </div>
                        {createError && (
                            <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                                {createError}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowCreateForm(false)}
                                className="h-9 px-4 rounded-lg text-sm text-muted-foreground hover:text-foreground transition"
                            >
                                {t("cancel")}
                            </button>
                            <button
                                type="submit"
                                disabled={creating}
                                className="h-9 px-4 rounded-lg text-sm font-medium text-foreground bg-indigo-600 hover:bg-indigo-500 transition disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                {t("createAdmin")}
                            </button>
                        </div>
                    </form>
                )}

                {/* Admin List */}
                {error ? (
                    <div className="p-8 text-center">
                        <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                        <p className="text-sm text-red-300 mb-3">{error}</p>
                        <button
                            onClick={fetchAdmins}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors text-sm"
                        >
                            <RefreshCw className="h-4 w-4" />
                            {t("retry")}
                        </button>
                    </div>
                ) : loading ? (
                    <div className="divide-y divide-white/[0.04]">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-4 px-5 py-4">
                                <div className="w-10 h-10 rounded-full bg-hover animate-pulse" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-1/3 rounded bg-hover animate-pulse" />
                                    <div className="h-3 w-1/4 rounded bg-hover animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.04]">
                        {admins.map((admin) => (
                            <div key={admin.id} className="flex items-center gap-4 px-5 py-4 hover:bg-hover/50 transition-colors">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                                    admin.role === "platform_super"
                                        ? "bg-violet-500/15 text-violet-300"
                                        : "bg-indigo-500/15 text-indigo-300"
                                }`}>
                                    {admin.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-sm font-medium text-foreground">{admin.name}</p>
                                        {admin.role === "platform_super" && (
                                            <span className="text-[10px] font-medium text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded">SUPER</span>
                                        )}
                                        {admin.isActive ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                                                <CheckCircle2 className="w-2.5 h-2.5" />
                                                {t("active")}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                                                <XCircle className="w-2.5 h-2.5" />
                                                {t("disabled")}
                                            </span>
                                        )}
                                        {admin.twoFactorEnabled && (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                                                <Lock className="w-2.5 h-2.5" />
                                                {t("twoFA")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                            <Mail className="w-3 h-3" />
                                            {admin.email}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {t("lastLogin")}: {formatDate(admin.lastLogin)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Security Policy Info */}
            <div className="rounded-xl border border-border bg-hover/50 p-5">
                <div className="flex items-center gap-2 mb-4">
                    <KeyRound className="h-4 w-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-foreground">{t("securityPolicy")}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-hover/50">
                        <Globe className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-foreground font-medium">{t("cspHardened")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t("cspHardenedDesc")}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-hover/50">
                        <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-foreground font-medium">{t("aesEncryption")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t("aesEncryptionDesc")}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-hover/50">
                        <Database className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-foreground font-medium">{t("rls")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t("rlsDesc")}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-hover/50">
                        <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-foreground font-medium">{t("auditRetention")}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t("auditRetentionDesc")}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
