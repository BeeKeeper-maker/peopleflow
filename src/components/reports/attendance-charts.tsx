"use client"

import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    Area,
    AreaChart
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "next-intl"

interface AttendanceChartsProps {
    dailyData: any
    monthlyData: any[]
}

export function AttendanceCharts({ dailyData, monthlyData }: AttendanceChartsProps) {
    const t = useTranslations('Reports')

    // Transform dailyData object { present: 10, late: 2 } to array for BarChart
    const dailyChartData = [
        { name: t('present'), value: dailyData.present || 0, fill: "#10B981" },
        { name: t('late'), value: dailyData.late || 0, fill: "#F59E0B" },
        { name: t('absent'), value: dailyData.absent || 0, fill: "#EF4444" },
        { name: t('halfDay'), value: dailyData["half-day"] || 0, fill: "#6366F1" },
    ]

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4 bg-hover border-card-border text-foreground">
                <CardHeader>
                    <CardTitle>{t('monthlyAttendanceTrend')}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        {t('monthlyAttendanceDesc')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                    <ResponsiveContainer width="100%" height={350}>
                        <AreaChart data={monthlyData}>
                            <defs>
                                <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="date"
                                stroke="var(--text-tertiary)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getDate()}/${date.getMonth() + 1}`;
                                }}
                            />
                            <YAxis
                                stroke="var(--text-tertiary)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}`}
                            />
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                                itemStyle={{ color: "var(--text-primary)" }}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="present" stroke="#10B981" fillOpacity={1} fill="url(#colorPresent)" name={t('present')} />
                            <Area type="monotone" dataKey="late" stroke="#F59E0B" fillOpacity={1} fill="url(#colorLate)" name={t('late')} />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="col-span-3 bg-hover border-card-border text-foreground">
                <CardHeader>
                    <CardTitle>{t('todaysOverview')}</CardTitle>
                    <CardDescription className="text-muted-foreground">
                        {t('todaysOverviewDesc')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={dailyChartData} layout="vertical" margin={{ left: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={80}
                                tick={{ fill: "var(--text-primary)", fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                                itemStyle={{ color: "var(--text-primary)" }}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                                {
                                    // No need for Cell mapping if we passed fill in data, recharts handles it automatically or via <Cell> 
                                    // But Bar doesn't use data.fill by default unless Cell is used or we bind fill to a payload prop (complex).
                                    // Simpler: Just map Cells.
                                }
                            </Bar>
                        </BarChart>
                        {/* Recharts Bar with individual colors needs Cell mapping, fixing below */}
                    </ResponsiveContainer>
                    {/* Custom Legend/Summary since BarChart 'fill' in data needs manual Cell implementation or similar */}
                    <div className="mt-4 grid grid-cols-2 gap-4">
                        {dailyChartData.map((item) => (
                            <div key={item.name} className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.fill }} />
                                <div className="flex flex-col">
                                    <span className="text-xs text-muted-foreground">{item.name}</span>
                                    <span className="text-lg font-bold">{item.value}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
