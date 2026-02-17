"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, Building, Trash2, Pencil, MapPin, Phone, Mail, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"

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
    _count?: { employees: number }
}

export default function BranchesPage() {
    const t = useTranslations('Branches')
    const { addToast } = useToast()
    const [branches, setBranches] = useState<Branch[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        name: "", code: "", address: "", city: "", phone: "", email: "", isHeadOffice: false
    })

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/branches")
            if (res.ok) {
                const data = await res.json()
                setBranches(data)
            }
        } catch (error) {
            console.error("Failed to fetch branches", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const openCreate = () => {
        setEditingBranch(null)
        setForm({ name: "", code: "", address: "", city: "", phone: "", email: "", isHeadOffice: false })
        setShowForm(true)
    }

    const openEdit = (branch: Branch) => {
        setEditingBranch(branch)
        setForm({
            name: branch.name,
            code: branch.code || "",
            address: branch.address || "",
            city: branch.city || "",
            phone: branch.phone || "",
            email: branch.email || "",
            isHeadOffice: branch.isHeadOffice,
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
                body: JSON.stringify(form),
            })
            if (res.ok) {
                addToast({ title: editingBranch ? t('updated') : t('created'), type: "success" })
                setShowForm(false)
                fetchData()
            } else {
                const err = await res.json()
                addToast({ title: err.error || (editingBranch ? t('updateFailed') : t('createFailed')), type: "error" })
            }
        } catch { addToast({ title: editingBranch ? t('updateFailed') : t('createFailed'), type: "error" }) }
        finally { setSaving(false) }
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t('confirmDelete'))) return
        try {
            const res = await fetch(`/api/branches/${id}`, { method: "DELETE" })
            if (res.ok) {
                addToast({ title: t('deleted'), type: "success" })
                fetchData()
            }
        } catch { addToast({ title: t('deleteFailed'), type: "error" }) }
    }

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
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card-bg p-6 shadow-xl">
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
