"use client"

import { useState, useEffect } from "react"
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
    ImageIcon,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

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

    useEffect(() => {
        fetchSettings()
    }, [])

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

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith("image/")) {
            addToast({ title: t('toastSelectImage'), type: 'error' })
            return
        }

        if (file.size > 2 * 1024 * 1024) {
            addToast({ title: t('toastImageSize'), type: 'error' })
            return
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
        } catch (error) {
            console.error("Logo upload error:", error)
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

            if (res.ok) {
                addToast({ title: t('toastSettingsSaved'), type: 'success' })
            } else {
                addToast({ title: t('toastSettingsFail'), type: 'error' })
            }
        } catch (error) {
            console.error("Save error:", error)
            addToast({ title: t('toastSettingsFail'), type: 'error' })
        } finally {
            setSaving(false)
        }
    }

    const handleSaveNotifications = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/settings/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(notifications),
            })

            if (res.ok) {
                addToast({ title: t('toastNotifSaved'), type: 'success' })
            } else {
                addToast({ title: t('toastNotifFail'), type: 'error' })
            }
        } catch (error) {
            console.error("Save error:", error)
            addToast({ title: t('toastNotifFail'), type: 'error' })
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async () => {
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            addToast({ title: t('toastPasswordMismatch'), type: 'error' })
            return
        }

        if (passwordForm.newPassword.length < 8) {
            addToast({ title: t('toastPasswordMin'), type: 'error' })
            return
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
        } catch (error) {
            console.error("Password change error:", error)
            addToast({ title: t('toastPasswordFail'), type: 'error' })
        } finally {
            setChangingPassword(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
                <p className="text-muted-foreground mt-1">
                    {t('subtitle')}
                </p>
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
                </TabsList>

                {/* Organization Settings */}
                <TabsContent value="organization" className="space-y-6">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('companyProfile')}</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {t('companyProfileDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Logo Upload */}
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
                                    <input
                                        type="file"
                                        id="logo-upload"
                                        accept="image/png,image/jpeg,image/jpg"
                                        className="hidden"
                                        onChange={handleLogoUpload}
                                    />
                                    <Button
                                        variant="outline"
                                        className="gap-2"
                                        disabled={uploadingLogo}
                                        onClick={() => document.getElementById("logo-upload")?.click()}
                                    >
                                        {uploadingLogo ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Upload className="h-4 w-4" />
                                        )}
                                        {uploadingLogo ? t('uploading') : t('uploadLogo')}
                                    </Button>
                                    <p className="text-xs text-tertiary-foreground">
                                        {t('logoHint')}
                                    </p>
                                </div>
                            </div>

                            {/* Company Name */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('companyName')}</Label>
                                    <Input
                                        value={orgSettings.name}
                                        onChange={(e) => setOrgSettings({ ...orgSettings, name: e.target.value })}
                                        placeholder={t('companyNamePlaceholder')}
                                        className="bg-hover border-card-border"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('industry')}</Label>
                                    <Input
                                        value={orgSettings.industry || ""}
                                        onChange={(e) => setOrgSettings({ ...orgSettings, industry: e.target.value })}
                                        placeholder={t('industryPlaceholder')}
                                        className="bg-hover border-card-border"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('regionalSettings')}</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {t('regionalSettingsDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('timezone')}</Label>
                                    <Input
                                        value={orgSettings.timezone}
                                        onChange={(e) => setOrgSettings({ ...orgSettings, timezone: e.target.value })}
                                        className="bg-hover border-card-border"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('currency')}</Label>
                                    <Input
                                        value={orgSettings.currency}
                                        onChange={(e) => setOrgSettings({ ...orgSettings, currency: e.target.value })}
                                        className="bg-hover border-card-border"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('dateFormat')}</Label>
                                    <Input
                                        value={orgSettings.dateFormat}
                                        onChange={(e) => setOrgSettings({ ...orgSettings, dateFormat: e.target.value })}
                                        className="bg-hover border-card-border"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-foreground">{t('fiscalYearStart')}</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={12}
                                        value={orgSettings.fiscalYearStart}
                                        onChange={(e) => setOrgSettings({ ...orgSettings, fiscalYearStart: parseInt(e.target.value) })}
                                        className="bg-hover border-card-border"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button
                            onClick={handleSaveOrg}
                            disabled={saving}
                            className="gap-2 bg-linear-to-r from-blue-500 to-indigo-600"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {t('saveChanges')}
                        </Button>
                    </div>
                </TabsContent>

                {/* Notifications Settings */}
                <TabsContent value="notifications" className="space-y-6">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('emailNotifications')}</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {t('configureNotificationsDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('emailNotifications')}</Label>
                                        <p className="text-sm text-tertiary-foreground">
                                            {t('emailNotificationsDesc')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.emailNotifications}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, emailNotifications: checked })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('leaveApprovals')}</Label>
                                        <p className="text-sm text-tertiary-foreground">
                                            {t('leaveApprovalsDesc')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.leaveApprovals}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, leaveApprovals: checked })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('payrollAlerts')}</Label>
                                        <p className="text-sm text-tertiary-foreground">
                                            {t('payrollAlertsDesc')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.payrollAlerts}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, payrollAlerts: checked })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('attendanceReminders')}</Label>
                                        <p className="text-sm text-tertiary-foreground">
                                            {t('attendanceRemindersDesc')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.attendanceReminders}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, attendanceReminders: checked })
                                        }
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('systemUpdates')}</Label>
                                        <p className="text-sm text-tertiary-foreground">
                                            {t('systemUpdatesDesc')}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={notifications.systemUpdates}
                                        onCheckedChange={(checked) =>
                                            setNotifications({ ...notifications, systemUpdates: checked })
                                        }
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button
                            onClick={handleSaveNotifications}
                            disabled={saving}
                            className="gap-2 bg-linear-to-r from-blue-500 to-indigo-600"
                        >
                            {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {t('savePreferences')}
                        </Button>
                    </div>
                </TabsContent>

                {/* Security Settings */}
                <TabsContent value="security" className="space-y-6">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('securitySettings')}</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {t('securitySettingsDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('twoFactorAuth')}</Label>
                                        <p className="text-sm text-tertiary-foreground">
                                            {t('twoFactorAuthDesc')}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">
                                        {t('comingSoon')}
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('sessionManagement')}</Label>
                                        <p className="text-sm text-tertiary-foreground">
                                            {t('sessionManagementDesc')}
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="text-yellow-400 border-yellow-400/30">
                                        {t('comingSoon')}
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-card-border bg-hover p-4">
                                    <div className="space-y-0.5">
                                        <Label className="text-foreground">{t('changePassword')}</Label>
                                        <p className="text-sm text-tertiary-foreground">
                                            {t('changePasswordDesc')}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPasswordModalOpen(true)}
                                    >
                                        {t('update')}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Billing Settings */}
                <TabsContent value="billing" className="space-y-6">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground">{t('subscriptionPlan')}</CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {t('subscriptionPlanDesc')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-6">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-semibold text-foreground">{t('enterprisePlan')}</h3>
                                        <Badge className="bg-blue-500/20 text-blue-400">{t('active')}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {t('planFeatures')}
                                    </p>
                                </div>
                                <Button variant="outline">
                                    {t('managePlan')}
                                </Button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-lg border border-card-border bg-hover p-4 text-center">
                                    <Users className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-foreground">{t('unlimited')}</p>
                                    <p className="text-sm text-tertiary-foreground">{t('employees')}</p>
                                </div>
                                <div className="rounded-lg border border-card-border bg-hover p-4 text-center">
                                    <Calendar className="h-8 w-8 text-green-400 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-foreground">{t('months12')}</p>
                                    <p className="text-sm text-tertiary-foreground">{t('remaining')}</p>
                                </div>
                                <div className="rounded-lg border border-card-border bg-hover p-4 text-center">
                                    <Clock className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                                    <p className="text-2xl font-bold text-foreground">{t('support247')}</p>
                                    <p className="text-sm text-tertiary-foreground">{t('support')}</p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-card-border bg-hover p-4 text-center">
                                <p className="text-sm text-tertiary-foreground">
                                    {t('billingInfo')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Password Change Modal */}
            <Dialog open={passwordModalOpen} onOpenChange={setPasswordModalOpen}>
                <DialogContent className="bg-card border-card-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground flex items-center gap-2">
                            <Key className="h-5 w-5 text-blue-400" />
                            {t('changePassword')}
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {t('passwordDialogDesc')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">{t('currentPassword')}</Label>
                            <div className="relative">
                                <Input
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    placeholder={t('currentPasswordPlaceholder')}
                                    className="bg-hover border-card-border pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 text-tertiary-foreground hover:text-foreground"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                >
                                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-foreground">{t('newPassword')}</Label>
                            <div className="relative">
                                <Input
                                    type={showNewPassword ? "text" : "password"}
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    placeholder={t('newPasswordPlaceholder')}
                                    className="bg-hover border-card-border pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 text-tertiary-foreground hover:text-foreground"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-tertiary-foreground">{t('minChars')}</p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-foreground">{t('confirmNewPassword')}</Label>
                            <Input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                placeholder={t('confirmPasswordPlaceholder')}
                                className="bg-hover border-card-border"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPasswordModalOpen(false)}
                            disabled={changingPassword}
                        >
                            {t('cancel')}
                        </Button>
                        <Button
                            onClick={handleChangePassword}
                            disabled={changingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
                            className="bg-linear-to-r from-blue-500 to-indigo-600"
                        >
                            {changingPassword ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            {t('changePassword')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
