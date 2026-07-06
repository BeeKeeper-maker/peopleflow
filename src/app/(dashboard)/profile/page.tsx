"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    User,
    Mail,
    Phone,
    Building2,
    Briefcase,
    Calendar,
    MapPin,
    Edit,
    Shield,
    Clock,
    CreditCard,
    Eye,
    EyeOff,
    Loader2,
    Save,
    X,
    UserCircle,
    AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { useTranslations } from "next-intl"

// ── Types matching the new structured API response ──
interface EmployeeData {
    id: string
    firstName: string
    lastName: string
    email?: string
    phone?: string
    personalEmail?: string
    photoUrl?: string
    employeeCode: string
    employmentStatus: string
    employmentType?: string
    joiningDate: string
    dateOfBirth?: string
    gender?: string
    bloodGroup?: string
    maritalStatus?: string
    nationality?: string
    nidNumber?: string
    presentAddress?: string
    permanentAddress?: string
    emergencyContactName?: string
    emergencyContactPhone?: string
    emergencyContactRelation?: string
    bankName?: string
    accountNumber?: string
    routingNumber?: string
    department?: { name: string }
    designation?: { name: string }
    branch?: { name: string }
    shift?: { name: string }
    reportingManager?: { firstName: string; lastName: string }
}

interface UserProfile {
    id: string
    name: string | null
    email: string | null
    role: string
    employee: EmployeeData | null
    organization: {
        name: string
        industry?: string
    } | null
}

