"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, Building, Trash2, Pencil, MapPin, Phone, Mail, Users, Navigation, Shield, ShieldOff, CheckCircle2, Settings2, Crown, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface Branch {
    id: string
    name: string
    code?: string | null
    address?: string | null
    city?: string | null
    phone?: string | null
    email?: string | null
    isHeadOffice: boolean
    isActive: boolean
    latitude?: number | null
    longitude?: number | null
    geoFenceRadius?: number
    _count?: { employees: number }
}

interface GeoFenceConfig {
    geoFenceEnabled: boolean
    geoFenceEnforcement: string
}

export default function BranchesPage() {
    const t = useTranslations('Branches')
    const router = useRouter()
    const { addToast } = useToast()
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [branches, setBranches] = useState<Branch[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
    const [saving, setSaving] = useState(false)
    const [geoConfig, setGeoConfig] = useState<GeoFenceConfig>({ geoFenceEnabled: false, geoFenceEnforcement: "soft" })
    const [savingGeo, setSavingGeo] = useState(false)
    const [fetchingLocation, setFetchingLocation] = useState(false)
    const [planLimit, setPlanLimit] = useState<{ message: string; current?: number; limit?: number } | null>(null)

    const [form, setForm] = useState({
        name: "", code: "", address: "", city: "", phone: "", email: "", isHeadOffice: false,
        latitude: "" as string, longitude: "" as string, geoFenceRadius: "200"
    })

    const fetchData = useCallback(async () => {
        try {
            const [branchRes, geoRes] = await Promise.all([
                fetch("/api/branches"),
                fetch("/api/settings/geo-fence"),
            ])
            if (branchRes.ok) {
                const data = await branchRes.json()
                setBranches(data)
            }
            if (geoRes.ok) {
                const geoData = await geoRes.json()
                setGeoConfig({
                    geoFenceEnabled: geoData.geoFenceEnabled || false,
                    geoFenceEnforcement: geoData.geoFenceEnforcement || "soft",
                })
            }
        } catch (error) {
            console.error("Failed to fetch branches", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const openCreate = () => {
        setPlanLimit(null)
        setEditingBranch(null)
        setForm({ name: "", code: "", address: "", city: "", phone: "", email: "", isHeadOffice: false, latitude: "", longitude: "", geoFenceRadius: "200" })
        setShowForm(true)
    }

    const openEdit = (branch: Branch) => {
        setPlanLimit(null)
        setEditingBranch(branch)
        setForm({
            name: branch.name,
            code: branch.code || "",
            address: branch.address || "",
            city: branch.city || "",
            phone: branch.phone || "",
            email: branch.email || "",
            isHeadOffice: branch.isHeadOffice,
            latitude: branch.latitude?.toString() || "",
            longitude: branch.longitude?.toString() || "",
            geoFenceRadius: (branch.geoFenceRadius || 200).toString(),
        })
        setShowForm(true)
    }

    const handleSave = async () => {
        if (!form.name.trim()) return
        setSaving(true)
        try {
            const url = editingBranch ? `/api/branches/${editingBranch.id}` : "/api/branches"
            const method = editingBranch ? "PUT" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    latitude: form.latitude ? parseFloat(form.latitude) : null,
                    longitude: form.longitude ? parseFloat(form.longitude) : null,
                    geoFenceRadius: parseInt(form.geoFenceRadius) || 200,
                }),
            })
            if (res.ok) {
                addToast({ title: editingBranch ? t('updated') : t('created'), type: "success" })
                setPlanLimit(null)
                setShowForm(false)
                fetchData()
            } else {
                const err = await res.json()
                if (err.upgradeRequired) {
                    setPlanLimit({ message: err.error || "Your current plan cannot add more branches.", current: err.current, limit: err.limit })
                }
                addToast({
                    title: err.error || (editingBranch ? t('updateFailed') : t('createFailed')),
                    description: err.upgradeRequired ? "Open billing to choose a plan with a higher branch limit." : undefined,
                    type: err.upgradeRequired ? "warning" : "error",
                    duration: err.upgradeRequired ? 9000 : undefined,
                })
            }
        } catch { addToast({ title: editingBranch ? t('updateFailed') : t('createFailed'), type: "error" }) }
        finally { setSaving(false) }
    }

    const handleDelete = async (id: string) => {
        const _ok = await confirm({ title: t('confirmDelete'), description: 'This branch will be permanently removed.', confirmLabel: 'Delete', variant: 'destructive' }); if (!_ok) return
        try {
            const res = await fetch(`/api/branches/${id}`, { method: "DELETE" })
            if (res.ok) {
                addToast({ title: t('deleted'), type: "success" })
                fetchData()
            }
        } catch { addToast({ title: t('deleteFailed'), type: "error" }) }
    }

    // ── GPS: Use My Current Location ──────────────────────────────
    const handleUseMyLocation = async () => {
        if (!("geolocation" in navigator)) {
            addToast({ title: "আপনার ব্রাউজারে GPS সাপোর্ট নেই", type: "error" })
            return
        }
        setFetchingLocation(true)
        try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 15000,
                })
            })
            setForm(prev => ({
                ...prev,
                latitude: pos.coords.latitude.toFixed(6),
                longitude: pos.coords.longitude.toFixed(6),
            }))
            addToast({ title: "✅ আপনার অবস্থান সফলভাবে নেওয়া হয়েছে!", type: "success" })
        } catch (e: unknown) {
            const err = e as GeolocationPositionError
            if (err?.code === 1) {
                addToast({ title: "📍 Location permission দিতে হবে। Browser-এ allow করুন।", type: "error" })
            } else {
                addToast({ title: "📍 Location নেওয়া যায়নি। আবার চেষ্টা করুন।", type: "error" })
            }
        } finally {
            setFetchingLocation(false)
        }
    }

    // ── Toggle Geo-Fence ─────────────────────────────────────────
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
                addToast({
                    title: !geoConfig.geoFenceEnabled
                        ? "✅ GPS Attendance চালু হয়েছে"
                        : "GPS Attendance বন্ধ করা হয়েছে",
                    type: "success"
                })
            }
        } catch {
            addToast({ title: "সেটিংস আপডেট ব্যর্থ", type: "error" })
        } finally {
            setSavingGeo(false)
        }
    }

    const handleChangeEnforcement = async (mode: string) => {
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
                addToast({ title: `মোড পরিবর্তন: ${mode === "strict" ? "Strict (অফিসের বাইরে block)" : "Soft (warning দিবে)"}`, type: "success" })
            }
        } catch {
            addToast({ title: "সেটিংস আপডেট ব্যর্থ", type: "error" })
        } finally {
            setSavingGeo(false)
        }
    }

    // Count branches with GPS configured
    const gpsConfiguredCount = branches.filter(b => b.latitude && b.longitude).length

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center rounded-xl border border-card-border bg-hover">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
                    <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                </div>
                <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
                    <Plus className="h-4 w-4" />
                    {t('addBranch')}
                </Button>
            </div>

            {planLimit && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                            <Crown className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Branch limit reached</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">{planLimit.message}</p>
                            {typeof planLimit.current === "number" && typeof planLimit.limit === "number" && (
                                <p className="text-xs text-amber-300 mt-1">Current usage: {planLimit.current}/{planLimit.limit} branches</p>
                            )}
                        </div>
                    </div>
                    <Button
                        onClick={() => router.push("/billing/upgrade?source=branch-limit")}
                        className="gap-2 bg-amber-500 hover:bg-amber-600 text-black shrink-0"
                    >
                        Upgrade plan <ArrowUpRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* ── GPS Attendance Control Panel ───────────────────────── */}
            <div className="rounded-xl border border-card-border bg-card-bg p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            geoConfig.geoFenceEnabled ? "bg-emerald-500/10" : "bg-zinc-500/10"
                        )}>
                            {geoConfig.geoFenceEnabled ? <Shield className="h-5 w-5 text-emerald-400" /> : <ShieldOff className="h-5 w-5 text-zinc-400" />}
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">
                                GPS Attendance Verification
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {geoConfig.geoFenceEnabled
                                    ? `চালু আছে • ${gpsConfiguredCount}/${branches.length} ব্রাঞ্চে GPS সেট করা হয়েছে`
                                    : "বন্ধ আছে • কর্মীরা যেকোনো জায়গা থেকে check-in করতে পারবে"
                                }
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {geoConfig.geoFenceEnabled && (
                            <div className="flex items-center gap-1 border border-card-border rounded-lg p-0.5">
                                <button
                                    onClick={() => handleChangeEnforcement("soft")}
                                    disabled={savingGeo}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                        geoConfig.geoFenceEnforcement === "soft"
                                            ? "bg-amber-500/20 text-amber-400"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Soft
                                </button>
                                <button
                                    onClick={() => handleChangeEnforcement("strict")}
                                    disabled={savingGeo}
                                    className={cn(
                                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                        geoConfig.geoFenceEnforcement === "strict"
                                            ? "bg-red-500/20 text-red-400"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Strict
                                </button>
                            </div>
                        )}
                        <button
                            onClick={handleToggleGeoFence}
                            disabled={savingGeo}
                            className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                geoConfig.geoFenceEnabled ? "bg-emerald-500" : "bg-zinc-600"
                            )}
                        >
                            <span className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                geoConfig.geoFenceEnabled ? "translate-x-6" : "translate-x-1"
                            )} />
                        </button>
                    </div>
                </div>

                {/* Helpful tips */}
                {geoConfig.geoFenceEnabled && gpsConfiguredCount < branches.length && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                        <p className="text-xs text-amber-400 flex items-center gap-1.5">
                            <Settings2 className="h-3.5 w-3.5 shrink-0" />
                            {branches.length - gpsConfiguredCount}টি ব্রাঞ্চে GPS location সেট করা হয়নি। Edit বাটনে ক্লিক করে &quot;📍 আমার অবস্থান ব্যবহার করুন&quot; বাটন চাপুন।
                        </p>
                    </div>
                )}
            </div>

            {/* No branches */}
            {branches.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-card-border bg-card-bg">
                    <Building className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground">{t('noBranches')}</h3>
                    <p className="text-muted-foreground mt-1 mb-4">{t('noBranchesDesc')}</p>
                    <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
                        <Plus className="h-4 w-4" />
                        {t('addBranch')}
                    </Button>
                </div>
            )}

            {/* Branch cards grid */}
            {branches.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {branches.map(branch => (
                        <div key={branch.id} className="rounded-xl border border-card-border bg-card-bg p-5 hover:border-blue-500/30 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-semibold text-foreground">{branch.name}</h3>
                                        {branch.isHeadOffice && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 uppercase tracking-wider">
                                                {t('isHeadOffice')}
                                            </span>
                                        )}
                                    </div>
                                    {branch.code && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{branch.code}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className={cn(
                                        "w-2 h-2 rounded-full",
                                        branch.isActive ? "bg-emerald-400" : "bg-red-400"
                                    )} />
                                    <Button variant="ghost" size="sm" onClick={() => openEdit(branch)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(branch.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-1.5 text-sm">
                                {branch.address && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{branch.address}{branch.city ? `, ${branch.city}` : ''}</span>
                                    </div>
                                )}
                                {branch.phone && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Phone className="h-3.5 w-3.5 shrink-0" />
                                        <span>{branch.phone}</span>
                                    </div>
                                )}
                                {branch.email && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Mail className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{branch.email}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-muted-foreground pt-1">
                                    <Users className="h-3.5 w-3.5 shrink-0" />
                                    <span>{branch._count?.employees || 0} {t('employees')}</span>
                                </div>
                            </div>

                            {/* GPS Status Badge */}
                            <div className="mt-3 pt-3 border-t border-card-border">
                                {branch.latitude && branch.longitude ? (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            <span>GPS সেট করা হয়েছে</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            {branch.geoFenceRadius || 200}m radius
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs text-amber-400">
                                            <Navigation className="h-3.5 w-3.5" />
                                            <span>GPS সেট করা হয়নি</span>
                                        </div>
                                        <button
                                            onClick={() => openEdit(branch)}
                                            className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                                        >
                                            সেট করুন →
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card-bg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-semibold text-foreground mb-4">
                            {editingBranch ? t('editBranch') : t('addBranch')}
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1">{t('branchName')}</label>
                                    <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                        placeholder={t('branchNamePlaceholder')}
                                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1">{t('branchCode')}</label>
                                    <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                                        placeholder={t('branchCodePlaceholder')}
                                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('address')}</label>
                                <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                                    placeholder={t('addressPlaceholder')}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1">{t('city')}</label>
                                    <input type="text" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                                        placeholder={t('cityPlaceholder')}
                                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1">{t('phone')}</label>
                                    <input type="text" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                                        placeholder={t('phonePlaceholder')}
                                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('email')}</label>
                                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    placeholder={t('emailPlaceholder')}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground" />
                            </div>

                            {/* ── GPS Location Section ── */}
                            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Navigation className="h-4 w-4 text-blue-400" />
                                        <span className="text-sm font-medium text-foreground">Office Location (GPS)</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleUseMyLocation}
                                        disabled={fetchingLocation}
                                        className="gap-1.5 text-xs border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                                    >
                                        {fetchingLocation ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <MapPin className="h-3 w-3" />
                                        )}
                                        {fetchingLocation ? "নিচ্ছে..." : "📍 আমার অবস্থান ব্যবহার করুন"}
                                    </Button>
                                </div>
                                <p className="text-[11px] text-muted-foreground mb-3">
                                    অফিসে বসে থাকা অবস্থায় &quot;আমার অবস্থান ব্যবহার করুন&quot; চাপুন। এটি আপনার অফিসের GPS coordinate সেভ করবে, যাতে কর্মীদের attendance location verify করা যায়।
                                </p>
                                <div className="grid grid-cols-5 gap-3">
                                    <div className="col-span-2">
                                        <label className="text-xs text-muted-foreground block mb-1">Latitude</label>
                                        <input type="text" value={form.latitude} onChange={e => setForm(p => ({ ...p, latitude: e.target.value }))}
                                            placeholder="23.8103"
                                            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground font-mono" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs text-muted-foreground block mb-1">Longitude</label>
                                        <input type="text" value={form.longitude} onChange={e => setForm(p => ({ ...p, longitude: e.target.value }))}
                                            placeholder="90.4125"
                                            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground font-mono" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1">Radius (m)</label>
                                        <input type="number" value={form.geoFenceRadius} onChange={e => setForm(p => ({ ...p, geoFenceRadius: e.target.value }))}
                                            placeholder="200"
                                            min="50" max="5000"
                                            className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground font-mono" />
                                    </div>
                                </div>
                                {form.latitude && form.longitude && (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                                        <CheckCircle2 className="h-3 w-3" />
                                        <span>Location সেট করা হয়েছে — কর্মীরা {form.geoFenceRadius}m এর মধ্যে থেকে check-in করতে পারবে</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="isHeadOffice" checked={form.isHeadOffice}
                                    onChange={e => setForm(p => ({ ...p, isHeadOffice: e.target.checked }))} className="rounded" />
                                <label htmlFor="isHeadOffice" className="text-sm text-foreground">{t('isHeadOffice')}</label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
                            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-foreground">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {t('save')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
