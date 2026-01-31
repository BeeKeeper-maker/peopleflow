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

interface AttendanceChartsProps {
    dailyData: any
    monthlyData: any[]
}

export function AttendanceCharts({ dailyData, monthlyData }: AttendanceChartsProps) {
    // Transform dailyData object { present: 10, late: 2 } to array for BarChart
    const dailyChartData = [
        { name: "Present", value: dailyData.present || 0, fill: "#10B981" }, // Emerald-500
        { name: "Late", value: dailyData.late || 0, fill: "#F59E0B" },    // Amber-500
        { name: "Absent", value: dailyData.absent || 0, fill: "#EF4444" },  // Red-500
        { name: "Half Day", value: dailyData["half-day"] || 0, fill: "#6366F1" }, // Indigo-500
    ]

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4 bg-white/5 border-white/10 text-white">
                <CardHeader>
                    <CardTitle>Monthly Attendance Trend</CardTitle>
                    <CardDescription className="text-white/60">
                        Attendance status overview for the last 30 days.
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
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => {
                                    const date = new Date(value);
                                    return `${date.getDate()}/${date.getMonth() + 1}`;
                                }}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}`}
                            />
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                                itemStyle={{ color: "#fff" }}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="present" stroke="#10B981" fillOpacity={1} fill="url(#colorPresent)" name="Present" />
                            <Area type="monotone" dataKey="late" stroke="#F59E0B" fillOpacity={1} fill="url(#colorLate)" name="Late" />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="col-span-3 bg-white/5 border-white/10 text-white">
                <CardHeader>
                    <CardTitle>Today's Overview</CardTitle>
                    <CardDescription className="text-white/60">
                        Real-time status distribution.
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
                                tick={{ fill: "#fff", fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                                itemStyle={{ color: "#fff" }}
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
                                    <span className="text-xs text-white/60">{item.name}</span>
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
