"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, Calendar as CalendarIcon, List, Trash2, Pencil, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

interface Holiday {
    id: string
    name: string
    nameBn?: string | null
    date: string
    description?: string | null  // Used to store holiday type (government/religious/national/etc.)
}

interface HolidayList {
    id: string
    name: string
    year: number
    isActive: boolean
    holidays: Holiday[]
}

const HOLIDAY_TYPES = [
    { value: "government", label: "Government", labelBn: "সরকারি" },
    { value: "religious", label: "Religious", labelBn: "ধর্মীয়" },
    { value: "national", label: "National", labelBn: "জাতীয়" },
    { value: "optional", label: "Optional", labelBn: "ঐচ্ছিক" },
    { value: "company", label: "Company", labelBn: "কোম্পানি" },
]

// Common Bangladesh holidays for bulk import
const BD_HOLIDAYS_2026 = [
    { name: "International Mother Language Day", nameBn: "আন্তর্জাতিক মাতৃভাষা দিবস", date: "2026-02-21", type: "national" },
    { name: "Independence Day", nameBn: "স্বাধীনতা দিবস", date: "2026-03-26", type: "national" },
    { name: "Bengali New Year", nameBn: "পহেলা বৈশাখ", date: "2026-04-14", type: "national" },
    { name: "May Day", nameBn: "মে দিবস", date: "2026-05-01", type: "government" },
    { name: "National Mourning Day", nameBn: "জাতীয় শোক দিবস", date: "2026-08-15", type: "national" },
    { name: "Victory Day", nameBn: "বিজয় দিবস", date: "2026-12-16", type: "national" },
    { name: "Eid ul-Fitr (estimated)", nameBn: "ঈদুল ফিতর (আনুমানিক)", date: "2026-03-20", type: "religious" },
    { name: "Eid ul-Fitr 2nd Day", nameBn: "ঈদুল ফিতর ২য় দিন", date: "2026-03-21", type: "religious" },
    { name: "Eid ul-Adha (estimated)", nameBn: "ঈদুল আযহা (আনুমানিক)", date: "2026-05-27", type: "religious" },
    { name: "Eid ul-Adha 2nd Day", nameBn: "ঈদুল আযহা ২য় দিন", date: "2026-05-28", type: "religious" },
    { name: "Shab-e-Meraj", nameBn: "শবে মেরাজ", date: "2026-01-07", type: "religious" },
    { name: "Durga Puja", nameBn: "দুর্গাপূজা", date: "2026-10-20", type: "religious" },
]

