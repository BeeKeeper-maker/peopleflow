"use client"

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts"
import { Wallet, TrendingUp, TrendingDown, Banknote } from "lucide-react"

interface PayrollEntry {
    month: number
    year: number
    gross: number
    net: number
    deductions: number
    basic: number
    hra: number
    medical: number
    conveyance: number
    pf: number
    tax: number
    status: string
}

interface PayrollData {
    current: {
        gross: number
        net: number
        deductions: number
        basic: number
        hra: number
        medical: number
        conveyance: number
        pf: number
        tax: number
        month: number
        year: number
    } | null
    history: PayrollEntry[]
}

interface PayrollTabProps {
    data: PayrollData | null
    loading: boolean
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#10b981"]

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload) return null
    return (
        <div className="rounded-lg border border-card-border bg-card-bg/95 backdrop-blur-sm p-3 shadow-xl">
            <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
            {payload.map((entry: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
                    <span className="text-muted-foreground">{entry.name}:</span>
                    <span className="font-semibold text-foreground">৳{Number(entry.value).toLocaleString()}</span>
                </div>
            ))}
        </div>
    )
}

export function PayrollTab({ data, loading }: PayrollTabProps) {
    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-28 rounded-xl bg-hover border border-card-border" />
                    ))}
                </div>
                <div className="h-72 rounded-xl bg-hover border border-card-border" />
            </div>
        )
    }

    if (!data || (!data.current && data.history.length === 0)) {
        return (
            <div className="p-12 text-center text-muted-foreground border border-dashed border-card-border rounded-xl">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground">No Payroll Data</h3>
                <p className="text-sm">Salary slips have not been generated for this employee yet.</p>
            </div>
        )
    }

    const current = data.current
    const chartData = [...data.history].reverse().map((h) => ({
        name: `${MONTHS[h.month - 1]} ${h.year.toString().slice(-2)}`,
        gross: h.gross,
        net: h.net,
        deductions: h.deductions,
    }))

    // Composition data for pie chart
    const compositionData = current ? [
        { name: "Basic", value: current.basic },
        { name: "HRA", value: current.hra },
        { name: "Medical", value: current.medical },
        { name: "Conveyance", value: current.conveyance },
        { name: "Other", value: Math.max(0, current.gross - current.basic - current.hra - current.medical - current.conveyance) },
    ].filter(d => d.value > 0) : []

    // Month-over-month change
    const prevSlip = data.history.length > 1 ? data.history[1] : null
    const netChange = current && prevSlip ? ((current.net - prevSlip.net) / prevSlip.net * 100).toFixed(1) : null

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ── Current Salary Overview ─────────────────────────────── */}
            {current && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Gross Salary</span>
                            <Banknote className="h-4 w-4 text-emerald-400" />
                        </div>
                        <p className="text-2xl font-bold text-emerald-400">৳{current.gross.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">{MONTHS[current.month - 1]} {current.year}</p>
                    </div>
                    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Net Salary</span>
                            <Wallet className="h-4 w-4 text-blue-400" />
                        </div>
                        <p className="text-2xl font-bold text-blue-400">৳{current.net.toLocaleString()}</p>
                        {netChange && (
                            <p className={`text-xs mt-1 flex items-center gap-1 ${Number(netChange) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {Number(netChange) >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {netChange}% from previous
                            </p>
                        )}
                    </div>
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-muted-foreground">Total Deductions</span>
                            <TrendingDown className="h-4 w-4 text-red-400" />
                        </div>
                        <p className="text-2xl font-bold text-red-400">৳{current.deductions.toLocaleString()}</p>
                        <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span>PF: ৳{current.pf.toLocaleString()}</span>
                            <span>Tax: ৳{current.tax.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Charts Row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Salary Trend */}
                <div className="lg:col-span-2 rounded-xl border border-card-border bg-hover p-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-semibold text-foreground">Salary Trend</h3>
                            <p className="text-xs text-muted-foreground">Net vs Gross over time</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Gross</span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Net</span>
                        </div>
                    </div>
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="gross" stroke="#10b981" fillOpacity={1} fill="url(#grossGrad)" strokeWidth={2} />
                                <Area type="monotone" dataKey="net" stroke="#3b82f6" fillOpacity={1} fill="url(#netGrad)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No historical data</div>
                    )}
                </div>

                {/* Salary Composition Donut */}
                {compositionData.length > 0 && (
                    <div className="rounded-xl border border-card-border bg-hover p-6 backdrop-blur-sm">
                        <h3 className="font-semibold text-foreground mb-1">Salary Breakdown</h3>
                        <p className="text-xs text-muted-foreground mb-4">Current composition</p>
                        <ResponsiveContainer width="100%" height={160}>
                            <PieChart>
                                <Pie data={compositionData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                                    {compositionData.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v) => `৳${Number(v).toLocaleString()}`} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 mt-2">
                            {compositionData.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                        <span className="text-muted-foreground">{item.name}</span>
                                    </span>
                                    <span className="font-medium text-foreground">৳{item.value.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Payslip History Table ───────────────────────────────── */}
            <div className="rounded-xl border border-card-border bg-hover backdrop-blur-sm overflow-hidden">
                <div className="p-6 pb-4">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-blue-400" />
                        <h3 className="font-semibold text-foreground">Payslip History</h3>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-y border-card-border bg-card-bg/50">
                                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Period</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Gross</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Deductions</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Net</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-card-border">
                            {data.history.map((slip, i) => (
                                <tr key={i} className="hover:bg-card-bg/30 transition-colors group">
                                    <td className="px-6 py-3 font-medium text-foreground">{MONTHS[slip.month - 1]} {slip.year}</td>
                                    <td className="px-6 py-3 text-right text-foreground font-mono text-xs">৳{slip.gross.toLocaleString()}</td>
                                    <td className="px-6 py-3 text-right text-red-400 font-mono text-xs">-৳{slip.deductions.toLocaleString()}</td>
                                    <td className="px-6 py-3 text-right text-emerald-400 font-semibold font-mono text-xs">৳{slip.net.toLocaleString()}</td>
                                    <td className="px-6 py-3 text-center">
                                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${slip.status === "paid" ? "bg-emerald-500/10 text-emerald-400" : slip.status === "approved" ? "bg-blue-500/10 text-blue-400" : "bg-amber-500/10 text-amber-400"}`}>
                                            {slip.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {data.history.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No payslips found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
