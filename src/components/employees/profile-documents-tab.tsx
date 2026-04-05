"use client"

import { useState } from "react"
import { Shield, FileText, Search, FolderLock, File, Image, BadgeCheck, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { format } from "date-fns"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface DocumentsTabProps {
    employee: any
}

interface DocCategory {
    name: string
    icon: React.ReactNode
    color: string
    bg: string
    border: string
    docs: DocItem[]
}

interface DocItem {
    name: string
    type: string
    status: "verified" | "pending" | "expired"
    value: string | null
    date?: string
}

const statusConfig = {
    verified: { icon: <BadgeCheck className="h-3.5 w-3.5" />, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Verified" },
    pending: { icon: <Clock className="h-3.5 w-3.5" />, color: "text-amber-400", bg: "bg-amber-500/10", label: "Pending" },
    expired: { icon: <AlertCircle className="h-3.5 w-3.5" />, color: "text-red-400", bg: "bg-red-500/10", label: "Expired" },
}

export function DocumentsTab({ employee }: DocumentsTabProps) {
    const [searchQuery, setSearchQuery] = useState("")

    // Build document categories from employee data
    const categories: DocCategory[] = [
        {
            name: "Identity Documents",
            icon: <Shield className="h-5 w-5" />,
            color: "text-blue-400",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            docs: [
                { name: "National ID (NID)", type: "id", status: employee.nidNumber ? "verified" : "pending", value: employee.nidNumber },
                { name: "Passport", type: "id", status: employee.passportNumber ? "verified" : "pending", value: employee.passportNumber },
                { name: "TIN Certificate", type: "tax", status: employee.tinNumber ? "verified" : "pending", value: employee.tinNumber },
            ],
        },
        {
            name: "Employment Records",
            icon: <FileText className="h-5 w-5" />,
            color: "text-violet-400",
            bg: "bg-violet-500/10",
            border: "border-violet-500/20",
            docs: [
                { name: "Appointment Letter", type: "contract", status: employee.joiningDate ? "verified" : "pending", value: null, date: employee.joiningDate },
                { name: "Employee Code", type: "code", status: "verified", value: employee.employeeCode },
                { name: "Provident Fund", type: "pf", status: employee.pfNumber ? "verified" : "pending", value: employee.pfNumber },
            ],
        },
        {
            name: "Banking & Financial",
            icon: <FolderLock className="h-5 w-5" />,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            docs: [
                { name: "Bank Account", type: "bank", status: employee.accountNumber || employee.bankAccount ? "verified" : "pending", value: employee.accountNumber || employee.bankAccount },
                { name: "Bank Name", type: "bank", status: employee.bankName ? "verified" : "pending", value: employee.bankName },
                { name: "Routing Number", type: "bank", status: employee.routingNumber ? "verified" : "pending", value: employee.routingNumber },
            ],
        },
        {
            name: "Profile & Media",
            icon: <Image className="h-5 w-5" />,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            docs: [
                { name: "Profile Photo", type: "photo", status: employee.photoUrl ? "verified" : "pending", value: employee.photoUrl ? "Uploaded" : null },
                { name: "Biometric ID", type: "biometric", status: employee.biometricUserId ? "verified" : "pending", value: employee.biometricUserId },
            ],
        },
    ]

    const filteredCategories = searchQuery
        ? categories.map(cat => ({
            ...cat,
            docs: cat.docs.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())),
        })).filter(cat => cat.docs.length > 0)
        : categories

    const totalDocs = categories.reduce((s, c) => s + c.docs.length, 0)
    const verifiedDocs = categories.reduce((s, c) => s + c.docs.filter(d => d.status === "verified").length, 0)
    const completionRate = totalDocs > 0 ? Math.round((verifiedDocs / totalDocs) * 100) : 0

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ── Vault Header ──────────────────────────────────────────── */}
            <div className="rounded-xl border border-card-border bg-hover p-6 backdrop-blur-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-linear-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center">
                            <Shield className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-foreground text-lg">Document Vault</h3>
                            <p className="text-xs text-muted-foreground">
                                {verifiedDocs} of {totalDocs} documents verified
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search documents..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-card-bg border-card-border text-sm h-9"
                            />
                        </div>
                    </div>
                </div>

                {/* Completion bar */}
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Document Completeness</span>
                        <span className={completionRate === 100 ? "text-emerald-400 font-semibold" : ""}>{completionRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-out bg-linear-to-r from-blue-500 to-violet-500"
                            style={{ width: `${completionRate}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Document Categories ──────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredCategories.map((category, ci) => (
                    <div key={ci} className={`rounded-xl border ${category.border} bg-hover backdrop-blur-sm overflow-hidden transition-all duration-300 hover:scale-[1.01]`}>
                        <div className="p-5 pb-3 flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-lg ${category.bg} flex items-center justify-center ${category.color}`}>
                                {category.icon}
                            </div>
                            <h4 className="font-semibold text-foreground">{category.name}</h4>
                        </div>
                        <div className="px-5 pb-5 space-y-2">
                            {category.docs.map((doc, di) => {
                                const sc = statusConfig[doc.status]
                                return (
                                    <div key={di} className="flex items-center justify-between p-3 rounded-lg border border-card-border/50 hover:bg-card-bg/30 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <File className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                                                {doc.value && (
                                                    <p className="text-xs text-muted-foreground font-mono truncate">{doc.value}</p>
                                                )}
                                                {doc.date && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {format(new Date(doc.date), "MMM d, yyyy")}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <span className={`shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${sc.bg} ${sc.color}`}>
                                            {sc.icon}
                                            <span>{sc.label}</span>
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