export default function HolidaysPage() {
    const t = useTranslations('Holidays')
    const { addToast } = useToast()
    const { confirm, dialog: confirmDialog } = useConfirmDialog()
    const [holidayLists, setHolidayLists] = useState<HolidayList[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [view, setView] = useState<"list" | "calendar">("list")
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [showCreateList, setShowCreateList] = useState(false)
    const [showAddHoliday, setShowAddHoliday] = useState(false)
    const [showImport, setShowImport] = useState(false)
    const [selectedListId, setSelectedListId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    // Form state for new holiday list
    const [newListName, setNewListName] = useState("")
    const [newListYear, setNewListYear] = useState(new Date().getFullYear())

    // Form state for new holiday
    const [newHoliday, setNewHoliday] = useState({
        name: "", nameBn: "", date: "", type: "government"
    })

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/holidays?year=${selectedYear}`)
            if (res.ok) {
                const data = await res.json()
                setHolidayLists(data)
                if (data.length > 0 && !selectedListId) {
                    setSelectedListId(data[0].id)
                }
            }
        } catch (error) {
            console.error("Failed to fetch holidays", error)
        } finally {
            setIsLoading(false)
        }
    }, [selectedYear, selectedListId])

    useEffect(() => { fetchData() }, [fetchData])

    const activeList = holidayLists.find(l => l.id === selectedListId)

    // Create holiday list
    const handleCreateList = async () => {
        if (!newListName.trim()) return
        setSaving(true)
        try {
            const res = await fetch("/api/holidays", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newListName, year: newListYear }),
            })
            if (res.ok) {
                addToast({ title: t('listCreated'), type: "success" })
                setShowCreateList(false)
                setNewListName("")
                fetchData()
            } else {
                const err = await res.json()
                addToast({ title: err.error || t('createFailed'), type: "error" })
            }
        } catch { addToast({ title: t('createFailed'), type: "error" }) }
        finally { setSaving(false) }
    }

    // Add holiday to list
    const handleAddHoliday = async () => {
        if (!selectedListId || !newHoliday.name || !newHoliday.date) return
        setSaving(true)
        try {
            const res = await fetch(`/api/holidays/${selectedListId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newHoliday),
            })
            if (res.ok) {
                addToast({ title: t('holidayAdded'), type: "success" })
                setShowAddHoliday(false)
                setNewHoliday({ name: "", nameBn: "", date: "", type: "government" })
                fetchData()
            } else {
                const err = await res.json()
                addToast({ title: err.error || t('addFailed'), type: "error" })
            }
        } catch { addToast({ title: t('addFailed'), type: "error" }) }
        finally { setSaving(false) }
    }

    // Delete holiday
    const handleDeleteHoliday = async (holidayId: string) => {
        const _ok = await confirm({ title: t('confirmDelete'), description: 'This holiday will be permanently removed.', confirmLabel: 'Delete', variant: 'destructive' }); if (!_ok) return
        try {
            const res = await fetch(`/api/holidays/${selectedListId}?holidayId=${holidayId}`, {
                method: "DELETE",
            })
            if (res.ok) {
                addToast({ title: t('holidayDeleted'), type: "success" })
                fetchData()
            }
        } catch { addToast({ title: t('deleteFailed'), type: "error" }) }
    }

    // Bulk import Bangladesh holidays
    const handleImport = async () => {
        if (!selectedListId) return
        setSaving(true)
        try {
            const res = await fetch(`/api/holidays/${selectedListId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bulk: BD_HOLIDAYS_2026 }),
            })
            if (res.ok) {
                const result = await res.json()
                addToast({ title: `${result.count} ${t('holidaysImported')}`, type: "success" })
                setShowImport(false)
                fetchData()
            }
        } catch { addToast({ title: t('importFailed'), type: "error" }) }
        finally { setSaving(false) }
    }

    // Calendar helpers
    const getMonthDays = (year: number, month: number) => {
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        return { firstDay, daysInMonth }
    }

    const getHolidayForDate = (dateStr: string): Holiday | undefined => {
        return activeList?.holidays.find(h => h.date.split("T")[0] === dateStr)
    }

    const months = [
        t('january'), t('february'), t('march'), t('april'),
        t('may'), t('june'), t('july'), t('august'),
        t('september'), t('october'), t('november'), t('december')
    ]

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
                <div className="flex items-center gap-2">
                    {/* Year selector */}
                    <select
                        value={selectedYear}
                        onChange={(e) => { setSelectedYear(Number(e.target.value)); setIsLoading(true) }}
                        className="rounded-lg border border-card-border bg-card-bg px-3 py-2 text-sm text-foreground"
                    >
                        {[2024, 2025, 2026, 2027, 2028].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    {/* View toggle */}
                    <div className="flex rounded-lg border border-card-border overflow-hidden">
                        <button
                            onClick={() => setView("list")}
                            className={cn(
                                "px-3 py-2 text-sm transition-colors",
                                view === "list" ? "bg-blue-500/15 text-blue-400" : "text-muted-foreground hover:bg-hover"
                            )}
                        >
                            <List className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setView("calendar")}
                            className={cn(
                                "px-3 py-2 text-sm transition-colors",
                                view === "calendar" ? "bg-blue-500/15 text-blue-400" : "text-muted-foreground hover:bg-hover"
                            )}
                        >
                            <CalendarIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <Button
                        onClick={() => setShowCreateList(true)}
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground"
                    >
                        <Plus className="h-4 w-4" />
                        {t('createList')}
                    </Button>
                </div>
            </div>

            {/* Holiday List Tabs */}
            {holidayLists.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                    {holidayLists.map(list => (
                        <button
                            key={list.id}
                            onClick={() => setSelectedListId(list.id)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                                selectedListId === list.id
                                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                    : "text-muted-foreground hover:bg-hover border border-card-border"
                            )}
                        >
                            {list.name} ({list.holidays.length})
                        </button>
                    ))}
                </div>
            )}

            {/* No lists message */}
            {holidayLists.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-card-border bg-card-bg">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground">{t('noLists')}</h3>
                    <p className="text-muted-foreground mt-1 mb-4">{t('noListsDesc')}</p>
                    <Button onClick={() => setShowCreateList(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
                        <Plus className="h-4 w-4" />
                        {t('createList')}
                    </Button>
                </div>
            )}

            {/* Active list content */}
            {activeList && (
                <>
                    {/* Action bar */}
                    <div className="flex gap-2">
                        <Button onClick={() => setShowAddHoliday(true)} variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" />
                            {t('addHoliday')}
                        </Button>
                        <Button onClick={() => setShowImport(true)} variant="outline" className="gap-2">
                            <Upload className="h-4 w-4" />
                            {t('importBD')}
                        </Button>
                    </div>

                    {/* List View */}
                    {view === "list" && (
                        <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-card-border bg-hover/50">
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('holidayName')}</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('date')}</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('type')}</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('day')}</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeList.holidays.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                                                {t('noHolidays')}
                                            </td>
                                        </tr>
                                    ) : (
                                        activeList.holidays
                                            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                            .map(holiday => {
                                                const d = new Date(holiday.date)
                                                const dayName = d.toLocaleDateString('en-US', { weekday: 'long' })
                                                const hType = holiday.description || "company"
                                                const typeObj = HOLIDAY_TYPES.find(ht => ht.value === hType)
                                                return (
                                                    <tr key={holiday.id} className="border-b border-card-border last:border-0 hover:bg-hover/30 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div>
                                                                <p className="text-sm font-medium text-foreground">{holiday.name}</p>
                                                                {holiday.nameBn && (
                                                                    <p className="text-xs text-muted-foreground">{holiday.nameBn}</p>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-foreground">
                                                            {d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={cn(
                                                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                                hType === "government" ? "bg-blue-500/10 text-blue-400" :
                                                                    hType === "religious" ? "bg-purple-500/10 text-purple-400" :
                                                                        hType === "national" ? "bg-emerald-500/10 text-emerald-400" :
                                                                            hType === "optional" ? "bg-amber-500/10 text-amber-400" :
                                                                                "bg-slate-500/10 text-slate-400"
                                                            )}>
                                                                {typeObj?.label || hType}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-muted-foreground">{dayName}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteHoliday(holiday.id)}
                                                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                )
                                            })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Calendar View */}
                    {view === "calendar" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Array.from({ length: 12 }, (_, monthIdx) => {
                                const { firstDay, daysInMonth } = getMonthDays(selectedYear, monthIdx)
                                return (
                                    <div key={monthIdx} className="rounded-xl border border-card-border bg-card-bg p-4">
                                        <h3 className="text-sm font-semibold text-foreground mb-3">{months[monthIdx]}</h3>
                                        <div className="grid grid-cols-7 gap-1 text-center">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                                <span key={i} className="text-[10px] font-medium text-muted-foreground py-1">{d}</span>
                                            ))}
                                            {Array.from({ length: firstDay }, (_, i) => (
                                                <span key={`empty-${i}`} />
                                            ))}
                                            {Array.from({ length: daysInMonth }, (_, i) => {
                                                const day = i + 1
                                                const dateStr = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                                const holiday = getHolidayForDate(dateStr)
                                                const isWeekend = new Date(selectedYear, monthIdx, day).getDay() === 5 || new Date(selectedYear, monthIdx, day).getDay() === 6
                                                return (
                                                    <div
                                                        key={day}
                                                        className={cn(
                                                            "relative text-xs py-1 rounded cursor-default",
                                                            holiday ? "bg-red-500/20 text-red-400 font-semibold" :
                                                                isWeekend ? "text-muted-foreground/50" : "text-foreground"
                                                        )}
                                                        title={holiday?.name}
                                                    >
                                                        {day}
                                                        {holiday && (
                                                            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-400" />
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Create List Modal */}
            {showCreateList && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-card-border bg-card-bg p-6 shadow-xl">
                        <h2 className="text-lg font-semibold text-foreground mb-4">{t('createList')}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('listName')}</label>
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder={t('listNamePlaceholder')}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('year')}</label>
                                <select
                                    value={newListYear}
                                    onChange={(e) => setNewListYear(Number(e.target.value))}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground"
                                >
                                    {[2024, 2025, 2026, 2027, 2028].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setShowCreateList(false)}>{t('cancel')}</Button>
                            <Button onClick={handleCreateList} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-foreground">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {t('create')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Holiday Modal */}
            {showAddHoliday && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-card-border bg-card-bg p-6 shadow-xl">
                        <h2 className="text-lg font-semibold text-foreground mb-4">{t('addHoliday')}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('holidayName')}</label>
                                <input
                                    type="text"
                                    value={newHoliday.name}
                                    onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder={t('holidayNamePlaceholder')}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('holidayNameBn')}</label>
                                <input
                                    type="text"
                                    value={newHoliday.nameBn}
                                    onChange={(e) => setNewHoliday(prev => ({ ...prev, nameBn: e.target.value }))}
                                    placeholder={t('holidayNameBnPlaceholder')}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('date')}</label>
                                <input
                                    type="date"
                                    value={newHoliday.date}
                                    onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('type')}</label>
                                <select
                                    value={newHoliday.type}
                                    onChange={(e) => setNewHoliday(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground"
                                >
                                    {HOLIDAY_TYPES.map(ht => (
                                        <option key={ht.value} value={ht.value}>{ht.label}</option>
                                    ))}
                                </select>
                            </div>

                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setShowAddHoliday(false)}>{t('cancel')}</Button>
                            <Button onClick={handleAddHoliday} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-foreground">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {t('add')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import Modal */}
            {showImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card-bg p-6 shadow-xl">
                        <h2 className="text-lg font-semibold text-foreground mb-2">{t('importBD')}</h2>
                        <p className="text-sm text-muted-foreground mb-4">{t('importDesc')}</p>
                        <div className="max-h-60 overflow-y-auto rounded-lg border border-card-border">
                            <table className="w-full">
                                <tbody>
                                    {BD_HOLIDAYS_2026.map((h, i) => (
                                        <tr key={i} className="border-b border-card-border last:border-0">
                                            <td className="px-3 py-2 text-sm text-foreground">{h.nameBn || h.name}</td>
                                            <td className="px-3 py-2 text-sm text-muted-foreground">{h.date}</td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">{h.type}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setShowImport(false)}>{t('cancel')}</Button>
                            <Button onClick={handleImport} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-foreground">
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                {t('importAll')} ({BD_HOLIDAYS_2026.length})
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
