"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, HandCoins, Trash2, Check, X, Banknote } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"

interface Employee {
    id: string
    firstName: string
    lastName: string
    employeeCode: string
}

interface Loan {
    id: string
    type: string
    amount: number
    interestRate: number
    tenure: number
    emiAmount: number
    disbursedAmount: number
    paidAmount: number
    remainingAmount: number
    status: string
    reason?: string | null
    createdAt: string
    employee: Employee
}

const LOAN_TYPES = [
    { value: "salary_advance", label: "Salary Advance" },
    { value: "personal", label: "Personal Loan" },
    { value: "emergency", label: "Emergency Loan" },
    { value: "housing", label: "Housing Loan" },
    { value: "education", label: "Education Loan" },
]

const STATUS_COLORS: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-400",
    approved: "bg-blue-500/10 text-blue-400",
    rejected: "bg-red-500/10 text-red-400",
    disbursed: "bg-emerald-500/10 text-emerald-400",
    closed: "bg-slate-500/10 text-slate-400",
}

export default function LoansPage() {
    const t = useTranslations('Loans')
    const { addToast } = useToast()
    const [loans, setLoans] = useState<Loan[]>([])
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        employeeId: "", type: "salary_advance", amount: "", interestRate: "0", tenure: "12", reason: ""
    })

    const fetchData = useCallback(async () => {
        try {
            const [loansRes, empRes] = await Promise.all([
                fetch("/api/loans"),
                fetch("/api/employees?fields=id,firstName,lastName,employeeId"),
            ])
            if (loansRes.ok) setLoans(await loansRes.json())
            if (empRes.ok) {
                const empData = await empRes.json()
                setEmployees(Array.isArray(empData) ? empData : empData.employees || [])
            }
        } catch (error) {
            console.error("Failed to fetch", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    const handleCreate = async () => {
        if (!form.employeeId || !form.amount || !form.tenure) return
        setSaving(true)
        try {
            const res = await fetch("/api/loans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: form.employeeId,
                    type: form.type,
                    amount: parseFloat(form.amount),
                    interestRate: parseFloat(form.interestRate || "0"),
                    tenure: parseInt(form.tenure),
                    reason: form.reason || null,
                }),
            })
            if (res.ok) {
                addToast({ title: t('created'), type: "success" })
                setShowForm(false)
                setForm({ employeeId: "", type: "salary_advance", amount: "", interestRate: "0", tenure: "12", reason: "" })
                fetchData()
            } else {
                const err = await res.json()
                addToast({ title: err.error || t('createFailed'), type: "error" })
            }
        } catch { addToast({ title: t('createFailed'), type: "error" }) }
        finally { setSaving(false) }
    }

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            const res = await fetch(`/api/loans/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            })
            if (res.ok) {
                addToast({ title: t('statusUpdated'), type: "success" })
                fetchData()
            }
        } catch { addToast({ title: t('updateFailed'), type: "error" }) }
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t('confirmDelete'))) return
        try {
            const res = await fetch(`/api/loans/${id}`, { method: "DELETE" })
            if (res.ok) fetchData()
        } catch { /* silent */ }
    }

    const formatCurrency = (amount: number) => `৳${amount.toLocaleString()}`

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
                <Button onClick={() => setShowForm(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
                    <Plus className="h-4 w-4" />
                    {t('createLoan')}
                </Button>
            </div>

            {/* Summary Cards */}
            {loans.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: t('pending'), count: loans.filter(l => l.status === "pending").length, color: "text-amber-400" },
                        { label: t('approved'), count: loans.filter(l => l.status === "approved").length, color: "text-blue-400" },
                        { label: t('disbursed'), count: loans.filter(l => l.status === "disbursed").length, color: "text-emerald-400" },
                        { label: t('completed'), count: loans.filter(l => l.status === "closed").length, color: "text-slate-400" },
                    ].map(s => (
                        <div key={s.label} className="rounded-xl border border-card-border bg-card-bg p-4">
                            <p className="text-sm text-muted-foreground">{s.label}</p>
                            <p className={cn("text-2xl font-bold mt-1", s.color)}>{s.count}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* No loans */}
            {loans.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-card-border bg-card-bg">
                    <HandCoins className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground">{t('noLoans')}</h3>
                    <p className="text-muted-foreground mt-1 mb-4">{t('noLoansDesc')}</p>
                    <Button onClick={() => setShowForm(true)} className="gap-2 bg-blue-600 hover:bg-blue-700 text-foreground">
                        <Plus className="h-4 w-4" />
                        {t('createLoan')}
                    </Button>
                </div>
            )}

            {/* Loans table */}
            {loans.length > 0 && (
                <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-card-border bg-hover/50">
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('employee')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('loanType')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('amount')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('monthlyDeduction')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('remaining')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">{t('status')}</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loans.map(loan => {
                                    const typeObj = LOAN_TYPES.find(lt => lt.value === loan.type)
                                    return (
                                        <tr key={loan.id} className="border-b border-card-border last:border-0 hover:bg-hover/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{loan.employee.firstName} {loan.employee.lastName}</p>
                                                    <p className="text-xs text-muted-foreground">{loan.employee.employeeCode}</p>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">{typeObj?.label || loan.type}</td>
                                            <td className="px-4 py-3 text-sm font-medium text-foreground">{formatCurrency(loan.amount)}</td>
                                            <td className="px-4 py-3 text-sm text-foreground">{formatCurrency(loan.emiAmount)}</td>
                                            <td className="px-4 py-3 text-sm text-foreground">{formatCurrency(loan.remainingAmount)}</td>
                                            <td className="px-4 py-3">
                                                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[loan.status] || "bg-slate-500/10 text-slate-400")}>
                                                    {loan.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    {loan.status === "pending" && (
                                                        <>
                                                            <Button variant="ghost" size="sm" onClick={() => handleStatusUpdate(loan.id, "approved")}
                                                                className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                                                                <Check className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handleStatusUpdate(loan.id, "rejected")}
                                                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {loan.status === "approved" && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleStatusUpdate(loan.id, "disbursed")}
                                                            className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10">
                                                            <Banknote className="h-3.5 w-3.5 mr-1" />
                                                            {t('disburse')}
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(loan.id)}
                                                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-2xl border border-card-border bg-card-bg p-6 shadow-xl">
                        <h2 className="text-lg font-semibold text-foreground mb-4">{t('createLoan')}</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('employee')}</label>
                                <select value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground">
                                    <option value="">{t('selectEmployee')}</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1">{t('loanType')}</label>
                                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground">
                                        {LOAN_TYPES.map(lt => (
                                            <option key={lt.value} value={lt.value}>{lt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1">{t('amount')}</label>
                                    <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                                        placeholder={t('amountPlaceholder')}
                                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1">{t('interestRate')}</label>
                                    <input type="number" value={form.interestRate} onChange={e => setForm(p => ({ ...p, interestRate: e.target.value }))}
                                        step="0.5" min="0"
                                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1">{t('tenure')}</label>
                                    <input type="number" value={form.tenure} onChange={e => setForm(p => ({ ...p, tenure: e.target.value }))}
                                        min="1"
                                        className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1">{t('reason')}</label>
                                <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                                    placeholder={t('reasonPlaceholder')} rows={2}
                                    className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground resize-none" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setShowForm(false)}>{t('cancel')}</Button>
                            <Button onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-foreground">
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
