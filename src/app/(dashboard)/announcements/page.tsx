"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Loader2, Megaphone, Trash2, Pencil, Pin, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"

interface Announcement {
    id: string
    title: string
    content: string
    type: string
    isPinned: boolean
    publishDate: string
    expiryDate?: string | null
    isActive: boolean
    createdAt: string
}

const TYPES = [
    { value: "general", label: "General", labelBn: "সাধারণ", color: "bg-blue-500/10 text-blue-400" },
    { value: "policy", label: "Policy", labelBn: "নীতি", color: "bg-purple-500/10 text-purple-400" },
    { value: "celebration", label: "Celebration", labelBn: "উদযাপন", color: "bg-emerald-500/10 text-emerald-400" },
    { value: "urgent", label: "Urgent", labelBn: "জরুরি", color: "bg-red-500/10 text-red-400" },
]

export default function AnnouncementsPage() {
    const t = useTranslations('Announcements')
    const { addToast } = useToast()
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [announcements, setAnnouncements] = useState<Announcement[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingItem, setEditingItem] = useState<Announcement | null>(null)
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        title: "", content: "", type: "general", isPinned: false,
        publishDate: new Date().toISOString().split("T")[0],
        expiryDate: "", isActive: true,
    })

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch("/api/announcements")
            if (res.ok) setAnnouncements(await res.json())
        } catch (error) {
            console.error("Failed to fetch", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const openCreate = () => {
        setEditingItem(null)
        setForm({
            title: "", content: "", type: "general", isPinned: false,
            publishDate: new Date().toISOString().split("T")[0], expiryDate: "", isActive: true
        })
        setShowForm(true)
    }

    const openEdit = (item: Announcement) => {
        setEditingItem(item)
        setForm({
            title: item.title, content: item.content, type: item.type,
            isPinned: item.isPinned,
            publishDate: item.publishDate.split("T")[0],
            expiryDate: item.expiryDate?.split("T")[0] || "",
            isActive: item.isActive,
        })
        setShowForm(true)
    }

    const handleSave = async () => {
        if (!form.title.trim() || !form.content.trim()) return
        setSaving(true)
        try {
            const url = editingItem ? `/api/announcements/${editingItem.id}` : "/api/announcements"
            const method = editingItem ? "PUT" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    expiryDate: form.expiryDate || null,
                }),
            })
            if (res.ok) {
                addToast({ title: editingItem ? t('updated') : t('created'), type: "success" })
                setShowForm(false)
                fetchData()
            } else {
                const err = await res.json()
                addToast({ title: err.error || (editingItem ? t('updateFailed') : t('createFailed')), type: "error" })
            }
        } catch { addToast({ title: editingItem ? t('updateFailed') : t('createFailed'), type: "error" }) }
        finally { setSaving(false) }
    }

    const handleDelete = async (id: string) => {
        if (!await confirm({
            title: t('confirmDelete'),
            description: "This announcement will be permanently removed.",
            confirmLabel: "Delete",
            variant: "destructive",
        })) return
        try {
            const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" })
            if (res.ok) {
                addToast({ title: t('deleted'), type: "success" })
                fetchData()
            }
        } catch { addToast({ title: t('deleteFailed'), type: "error" }) }
    }

    const getStatus = (a: Announcement): { label: string; color: string } => {
        if (!a.isActive) return { label: t('draft'), color: "bg-slate-500/10 text-slate-400" }
        if (a.expiryDate && new Date(a.expiryDate) < new Date()) return { label: t('expired'), color: "bg-red-500/10 text-red-400" }
        return { label: t('published'), color: "bg-emerald-500/10 text-emerald-400" }
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
                    {t('create')}
                </Button>
            </div>

            {/* No announcements */}
            {announcements.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-card-border bg-card-bg">
                    <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground">{t('noAnnouncements')}</h3>
                    <p className="text-muted-foreground mt-1 mb-4">{t('noAnnouncementsDesc')}</p>
                    <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
                        <Plus className="h-4 w-4" />
                        {t('create')}
                    </Button>
                </div>
            )}

            {/* Announcements list */}
            {announcements.length > 0 && (
                <div className="space-y-3">
                    {announcements.map(a => {
                        const typeObj = TYPES.find(tt => tt.value === a.type)
                        const status = getStatus(a)
                        return (
                            <div key={a.id} className={cn(
                                "rounded-xl border bg-card-bg p-5 transition-colors",
                                a.isPinned ? "border-amber-500/30" : "border-card-border"
                            )}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            {a.isPinned && <Pin className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                                            <h3 className="text-base font-semibold text-foreground">{a.title}</h3>
                                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider", typeObj?.color || "bg-slate-500/10 text-slate-400")}>
                                                {typeObj?.label || a.type}
                                            </span>
                                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider", status.color)}>
                                                {status.label}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{a.content}</p>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(a.publishDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </span>
                                            {a.expiryDate && (
                                                <span>→ {new Date(a.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)} className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="max-w-lg bg-card border-card-border max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingItem ? t('edit') : t('create')}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-foreground block mb-1">{t('announcementTitle')}</label>
                            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                placeholder={t('titlePlaceholder')}
                                className="bg-background border-card-border" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground block mb-1">{t('content')}</label>
                            <Textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                                placeholder={t('contentPlaceholder')} rows={4}
                                className="bg-background border-card-border resize-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('priority')}</label>
                                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground">
                                    {TYPES.map(tt => (
                                        <option key={tt.value} value={tt.value}>{tt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('publishDate')}</label>
                                <Input type="date" value={form.publishDate} onChange={e => setForm(p => ({ ...p, publishDate: e.target.value }))}
                                    className="bg-background border-card-border" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-foreground block mb-1">{t('expiryDate')}</label>
                            <Input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))}
                                className="bg-background border-card-border" />
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-foreground">
                                <input type="checkbox" checked={form.isPinned} onChange={e => setForm(p => ({ ...p, isPinned: e.target.checked }))} className="rounded" />
                                {t('isPinned')}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-foreground">
                                <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                                {t('isActive')}
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-foreground">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {t('save')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {confirmDialog}
        </div>
    )
}