export default function ProfilePage() {
    const t = useTranslations('Profile')
    const { data: session, status } = useSession()
    const router = useRouter()
    const { addToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<UserProfile | null>(null)

    // Edit profile state — only self-editable fields
    const [isEditing, setIsEditing] = useState(false)
    const [editForm, setEditForm] = useState({
        phone: "",
        personalEmail: "",
        presentAddress: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        emergencyContactRelation: "",
    })
    const [isSaving, setIsSaving] = useState(false)

    // Password modal state
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    })
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false,
    })
    const [isChangingPassword, setIsChangingPassword] = useState(false)

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login")
        } else if (session?.user) {
            fetchProfile()
        }
    }, [session, status])

    const fetchProfile = async () => {
        try {
            const res = await fetch("/api/employees/me")
            if (res.ok) {
                const json = await res.json()
                const data: UserProfile = json.data
                setProfile(data)

                // Pre-fill edit form with current employee data
                if (data.employee) {
                    setEditForm({
                        phone: data.employee.phone || "",
                        personalEmail: data.employee.personalEmail || "",
                        presentAddress: data.employee.presentAddress || "",
                        emergencyContactName: data.employee.emergencyContactName || "",
                        emergencyContactPhone: data.employee.emergencyContactPhone || "",
                        emergencyContactRelation: data.employee.emergencyContactRelation || "",
                    })
                }
            }
        } catch (error) {
            console.error("Failed to fetch profile", error)
            addToast({ title: t('toastProfileFail'), type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    const handleSaveProfile = async () => {
        setIsSaving(true)
        try {
            const res = await fetch("/api/employees/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm),
            })

            if (res.ok) {
                addToast({ title: t('toastProfileUpdated'), type: 'success' })
                setIsEditing(false)
                fetchProfile()
            } else {
                const data = await res.json()
                addToast({ title: data.error || t('toastProfileFail'), type: 'error' })
            }
        } catch (error) {
            addToast({ title: t('toastProfileFail'), type: 'error' })
        } finally {
            setIsSaving(false)
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

        setIsChangingPassword(true)
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
                setShowPasswordModal(false)
                setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
            } else {
                const data = await res.json()
                addToast({ title: data.error || t('toastPasswordFail'), type: 'error' })
            }
        } catch (error) {
            addToast({ title: t('toastPasswordFail'), type: 'error' })
        } finally {
            setIsChangingPassword(false)
        }
    }

    // ── Loading State ──
    if (status === "loading" || loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-6">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        )
    }

    const employee = profile?.employee
    const user = session?.user
    const initials = employee
        ? `${employee.firstName?.[0] || ""}${employee.lastName?.[0] || ""}`
        : user?.name?.[0] || "U"

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-foreground">{t('title')}</h1>
                    <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                </div>
                {employee && (
                    isEditing ? (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="border-border-hover"
                                onClick={() => setIsEditing(false)}
                            >
                                <X className="h-4 w-4 mr-2" />
                                {t('cancel')}
                            </Button>
                            <Button
                                className="bg-green-600 hover:bg-green-700"
                                onClick={handleSaveProfile}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                {t('saveChanges')}
                            </Button>
                        </div>
                    ) : (
                        <Button
                            className="bg-linear-to-r from-blue-500 to-indigo-600 hover:opacity-90"
                            onClick={() => setIsEditing(true)}
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            {t('editProfile')}
                        </Button>
                    )
                )}
            </div>

            {/* Profile Card */}
            <Card className="bg-card border-card-border">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-start gap-6">
                        {/* Avatar */}
                        <Avatar className="h-24 w-24 border-2 border-border-hover">
                            <AvatarImage src={employee?.photoUrl || ""} />
                            <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-white text-2xl">
                                {initials}
                            </AvatarFallback>
                        </Avatar>

                        {/* Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h2 className="text-2xl font-display font-bold text-foreground tabular-nums">
                                    {employee ? `${employee.firstName} ${employee.lastName}` : user?.name}
                                </h2>
                                <Badge className="bg-blue-500/20 text-blue-400">
                                    {profile?.role || "User"}
                                </Badge>
                                {employee?.employmentStatus && (
                                    <Badge className={cn(
                                        employee.employmentStatus === "active"
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : "bg-gray-500/20 text-gray-400"
                                    )}>
                                        {employee.employmentStatus}
                                    </Badge>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                                {employee?.designation && (
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="h-4 w-4" />
                                        <span>{employee.designation.name}</span>
                                    </div>
                                )}
                                {employee?.department && (
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        <span>{employee.department.name}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" />
                                    <span>{employee?.email || user?.email}</span>
                                </div>
                                {employee?.phone && (
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4" />
                                        <span>{employee.phone}</span>
                                    </div>
                                )}
                                {employee?.employeeCode && (
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4" />
                                        <span>{t('idLabel', { code: employee.employeeCode })}</span>
                                    </div>
                                )}
                                {employee?.joiningDate && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span>{t('joined', { date: new Date(employee.joiningDate).toLocaleDateString() })}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-hover border-card-border">
                    <TabsTrigger value="overview">{t('tabOverview')}</TabsTrigger>
                    <TabsTrigger value="security">{t('tabSecurity')}</TabsTrigger>
                    <TabsTrigger value="activity">{t('tabActivity')}</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Personal Information */}
                        <Card className="bg-card border-card-border">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <User className="h-5 w-5 text-blue-400" />
                                    {t('personalInfo')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <InfoRow label={t('fullName')} value={employee ? `${employee.firstName} ${employee.lastName}` : user?.name || "-"} />
                                <InfoRow label={t('email')} value={employee?.email || user?.email || "-"} />

                                {isEditing ? (
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t('phone')}</Label>
                                        <Input
                                            value={editForm.phone}
                                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                            className="bg-hover border-card-border text-foreground"
                                            placeholder={t('phonePlaceholder')}
                                        />
                                    </div>
                                ) : (
                                    <InfoRow label={t('phone')} value={employee?.phone || "-"} />
                                )}

                                {isEditing ? (
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">Personal Email</Label>
                                        <Input
                                            value={editForm.personalEmail}
                                            onChange={(e) => setEditForm({ ...editForm, personalEmail: e.target.value })}
                                            className="bg-hover border-card-border text-foreground"
                                            placeholder="personal@email.com"
                                        />
                                    </div>
                                ) : (
                                    <InfoRow label="Personal Email" value={employee?.personalEmail || "-"} />
                                )}

                                {isEditing ? (
                                    <div className="space-y-2">
                                        <Label className="text-muted-foreground">{t('address')}</Label>
                                        <Input
                                            value={editForm.presentAddress}
                                            onChange={(e) => setEditForm({ ...editForm, presentAddress: e.target.value })}
                                            className="bg-hover border-card-border text-foreground"
                                            placeholder={t('addressPlaceholder')}
                                        />
                                    </div>
                                ) : (
                                    <InfoRow label={t('address')} value={employee?.presentAddress || "-"} />
                                )}
                            </CardContent>
                        </Card>

                        {/* Work Information */}
                        <Card className="bg-card border-card-border">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <Briefcase className="h-5 w-5 text-purple-400" />
                                    {t('workInfo')}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <InfoRow label={t('employeeId')} value={employee?.employeeCode || "-"} />
                                <InfoRow label={t('department')} value={employee?.department?.name || "-"} />
                                <InfoRow label={t('designation')} value={employee?.designation?.name || "-"} />
                                <InfoRow label={t('organization')} value={profile?.organization?.name || "-"} />
                                <InfoRow label={t('joinDate')} value={employee?.joiningDate ? new Date(employee.joiningDate).toLocaleDateString() : "-"} />
                                <InfoRow label={t('status')} value={employee?.employmentStatus || "-"} />
                            </CardContent>
                        </Card>

                        {/* Emergency Contact (separate card) */}
                        <Card className="bg-card border-card-border md:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-foreground flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-red-400" />
                                    Emergency Contact
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {isEditing ? (
                                        <>
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground">Contact Name</Label>
                                                <Input
                                                    value={editForm.emergencyContactName}
                                                    onChange={(e) => setEditForm({ ...editForm, emergencyContactName: e.target.value })}
                                                    className="bg-hover border-card-border text-foreground"
                                                    placeholder="Emergency contact name"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground">Relation</Label>
                                                <Input
                                                    value={editForm.emergencyContactRelation}
                                                    onChange={(e) => setEditForm({ ...editForm, emergencyContactRelation: e.target.value })}
                                                    className="bg-hover border-card-border text-foreground"
                                                    placeholder="e.g. Father, Spouse"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-muted-foreground">Contact Phone</Label>
                                                <Input
                                                    value={editForm.emergencyContactPhone}
                                                    onChange={(e) => setEditForm({ ...editForm, emergencyContactPhone: e.target.value })}
                                                    className="bg-hover border-card-border text-foreground"
                                                    placeholder="+880 1XXX XXXXXX"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <InfoRow label="Contact Name" value={employee?.emergencyContactName || "-"} />
                                            <InfoRow label="Relation" value={employee?.emergencyContactRelation || "-"} />
                                            <InfoRow label="Contact Phone" value={employee?.emergencyContactPhone || "-"} />
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="security" className="mt-4">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Shield className="h-5 w-5 text-emerald-400" />
                                {t('securitySettings')}
                            </CardTitle>
                            <CardDescription>{t('manageAccountSecurity')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-lg bg-hover border border-card-border">
                                <div>
                                    <p className="text-foreground font-medium">{t('password')}</p>
                                    <p className="text-muted-foreground text-sm">{t('changeYourPassword')}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="border-border-hover"
                                    onClick={() => setShowPasswordModal(true)}
                                >
                                    {t('changePassword')}
                                </Button>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-lg bg-hover border border-card-border">
                                <div>
                                    <p className="text-foreground font-medium">{t('twoFactorAuth')}</p>
                                    <p className="text-muted-foreground text-sm">{t('twoFactorAuthDesc')}</p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="border-border-hover"
                                    onClick={() => addToast({ title: t('twoFAComingSoon'), type: 'info' })}
                                >
                                    {t('enable2FA')}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                    <Card className="bg-card border-card-border">
                        <CardHeader>
                            <CardTitle className="text-foreground flex items-center gap-2">
                                <Clock className="h-5 w-5 text-amber-400" />
                                {t('recentActivity')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-center py-8 text-tertiary-foreground">
                                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>{t('noActivity')}</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Change Password Modal */}
            <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
                <DialogContent className="bg-card border-card-border text-foreground">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">{t('changePassword')}</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            {t('passwordDialogDesc')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label className="text-foreground">{t('currentPassword')}</Label>
                            <div className="relative">
                                <Input
                                    type={showPasswords.current ? "text" : "password"}
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                    className="bg-hover border-card-border text-foreground pr-10"
                                    placeholder={t('currentPasswordPlaceholder')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary-foreground hover:text-foreground"
                                >
                                    {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">{t('newPassword')}</Label>
                            <div className="relative">
                                <Input
                                    type={showPasswords.new ? "text" : "password"}
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                    className="bg-hover border-card-border text-foreground pr-10"
                                    placeholder={t('newPasswordPlaceholder')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary-foreground hover:text-foreground"
                                >
                                    {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-foreground">{t('confirmPassword')}</Label>
                            <div className="relative">
                                <Input
                                    type={showPasswords.confirm ? "text" : "password"}
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                    className="bg-hover border-card-border text-foreground pr-10"
                                    placeholder={t('confirmPasswordPlaceholder')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary-foreground hover:text-foreground"
                                >
                                    {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                variant="outline"
                                className="border-border-hover"
                                onClick={() => setShowPasswordModal(false)}
                            >
                                {t('cancel')}
                            </Button>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={handleChangePassword}
                                disabled={isChangingPassword}
                            >
                                {isChangingPassword ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        {t('changing')}
                                    </>
                                ) : (
                                    t('changePassword')
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center py-2 border-b border-card-border last:border-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground">{value}</span>
        </div>
    )
}
