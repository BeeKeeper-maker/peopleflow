"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Building2,
    Bell,
    Shield,
    CreditCard,
    Users,
    Calendar,
    Clock,
    Save,
    Upload,
    Loader2,
    Eye,
    EyeOff,
    Key,
    Code2,
    Plus,
    Copy,
    Trash2,
    Check,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ArrowUpRight,
    TrendingUp,
    Database,
    Zap,
    X,
    Crown,
    Fingerprint,
    KeyRound,
    ArrowRight,
    MapPin,
    Navigation,
    ShieldOff,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OrganizationSettings {
    name: string
    logoUrl: string | null
    industry: string | null
    employeeCountRange: string | null
    fiscalYearStart: number
    timezone: string
    currency: string
    dateFormat: string
    workWeekStart: number
}

interface NotificationSettings {
    emailNotifications: boolean
    leaveApprovals: boolean
    payrollAlerts: boolean
    attendanceReminders: boolean
    systemUpdates: boolean
}

interface BillingData {
    hasSubscription: boolean
    subscription?: {
        id: string; status: string; billingCycle: string
        currentPeriodStart: string; currentPeriodEnd: string
        cancelAtPeriodEnd: boolean; isTrialing: boolean
        trialDaysLeft: number; trialEnd: string | null
    }
    plan?: {
        id: string; name: string; slug: string
        priceMonthly: number; priceYearly: number; currency: string
        features: Record<string, boolean>
    }
    usage?: {
        employees: { current: number; limit: number; unlimited: boolean }
        admins: { current: number; limit: number; unlimited: boolean }
        branches: { current: number; limit: number; unlimited: boolean }
        storage: { current: number; limit: number; unlimited: boolean }
    }
    invoices?: Array<{
        id: string; invoiceNumber: string; status: string
        amount: number; currency: string; periodStart: string
        periodEnd: string; paidAt: string | null; dueDate: string
    }>
}

interface ApiKeyData {
    id: string; name: string; keyPrefix: string
    permissions: string[]; expiresAt: string | null
    lastUsedAt: string | null; createdAt: string
}

