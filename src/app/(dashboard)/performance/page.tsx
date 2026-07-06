"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
    Target,
    TrendingUp,
    CheckCircle2,
    Clock,
    Plus,
    Star,
    BarChart3,
    Loader2,
    Calendar,
    Flag,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"

interface KeyResult {
    id: string
    title: string
    targetValue: number
    currentValue: number
    unit?: string
    status: string
}

interface Goal {
    id: string
    title: string
    description?: string
    type: string
    priority: string
    status: string
    progress: number
    startDate?: string
    dueDate?: string
    completedAt?: string
    employee: {
        id: string
        firstName: string
        lastName: string
        photoUrl?: string
    }
    keyResults: KeyResult[]
    reviewCycle?: { id: string; name: string }
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    not_started: { label: "Not Started", color: "bg-gray-500/20 text-gray-400", icon: Clock },
    in_progress: { label: "In Progress", color: "bg-blue-500/20 text-blue-400", icon: TrendingUp },
    completed: { label: "Completed", color: "bg-emerald-500/20 text-emerald-400", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", color: "bg-red-500/20 text-red-400", icon: Clock },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
    low: { label: "Low", color: "bg-gray-500/20 text-gray-400" },
    medium: { label: "Medium", color: "bg-amber-500/20 text-amber-400" },
    high: { label: "High", color: "bg-orange-500/20 text-orange-400" },
    critical: { label: "Critical", color: "bg-red-500/20 text-red-400" },
}

export default function PerformancePage() {
    const [goals, setGoals] = useState<Goal[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("all")
    const t = useTranslations('Performance')

    useEffect(() => {
        fetchGoals()
    }, [])

    const fetchGoals = async () => {
        try {
            const res = await fetch("/api/performance/goals?my=true")
            if (res.ok) {
                const response = await res.json()
                // Handle both wrapped and raw responses for backward compatibility
                setGoals(response.data || response || [])
            }
        } catch (error) {
            console.error("Failed to fetch goals", error)
        } finally {
            setLoading(false)
        }
    }

    const stats = {
        total: goals.length,
        inProgress: goals.filter(g => g.status === "in_progress").length,
        completed: goals.filter(g => g.status === "completed").length,
        avgProgress: goals.length > 0
            ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
            : 0,
    }

    const filteredGoals = activeTab === "all"
        ? goals
        : goals.filter(g => g.status === activeTab)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-foreground">{t('title')}</h1>
                    <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
                </div>
                <Link href="/performance/goals/new">
                    <Button className="bg-linear-to-r from-purple-500 to-pink-600 hover:opacity-90">
                        <Plus className="h-4 w-4 mr-2" />
                        {t('setNewGoal')}
                    </Button>
                </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-card border-card-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('totalGoals')}</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{stats.total}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-linear-to-r from-purple-500 to-pink-600">
                                <Target className="h-5 w-5 text-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-card-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('inProgress')}</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{stats.inProgress}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-linear-to-r from-blue-500 to-indigo-600">
                                <TrendingUp className="h-5 w-5 text-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-card-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('completed')}</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{stats.completed}</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-linear-to-r from-emerald-500 to-green-600">
                                <CheckCircle2 className="h-5 w-5 text-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-card-border">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t('avgProgress')}</p>
                                <h3 className="text-2xl font-display font-bold text-foreground">{stats.avgProgress}%</h3>
                            </div>
                            <div className="p-3 rounded-xl bg-linear-to-r from-amber-500 to-orange-600">
                                <BarChart3 className="h-5 w-5 text-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-hover border-card-border">
                    <TabsTrigger value="all">{t('allGoals')} ({goals.length})</TabsTrigger>
                    <TabsTrigger value="in_progress">{t('inProgress')} ({stats.inProgress})</TabsTrigger>
                    <TabsTrigger value="completed">{t('completed')} ({stats.completed})</TabsTrigger>
                    <TabsTrigger value="not_started">{t('notStarted')} ({goals.filter(g => g.status === "not_started").length})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-tertiary-foreground" />
                        </div>
                    ) : filteredGoals.length === 0 ? (
                        <Card className="bg-card border-card-border">
                            <CardContent className="py-16 text-center">
                                <Target className="h-12 w-12 mx-auto text-muted-text mb-4" />
                                <h3 className="text-lg font-medium text-foreground mb-2">
                                    {t('noGoals')}
                                </h3>
                                <p className="text-tertiary-foreground mb-6">
                                    {t('noGoalsDesc')}
                                </p>
                                <Link href="/performance/goals/new">
                                    <Button className="bg-linear-to-r from-purple-500 to-pink-600">
                                        <Plus className="h-4 w-4 mr-2" />
                                        {t('addGoal')}
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {filteredGoals.map((goal) => (
                                <GoalCard key={goal.id} goal={goal} onUpdate={fetchGoals} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}

function GoalCard({ goal, onUpdate }: { goal: Goal; onUpdate: () => void }) {
    const statusInfo = statusConfig[goal.status] || statusConfig.not_started
    const priorityInfo = priorityConfig[goal.priority] || priorityConfig.medium
    const StatusIcon = statusInfo.icon
    const t = useTranslations('Performance') // Added t for GoalCard

    const updateProgress = async (newProgress: number) => {
        try {
            const newStatus = newProgress >= 100 ? "completed" : newProgress > 0 ? "in_progress" : "not_started"
            await fetch(`/api/performance/goals/${goal.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ progress: newProgress, status: newStatus }),
            })
            onUpdate()
        } catch (error) {
            console.error("Failed to update goal", error)
        }
    }

    return (
        <Card className="bg-card border-card-border hover:border-border-hover transition-all">
            <CardContent className="p-6">
                <div className="flex items-start gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className={statusInfo.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusInfo.label}
                            </Badge>
                            <Badge className={priorityInfo.color}>
                                <Flag className="h-3 w-3 mr-1" />
                                {priorityInfo.label}
                            </Badge>
                            {goal.type !== "individual" && (
                                <Badge variant="outline" className="border-border-hover">
                                    {goal.type}
                                </Badge>
                            )}
                        </div>

                        <h3 className="text-lg font-semibold text-foreground mb-1">{goal.title}</h3>
                        {goal.description && (
                            <p className="text-sm text-muted-foreground mb-3">{goal.description}</p>
                        )}

                        {/* Progress */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t('progress')}</span>
                                <span className="text-foreground font-medium">{goal.progress}%</span>
                            </div>
                            <Progress value={goal.progress} className="h-2" />

                            {/* Quick progress buttons */}
                            <div className="flex gap-2 mt-2">
                                {[0, 25, 50, 75, 100].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => updateProgress(p)}
                                        className={cn(
                                            "px-2 py-1 text-xs rounded border transition-all",
                                            goal.progress === p
                                                ? "bg-purple-500/30 border-purple-500 text-purple-300"
                                                : "bg-hover border-card-border text-muted-foreground hover:border-border-hover"
                                        )}
                                    >
                                        {p}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Key Results */}
                        {goal.keyResults.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-card-border">
                                <h4 className="text-sm font-medium text-foreground mb-2">{t('keyResults')}</h4>
                                <div className="space-y-2">
                                    {goal.keyResults.map((kr) => (
                                        <div key={kr.id} className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-muted-foreground">{kr.title}</span>
                                                    <span className="text-foreground">
                                                        {kr.currentValue}/{kr.targetValue} {kr.unit}
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={(kr.currentValue / kr.targetValue) * 100}
                                                    className="h-1.5 mt-1"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center gap-4 mt-4 text-xs text-tertiary-foreground">
                            {goal.dueDate && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {t('due')}: {new Date(goal.dueDate).toLocaleDateString()}
                                </span>
                            )}
                            {goal.reviewCycle && (
                                <span>{t('cycle')}: {goal.reviewCycle.name}</span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