// ─── Settings Page ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
    const t = useTranslations('Settings')
    const { data: session } = useSession()
    const { addToast } = useToast()
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState("organization")
    const [passwordModalOpen, setPasswordModalOpen] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [uploadingLogo, setUploadingLogo] = useState(false)
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    })

    const [orgSettings, setOrgSettings] = useState<OrganizationSettings>({
        name: "",
        logoUrl: null,
        industry: null,
        employeeCountRange: null,
        fiscalYearStart: 1,
        timezone: "Asia/Dhaka",
        currency: "BDT",
        dateFormat: "DD/MM/YYYY",
        workWeekStart: 0,
    })

    const [notifications, setNotifications] = useState<NotificationSettings>({
        emailNotifications: true,
        leaveApprovals: true,
        payrollAlerts: true,
        attendanceReminders: true,
        systemUpdates: false,
    })

    // Billing state
    const [billing, setBilling] = useState<BillingData | null>(null)
    const [billingLoading, setBillingLoading] = useState(false)

    // API Keys state
    const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([])
    const [keysLoading, setKeysLoading] = useState(false)
    const [newKeyModal, setNewKeyModal] = useState(false)
    const [newKeyName, setNewKeyName] = useState("")
    const [newKeyType, setNewKeyType] = useState("read_only")
    const [creatingKey, setCreatingKey] = useState(false)
    const [newSecretKey, setNewSecretKey] = useState<string | null>(null)
    const [copiedKey, setCopiedKey] = useState(false)

    // Geo-fence state
    const [geoConfig, setGeoConfig] = useState({ geoFenceEnabled: false, geoFenceEnforcement: "soft" })
    const [geoBranches, setGeoBranches] = useState<Array<{ id: string; name: string; latitude: number | null; longitude: number | null; geoFenceRadius: number; _count: { employees: number } }>>([])
    const [savingGeo, setSavingGeo] = useState(false)
    const [geoLoaded, setGeoLoaded] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    // Lazy-load billing and keys data when tabs are selected
    useEffect(() => {
        if (activeTab === "billing" && !billing) fetchBilling()
        if (activeTab === "api-keys" && apiKeys.length === 0) fetchApiKeys()
        if (activeTab === "attendance" && !geoLoaded) fetchGeoFenceSettings()
    }, [activeTab])

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings")
            if (res.ok) {
                const data = await res.json()
                if (data.organization) {
                    setOrgSettings(prev => ({ ...prev, ...data.organization }))
                }
            }
        } catch (error) {
            console.error("Failed to fetch settings:", error)
        }
    }

    const fetchBilling = async () => {
        setBillingLoading(true)
        try {
            const res = await fetch("/api/billing/status")
            if (res.ok) {
                const data = await res.json()
                setBilling(data)
            }
        } catch (error) {
            console.error("Failed to fetch billing:", error)
        } finally {
            setBillingLoading(false)
        }
    }

    const fetchApiKeys = useCallback(async () => {
        setKeysLoading(true)
        try {
            const res = await fetch("/api/v1/keys")
            if (res.ok) {
                const data = await res.json()
                setApiKeys(data.keys || [])
            }
        } catch (error) {
            console.error("Failed to fetch API keys:", error)
        } finally {
            setKeysLoading(false)
        }
    }, [])

    const fetchGeoFenceSettings = async () => {
        try {
            const res = await fetch("/api/settings/geo-fence")
            if (res.ok) {
                const data = await res.json()
                setGeoConfig({
                    geoFenceEnabled: data.geoFenceEnabled || false,
                    geoFenceEnforcement: data.geoFenceEnforcement || "soft",
                })
                setGeoBranches(data.branches || [])
                setGeoLoaded(true)
            }
        } catch (error) {
            console.error("Failed to fetch geo-fence settings:", error)
        }
    }

    const handleToggleGeoFence = async () => {
        setSavingGeo(true)
        try {
            const res = await fetch("/api/settings/geo-fence", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    geoFenceEnabled: !geoConfig.geoFenceEnabled,
                    geoFenceEnforcement: geoConfig.geoFenceEnforcement,
                }),
            })
            if (res.ok) {
                setGeoConfig(prev => ({ ...prev, geoFenceEnabled: !prev.geoFenceEnabled }))
                addToast({ title: !geoConfig.geoFenceEnabled ? "GPS Attendance চালু হয়েছে" : "GPS Attendance বন্ধ করা হয়েছে", type: "success" })
            }
        } catch {
            addToast({ title: "সেটিংস আপডেট ব্যর্থ", type: "error" })
        } finally {
            setSavingGeo(false)
        }
    }

    const handleGeoEnforcementChange = async (mode: string) => {
        setSavingGeo(true)
        try {
            const res = await fetch("/api/settings/geo-fence", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    geoFenceEnabled: geoConfig.geoFenceEnabled,
                    geoFenceEnforcement: mode,
                }),
            })
            if (res.ok) {
                setGeoConfig(prev => ({ ...prev, geoFenceEnforcement: mode }))
                addToast({ title: `মোড পরিবর্তন: ${mode === "strict" ? "Strict" : "Soft"}`, type: "success" })
            }
        } catch {
            addToast({ title: "সেটিংস আপডেট ব্যর্থ", type: "error" })
        } finally {
            setSavingGeo(false)
        }
    }

    const handleCreateKey = async () => {
        if (!newKeyName.trim()) return
        setCreatingKey(true)
        try {
            const res = await fetch("/api/v1/keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newKeyName, type: newKeyType }),
            })
            if (res.ok) {
                const data = await res.json()
                setNewSecretKey(data.secretKey)
                await fetchApiKeys()
                addToast({ title: "API key created successfully", type: "success" })
            } else {
                const data = await res.json()
                addToast({ title: data.error || "Failed to create key", type: "error" })
            }
        } catch {
            addToast({ title: "Failed to create key", type: "error" })
        } finally {
            setCreatingKey(false)
        }
    }

    const handleRevokeKey = async (keyId: string) => {
        try {
            const res = await fetch("/api/v1/keys", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keyId }),
            })
            if (res.ok) {
                await fetchApiKeys()
                addToast({ title: "Key revoked", type: "success" })
            }
        } catch {
            addToast({ title: "Failed to revoke key", type: "error" })
        }
    }

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text)
        setCopiedKey(true)
        setTimeout(() => setCopiedKey(false), 2000)
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            addToast({ title: t('toastSelectImage'), type: 'error' }); return
        }
        if (file.size > 2 * 1024 * 1024) {
            addToast({ title: t('toastImageSize'), type: 'error' }); return
        }
        setUploadingLogo(true)
        try {
            const reader = new FileReader()
            reader.onload = async (event) => {
                const base64 = event.target?.result as string
                const res = await fetch("/api/settings", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ logoUrl: base64 }),
                })
                if (res.ok) {
                    setOrgSettings(prev => ({ ...prev, logoUrl: base64 }))
                    addToast({ title: t('toastLogoSuccess'), type: 'success' })
                } else {
                    addToast({ title: t('toastLogoFail'), type: 'error' })
                }
                setUploadingLogo(false)
            }
            reader.onerror = () => {
                addToast({ title: t('toastReadFail'), type: 'error' })
                setUploadingLogo(false)
            }
            reader.readAsDataURL(file)
        } catch {
            addToast({ title: t('toastLogoFail'), type: 'error' })
            setUploadingLogo(false)
        }
    }

    const handleSaveOrg = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: orgSettings.name,
                    industry: orgSettings.industry,
                    fiscalYearStart: orgSettings.fiscalYearStart,
                    timezone: orgSettings.timezone,
                }),
            })
            if (res.ok) addToast({ title: t('toastSettingsSaved'), type: 'success' })
            else addToast({ title: t('toastSettingsFail'), type: 'error' })
        } catch {
            addToast({ title: t('toastSettingsFail'), type: 'error' })
        } finally { setSaving(false) }
    }

    const handleSaveNotifications = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/settings/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(notifications),
            })
            if (res.ok) addToast({ title: t('toastNotifSaved'), type: 'success' })
            else addToast({ title: t('toastNotifFail'), type: 'error' })
        } catch {
            addToast({ title: t('toastNotifFail'), type: 'error' })
        } finally { setSaving(false) }
    }

    const handleChangePassword = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            addToast({ title: t('toastPasswordMismatch'), type: 'error' }); return
        }
        if (passwordForm.newPassword.length < 8) {
            addToast({ title: t('toastPasswordMin'), type: 'error' }); return
        }
        setChangingPassword(true)
        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword,
                }),
            })
            if (res.ok) {
                addToast({ title: t('toastPasswordChanged'), type: 'success' })
                setPasswordModalOpen(false)
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
            } else {
                const data = await res.json()
                addToast({ title: data.error || t('toastPasswordFail'), type: 'error' })
            }
        } catch {
            addToast({ title: t('toastPasswordFail'), type: 'error' })
        } finally { setChangingPassword(false) }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    const formatCurrency = (amount: number, currency = "BDT") => {
        return new Intl.NumberFormat("en-BD", {
            style: "currency", currency, minimumFractionDigits: 0
        }).format(amount / 100)
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric"
        })
    }

    const getUsagePercent = (current: number, limit: number, unlimited: boolean) => {
        if (unlimited) return 10
        if (limit === 0) return 100
        return Math.min(100, Math.round((current / limit) * 100))
    }

    const getUsageColor = (pct: number) => {
        if (pct >= 90) return "bg-red-500"
        if (pct >= 75) return "bg-amber-500"
        return "bg-blue-500"
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
            trialing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
            past_due: "bg-amber-500/15 text-amber-400 border-amber-500/30",
            canceled: "bg-red-500/15 text-red-400 border-red-500/30",
            paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
            pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        }
        return styles[status] || "bg-muted text-muted-foreground border-border"
    }

    // ─── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
                <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-hover border border-card-border p-1">
                    <TabsTrigger value="organization" className="gap-2">
                        <Building2 className="h-4 w-4" />
                        {t('tabOrganization')}
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="gap-2">
                        <Bell className="h-4 w-4" />
                        {t('tabNotifications')}
                    </TabsTrigger>
                    <TabsTrigger value="security" className="gap-2">
                        <Shield className="h-4 w-4" />
                        {t('tabSecurity')}
                    </TabsTrigger>
                    <TabsTrigger value="billing" className="gap-2">
                        <CreditCard className="h-4 w-4" />
                        {t('tabBilling')}
                    </TabsTrigger>
                    <TabsTrigger value="api-keys" className="gap-2" id="settings-tab-api-keys">
                        <Code2 className="h-4 w-4" />
                        {t('tabApiKeys')}
                    </TabsTrigger>
                    <TabsTrigger value="attendance" className="gap-2">
                        <MapPin className="h-4 w-4" />
                        Attendance
                    </TabsTrigger>
                    <TabsTrigger value="delegations" className="gap-2">
                        <KeyRound className="h-4 w-4" />
                        {t('tabDelegations')}
                    </TabsTrigger>
                </TabsList>

                {/* ════════════════ Organization Tab ════════════════ */}
                <TabsContent value="organization" className="space-y-6">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('companyProfile')}</CardTitle>
                            <CardDescription className="text-muted-foreground">{t('companyProfileDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-6">
                                <Avatar className="h-20 w-20 rounded-xl border-2 border-card-border">
                                    {orgSettings.logoUrl ? (
                                        <AvatarImage src={orgSettings.logoUrl} />
                                    ) : (
                                        <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 rounded-xl text-2xl text-foreground">
                                            {orgSettings.name?.charAt(0) || "O"}
                                        </AvatarFallback>
                                    )}
                                </Avatar>
                                <div className="space-y-2">
                                    <input type="file" id="logo-upload" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleLogoUpload} />
                                    <Button variant="outline" className="gap-2" disabled={uploadingLogo} onClick={() => document.getElementById("logo-upload")?.click()}>
                                        {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                        {uploadingLogo ? t('uploading') : t('uploadLogo')}
                                    </Button>
                                    <p className="text-xs text-tertiary-foreground">{t('logoHint')}</p>
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('companyName')}</Label>
                                    <Input value={orgSettings.name} onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })} placeholder={t('companyNamePlaceholder')} className="bg-hover border-card-border" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('industry')}</Label>
                                    <Input value={orgSettings.industry || ""} onChange={(e) => setOrgSettings({ ...orgSettings, industry: e.target.value })} placeholder={t('industryPlaceholder')} className="bg-hover border-card-border" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('regionalSettings')}</CardTitle>
                            <CardDescription className="text-muted-foreground">{t('regionalSettingsDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('timezone')}</Label>
                                    <Input value={orgSettings.timezone} onChange={(e) => setOrgSettings({ ...orgSettings, timezone: e.target.value })} className="bg-hover border-card-border" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('currency')}</Label>
                                    <Input value={orgSettings.currency} onChange={(e) => setOrgSettings({ ...orgSettings, currency: e.target.value })} className="bg-hover border-card-border" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('dateFormat')}</Label>
                                    <Input value={orgSettings.dateFormat} onChange={(e) => setOrgSettings({ ...orgSettings, dateFormat: e.target.value })} className="bg-hover border-card-border" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('fiscalYearStart')}</Label>
                                    <Input type="number" min={1} max={12} value={orgSettings.fiscalYearStart} onChange={(e) => setOrgSettings({ ...orgSettings, fiscalYearStart: parseInt(e.target.value) })} className="bg-hover border-card-border" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button onClick={handleSaveOrg} disabled={saving} className="gap-2 bg-linear-to-r from-blue-500 to-indigo-600">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {t('saveChanges')}
                        </Button>
                    </div>
                </TabsContent>

                {/* ════════════════ Notifications Tab ════════════════ */}
                <TabsContent value="notifications" className="space-y-6">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('emailNotifications')}</CardTitle>
                            <CardDescription className="text-muted-foreground">{t('configureNotificationsDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                {([
                                    { key: "emailNotifications", label: t('emailNotifications'), desc: t('emailNotificationsDesc') },
                                    { key: "leaveApprovals", label: t('leaveApprovals'), desc: t('leaveApprovalsDesc') },
                                    { key: "payrollAlerts", label: t('payrollAlerts'), desc: t('payrollAlertsDesc') },
                                    { key: "attendanceReminders", label: t('attendanceReminders'), desc: t('attendanceRemindersDesc') },
                                    { key: "systemUpdates", label: t('systemUpdates'), desc: t('systemUpdatesDesc') },
                                ] as const).map(item => (
                                    <div key={item.key} className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                        <div className="space-y-0.5">
                                            <Label className="text-foreground">{item.label}</Label>
                                            <p className="text-sm text-tertiary-foreground">{item.desc}</p>
                                        </div>
                                        <Switch
                                            checked={notifications[item.key]}
                                            onCheckedChange={(checked) => setNotifications({ ...notifications, [item.key]: checked })}
                                        />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex justify-end">
                        <Button onClick={handleSaveNotifications} disabled={saving} className="gap-2 bg-linear-to-r from-blue-500 to-indigo-600">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {t('savePreferences')}
                        </Button>
                    </div>
                </TabsContent>

                {/* ════════════════ Security Tab ════════════════ */}
                <TabsContent value="security" className="space-y-6">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('securitySettings')}</CardTitle>
                            <CardDescription className="text-muted-foreground">{t('securitySettingsDesc')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('twoFactorAuth')}</Label>
                                        <p className="text-sm text-tertiary-foreground">{t('twoFactorAuthDesc')}</p>
                                    </div>
                                    <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">{t('comingSoon')}</Badge>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('sessionManagement')}</Label>
                                        <p className="text-sm text-tertiary-foreground">{t('sessionManagementDesc')}</p>
                                    </div>
                                    <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">{t('comingSoon')}</Badge>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('changePassword')}</Label>
                                        <p className="text-sm text-tertiary-foreground">{t('changePasswordDesc')}</p>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => setPasswordModalOpen(true)}>{t('update')}</Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ════════════════ Billing Tab (DATA-DRIVEN) ════════════════ */}
                <TabsContent value="billing" className="space-y-6">
                    {billingLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                        </div>
                    ) : billing?.hasSubscription ? (
                        <>
                            {/* Current Plan Card */}
                            <Card className="bg-card border-card-border overflow-hidden">
                                <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                                <Crown className="h-5 w-5 text-white" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-foreground flex items-center gap-2">
                                                    {billing.plan?.name} {t('billingPlan')}
                                                    <Badge variant="outline" className={getStatusBadge(billing.subscription?.status || "")}>
                                                        {billing.subscription?.status}
                                                    </Badge>
                                                </CardTitle>
                                                <CardDescription className="text-muted-foreground">
                                                    {formatCurrency(
                                                        billing.subscription?.billingCycle === "yearly"
                                                            ? billing.plan?.priceYearly || 0
                                                            : billing.plan?.priceMonthly || 0,
                                                        billing.plan?.currency
                                                    )} / {billing.subscription?.billingCycle === "yearly" ? t('billingPerYear') : t('billingPerMonth')}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <Button variant="outline" className="gap-2">
                                            <ArrowUpRight className="h-4 w-4" />
                                            {t('billingUpgradePlan')}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-3 md:grid-cols-3">
                                        <div className="rounded-lg border border-card-border bg-hover p-4">
                                            <p className="text-xs text-tertiary-foreground mb-1">{t('billingCycle')}</p>
                                            <p className="text-sm font-semibold text-foreground capitalize">{billing.subscription?.billingCycle}</p>
                                        </div>
                                        <div className="rounded-lg border border-card-border bg-hover p-4">
                                            <p className="text-xs text-tertiary-foreground mb-1">{t('billingCurrentPeriod')}</p>
                                            <p className="text-sm font-semibold text-foreground">
                                                {billing.subscription?.currentPeriodStart ? formatDate(billing.subscription.currentPeriodStart) : "—"} — {billing.subscription?.currentPeriodEnd ? formatDate(billing.subscription.currentPeriodEnd) : "—"}
                                            </p>
                                        </div>
                                        <div className="rounded-lg border border-card-border bg-hover p-4">
                                            <p className="text-xs text-tertiary-foreground mb-1">{t('billingAutoRenew')}</p>
                                            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                                {billing.subscription?.cancelAtPeriodEnd ? <><XCircle className="h-4 w-4 text-red-400" />{t('billingCancelsAtEnd')}</> : <><CheckCircle2 className="h-4 w-4 text-emerald-400" />{t('billingAutoRenewActive')}</>}
                                            </p>
                                        </div>
                                    </div>

                                    {billing.subscription?.isTrialing && (
                                        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3">
                                            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
                                            <p className="text-sm text-amber-400">
                                                {t('billingTrialWarning', { days: billing.subscription.trialDaysLeft })}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Usage Meters */}
                            <Card className="bg-card border-card-border">
                                <CardHeader>
                                    <CardTitle className="text-foreground flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-blue-400" />
                                        {t('billingResourceUsage')}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">{t('billingResourceUsageDesc')}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {billing.usage && ([
                                            { key: "employees", icon: Users, label: t('billingEmployees'), data: billing.usage.employees },
                                            { key: "admins", icon: Shield, label: t('billingAdmins'), data: billing.usage.admins },
                                            { key: "branches", icon: Building2, label: t('billingBranches'), data: billing.usage.branches },
                                            { key: "storage", icon: Database, label: t('billingStorage'), data: billing.usage.storage },
                                        ] as const).map(item => {
                                            const pct = getUsagePercent(item.data.current, item.data.limit, item.data.unlimited)
                                            return (
                                                <div key={item.key} className="rounded-lg border border-card-border bg-hover p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <item.icon className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm font-medium text-foreground">{item.label}</span>
                                                        </div>
                                                        <span className="text-xs font-mono text-muted-foreground">
                                                            {item.data.current} / {item.data.unlimited ? "∞" : item.data.limit}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-card overflow-hidden">
                                                        <div className={`h-full rounded-full transition-all ${getUsageColor(pct)}`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    {pct >= 90 && !item.data.unlimited && (
                                                        <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" /> {t('billingApproachingLimit')}
                                                        </p>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Plan Features */}
                            <Card className="bg-card border-card-border">
                                <CardHeader>
                                    <CardTitle className="text-foreground flex items-center gap-2">
                                        <Zap className="h-5 w-5 text-purple-400" />
                                        {t('billingEnabledFeatures')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                                        {billing.plan?.features && Object.entries(billing.plan.features).map(([feature, enabled]) => (
                                            <div key={feature} className="flex items-center gap-2 rounded-lg border border-card-border bg-hover px-3 py-2">
                                                {enabled ? (
                                                    <Check className="h-4 w-4 text-emerald-400" />
                                                ) : (
                                                    <AlertCircle className="h-4 w-4 text-muted-foreground/40" />
                                                )}
                                                <span className={`text-sm capitalize ${enabled ? "text-foreground" : "text-muted-foreground/50 line-through"}`}>
                                                    {feature.replace(/([A-Z])/g, ' $1').trim()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Invoice History */}
                            {billing.invoices && billing.invoices.length > 0 && (
                                <Card className="bg-card border-card-border">
                                    <CardHeader>
                                        <CardTitle className="text-foreground">{t('billingInvoiceHistory')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="rounded-lg border border-card-border overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="bg-hover border-b border-card-border">
                                                        <th className="text-left p-3 text-muted-foreground font-medium">{t('billingInvoice')}</th>
                                                        <th className="text-left p-3 text-muted-foreground font-medium">{t('billingPeriod')}</th>
                                                        <th className="text-left p-3 text-muted-foreground font-medium">{t('billingAmount')}</th>
                                                        <th className="text-left p-3 text-muted-foreground font-medium">{t('billingStatus')}</th>
                                                        <th className="text-left p-3 text-muted-foreground font-medium">{t('billingDueDate')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {billing.invoices.map((inv) => (
                                                        <tr key={inv.id} className="border-b border-card-border/50 hover:bg-hover/50 transition-colors">
                                                            <td className="p-3 text-foreground font-mono text-xs">{inv.invoiceNumber}</td>
                                                            <td className="p-3 text-muted-foreground">{formatDate(inv.periodStart)} — {formatDate(inv.periodEnd)}</td>
                                                            <td className="p-3 text-foreground font-medium">{formatCurrency(inv.amount, inv.currency)}</td>
                                                            <td className="p-3">
                                                                <Badge variant="outline" className={getStatusBadge(inv.status)}>{inv.status}</Badge>
                                                            </td>
                                                            <td className="p-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </>
                    ) : (
                        <Card className="bg-card border-card-border">
                            <CardContent className="py-12 text-center">
                                <CreditCard className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-foreground mb-2">{t('billingNoSubscription')}</h3>
                                <p className="text-muted-foreground mb-6">{t('billingNoSubscriptionDesc')}</p>
                                <Button className="bg-linear-to-r from-blue-500 to-indigo-600 gap-2">
                                    <ArrowUpRight className="h-4 w-4" /> {t('billingViewPlans')}
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ════════════════ API Keys Tab ════════════════ */}
                <TabsContent value="api-keys" className="space-y-6">
                    {/* Secret Key Reveal Banner */}
                    {newSecretKey && (
                        <Card className="bg-card border-emerald-500/30">
                            <CardContent className="py-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-emerald-400 mb-2">
                                            {t('apiKeysSecretWarning')}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 bg-hover rounded-lg px-3 py-2 text-xs font-mono text-foreground break-all border border-card-border">
                                                {newSecretKey}
                                            </code>
                                            <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => copyToClipboard(newSecretKey)}>
                                                {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                                {copiedKey ? t('apiKeysCopied') : t('apiKeysCopy')}
                                            </Button>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setNewSecretKey(null)} className="text-muted-foreground">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-foreground flex items-center gap-2">
                                        <Key className="h-5 w-5 text-blue-400" />
                                        {t('apiKeysTitle')}
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground">
                                        {t('apiKeysDesc')}
                                    </CardDescription>
                                </div>
                                <Button
                                    className="gap-2 bg-linear-to-r from-blue-500 to-indigo-600"
                                    onClick={() => { setNewKeyModal(true); setNewKeyName(""); setNewKeyType("read_only"); }}
                                >
                                    <Plus className="h-4 w-4" /> {t('apiKeysCreate')}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {keysLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                                </div>
                            ) : apiKeys.length === 0 ? (
                                <div className="text-center py-12">
                                    <Code2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-muted-foreground">{t('apiKeysEmpty')}</p>
                                    <p className="text-xs text-tertiary-foreground mt-1">{t('apiKeysEmptyDesc')}</p>
                                </div>
                            ) : (
                                <div className="rounded-lg border border-card-border overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-hover border-b border-card-border">
                                                <th className="text-left p-3 text-muted-foreground font-medium">{t('apiKeysName')}</th>
                                                <th className="text-left p-3 text-muted-foreground font-medium">{t('apiKeysPrefix')}</th>
                                                <th className="text-left p-3 text-muted-foreground font-medium">{t('apiKeysPermissions')}</th>
                                                <th className="text-left p-3 text-muted-foreground font-medium">{t('apiKeysLastUsed')}</th>
                                                <th className="text-left p-3 text-muted-foreground font-medium">{t('apiKeysCreated')}</th>
                                                <th className="text-right p-3 text-muted-foreground font-medium">{t('apiKeysActions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {apiKeys.map((key) => (
                                                <tr key={key.id} className="border-b border-card-border/50 hover:bg-hover/50 transition-colors">
                                                    <td className="p-3 text-foreground font-medium">{key.name}</td>
                                                    <td className="p-3 font-mono text-xs text-muted-foreground">{key.keyPrefix}</td>
                                                    <td className="p-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {key.permissions.slice(0, 2).map((p) => (
                                                                <Badge key={p} variant="outline" className="text-xs text-blue-400 border-blue-500/30">{p}</Badge>
                                                            ))}
                                                            {key.permissions.length > 2 && (
                                                                <Badge variant="outline" className="text-xs">+{key.permissions.length - 2}</Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-muted-foreground text-xs">
                                                        {key.lastUsedAt ? formatDate(key.lastUsedAt) : t('apiKeysNever')}
                                                    </td>
                                                    <td className="p-3 text-muted-foreground text-xs">{formatDate(key.createdAt)}</td>
                                                    <td className="p-3 text-right">
                                                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleRevokeKey(key.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Reference */}
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground text-sm">{t('apiKeysQuickRef')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg bg-hover border border-card-border p-4">
                                <pre className="text-xs text-muted-foreground font-mono overflow-x-auto whitespace-pre">{`# Authenticate with your API key
curl -H "Authorization: Bearer YOUR_API_KEY" \\
  https://api.peopleflow.app/v1/employees`}</pre>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ════════════════ Attendance / GPS Tab ════════════════ */}
                <TabsContent value="attendance" className="space-y-6">
                    {/* GPS Toggle Card */}
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                {geoConfig.geoFenceEnabled ? <Shield className="h-5 w-5 text-emerald-400" /> : <ShieldOff className="h-5 w-5 text-zinc-400" />}
                                GPS Attendance Verification
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                কর্মীদের অফিসে উপস্থিত থেকে check-in করতে বাধ্য করুন। GPS দিয়ে তাদের location verify করা হবে।
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Enable/Disable Toggle */}
                            <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                <div className="space-y-0.5">
                                    <Label className="text-foreground">GPS Geo-Fence চালু/বন্ধ</Label>
                                    <p className="text-sm text-tertiary-foreground">
                                        {geoConfig.geoFenceEnabled
                                            ? "চালু আছে — কর্মীদের check-in location verify হবে"
                                            : "বন্ধ আছে — কর্মীরা যেকোনো জায়গা থেকে check-in করতে পারবে"
                                        }
                                    </p>
                                </div>
                                <Switch
                                    checked={geoConfig.geoFenceEnabled}
                                    onCheckedChange={handleToggleGeoFence}
                                    disabled={savingGeo}
                                />
                            </div>

                            {/* Enforcement Mode */}
                            {geoConfig.geoFenceEnabled && (
                                <div className="space-y-3">
                                    <Label className="text-foreground">Enforcement Mode</Label>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label
                                            className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                                                geoConfig.geoFenceEnforcement === "soft"
                                                    ? "border-amber-500/50 bg-amber-500/5"
                                                    : "border-card-border bg-hover hover:bg-hover/80"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="enforcement"
                                                value="soft"
                                                checked={geoConfig.geoFenceEnforcement === "soft"}
                                                onChange={() => handleGeoEnforcementChange("soft")}
                                                className="accent-amber-500 mt-1"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-foreground">⚡ Soft Mode</p>
                                                <p className="text-xs text-tertiary-foreground mt-0.5">
                                                    অফিসের বাইরে থেকেও check-in করতে পারবে, কিন্তু warning দিবে এবং record রাখবে।
                                                </p>
                                            </div>
                                        </label>
                                        <label
                                            className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                                                geoConfig.geoFenceEnforcement === "strict"
                                                    ? "border-red-500/50 bg-red-500/5"
                                                    : "border-card-border bg-hover hover:bg-hover/80"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="enforcement"
                                                value="strict"
                                                checked={geoConfig.geoFenceEnforcement === "strict"}
                                                onChange={() => handleGeoEnforcementChange("strict")}
                                                className="accent-red-500 mt-1"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-foreground">🔒 Strict Mode</p>
                                                <p className="text-xs text-tertiary-foreground mt-0.5">
                                                    অফিসের বাইরে থেকে check-in করতে পারবে না — সম্পূর্ণ block করবে।
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Branch GPS Status */}
                    {geoConfig.geoFenceEnabled && (
                        <Card className="bg-card border-card-border">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <Navigation className="h-5 w-5 text-blue-400" />
                                    Branch GPS Status
                                </CardTitle>
                                <CardDescription className="text-muted-foreground">
                                    প্রতিটি ব্রাঞ্চের GPS location সেটআপ করুন। Organization → Branches-এ গিয়ে "📍 আমার অবস্থান ব্যবহার করুন" বাটন চাপুন।
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {geoBranches.map(branch => (
                                        <div key={branch.id} className="flex items-center justify-between rounded-lg border border-card-border bg-hover px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                                    branch.latitude && branch.longitude
                                                        ? "bg-emerald-500/10"
                                                        : "bg-amber-500/10"
                                                }`}>
                                                    <MapPin className={`h-4 w-4 ${
                                                        branch.latitude && branch.longitude
                                                            ? "text-emerald-400"
                                                            : "text-amber-400"
                                                    }`} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{branch.name}</p>
                                                    <p className="text-xs text-muted-foreground">{branch._count.employees} employees</p>
                                                </div>
                                            </div>
                                            <div>
                                                {branch.latitude && branch.longitude ? (
                                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
                                                        ✅ GPS সেট করা হয়েছে ({branch.geoFenceRadius}m)
                                                    </Badge>
                                                ) : (
                                                    <Link href="/organization/branches">
                                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs cursor-pointer hover:bg-amber-500/20">
                                                            ⚠️ সেটআপ করুন →
                                                        </Badge>
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {geoBranches.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                            <p className="text-sm">কোনো branch পাওয়া যায়নি</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ════════════════ Delegations Tab ════════════════ */}
                <TabsContent value="delegations" className="space-y-6">
                    <Link href="/settings/delegations" className="block group">
                        <Card className="relative overflow-hidden border-indigo-500/15 hover:border-indigo-500/30 transition-all cursor-pointer bg-card">
                            <div className="absolute inset-0 bg-linear-to-br from-indigo-500/5 via-transparent to-violet-500/5" />
                            <CardContent className="relative py-10">
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Fingerprint className="w-8 h-8 text-indigo-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-foreground">{t('delegationsTitle')}</h3>
                                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                                        {t('delegationsDesc')}
                                    </p>
                                    <div className="flex items-center gap-2 mt-4 text-indigo-400 text-sm font-medium">
                                        {t('openDelegations')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                </TabsContent>
            </Tabs>

            {/* ════════════════ Password Change Modal ════════════════ */}
            <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
                <DialogContent className="bg-card border-card-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground flex items-center gap-2">
                            <Key className="h-5 w-5 text-blue-400" />
                            {t('changePassword')}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">{t('passwordDialogDesc')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">{t('currentPassword')}</Label>
                            <div className="relative">
                                <Input type={showCurrentPassword ? "text" : "password"} value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} placeholder={t('currentPasswordPlaceholder')} className="bg-hover border-card-border pr-10" />
                                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 text-tertiary-foreground hover:text-foreground" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">{t('newPassword')}</Label>
                            <div className="relative">
                                <Input type={showNewPassword ? "text" : "password"} value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder={t('newPasswordPlaceholder')} className="bg-hover border-card-border pr-10" />
                                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 text-tertiary-foreground hover:text-foreground" onClick={() => setShowNewPassword(!showNewPassword)}>
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-tertiary-foreground">{t('minChars')}</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">{t('confirmNewPassword')}</Label>
                            <Input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} placeholder={t('confirmPasswordPlaceholder')} className="bg-hover border-card-border" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordModalOpen(false)} disabled={changingPassword}>{t('cancel')}</Button>
                        <Button onClick={handleChangePassword} disabled={changingPassword || !passwordForm.currentPassword || !passwordForm.newPassword} className="bg-linear-to-r from-blue-500 to-indigo-600">
                            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t('changePassword')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ════════════════ Create API Key Modal ════════════════ */}
            <Dialog open={newKeyModal} onOpenChange={(open) => { setNewKeyModal(open); if (!open) setNewSecretKey(null); }}>
                <DialogContent className="bg-card border-card-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground flex items-center gap-2">
                            <Key className="h-5 w-5 text-blue-400" />
                            {t('apiKeysCreateTitle')}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {t('apiKeysCreateDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">{t('apiKeysKeyName')}</Label>
                            <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder={t('apiKeysKeyNamePlaceholder')} className="bg-hover border-card-border" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">{t('apiKeysAccessType')}</Label>
                            <div className="grid gap-2">
                                {([
                                    { value: "read_only", label: t('apiKeysReadOnly'), desc: t('apiKeysReadOnlyDesc') },
                                    { value: "full", label: t('apiKeysFullAccess'), desc: t('apiKeysFullAccessDesc') },
                                    { value: "webhook", label: t('apiKeysWebhook'), desc: t('apiKeysWebhookDesc') },
                                ]).map(opt => (
                                    <label key={opt.value} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${newKeyType === opt.value ? "border-blue-500/50 bg-blue-500/5" : "border-card-border bg-hover hover:bg-hover/80"}`}>
                                        <input type="radio" name="keyType" value={opt.value} checked={newKeyType === opt.value} onChange={() => setNewKeyType(opt.value)} className="accent-blue-500" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{opt.label}</p>
                                            <p className="text-xs text-tertiary-foreground">{opt.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewKeyModal(false)}>{t('cancel')}</Button>
                        <Button onClick={handleCreateKey} disabled={creatingKey || !newKeyName.trim()} className="bg-linear-to-r from-blue-500 to-indigo-600 gap-2">
                            {creatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            {t('apiKeysCreate')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
