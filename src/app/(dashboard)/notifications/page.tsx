"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Bell,
    Check,
    CheckCheck,
    Calendar,
    DollarSign,
    Users,
    AlertCircle,
    Clock,
    Megaphone,
    Trash2,
    Filter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"

interface Notification {
    id: string
    title: string
    message: string
    type: string
    link?: string
    isRead: boolean
    createdAt: string
}

const typeIcons: Record<string, React.ReactNode> = {
    leave_approval: <Calendar className="h-4 w-4" />,
    leave_request: <Calendar className="h-4 w-4" />,
    payroll: <DollarSign className="h-4 w-4" />,
    attendance: <Clock className="h-4 w-4" />,
    employee: <Users className="h-4 w-4" />,
    announcement: <Megaphone className="h-4 w-4" />,
    alert: <AlertCircle className="h-4 w-4" />,
    default: <Bell className="h-4 w-4" />,
}

const typeColors: Record<string, string> = {
    leave_approval: "from-green-500 to-emerald-600",
    leave_request: "from-blue-500 to-indigo-600",
    payroll: "from-purple-500 to-pink-600",
    attendance: "from-amber-500 to-orange-600",
    employee: "from-cyan-500 to-blue-600",
    announcement: "from-rose-500 to-red-600",
    alert: "from-red-500 to-rose-600",
    default: "from-gray-500 to-slate-600",
}

export default function NotificationsPage() {
    const { addToast } = useToast()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"all" | "unread">("all")

    const fetchNotifications = useCallback(async () => {
        try {
            const url = filter === "unread"
                ? "/api/notifications?unread=true&limit=100"
                : "/api/notifications?limit=100"
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setNotifications(data.notifications || [])
            }
        } catch (error) {
            console.error("Failed to fetch notifications", error)
        } finally {
            setLoading(false)
        }
    }, [filter])

    useEffect(() => {
        fetchNotifications()
    }, [fetchNotifications])

    const markAsRead = async (notificationId?: string) => {
        try {
            await fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    notificationId
                        ? { notificationIds: [notificationId] }
                        : { markAll: true }
                ),
            })
            fetchNotifications()
            addToast({
                title: "Success",
                description: notificationId ? "Marked as read" : "All notifications marked as read",
                type: "success",
            })
        } catch (error) {
            addToast({
                title: "Error",
                description: "Failed to update notifications",
                type: "error",
            })
        }
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins} minutes ago`
        if (diffHours < 24) return `${diffHours} hours ago`
        if (diffDays < 7) return `${diffDays} days ago`
        return date.toLocaleDateString()
    }

    const unreadCount = notifications.filter(n => !n.isRead).length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">Notifications</h1>
                    <p className="text-white/60 mt-1">
                        Stay updated with your organization activities
                    </p>
                </div>
                {unreadCount > 0 && (
                    <Button
                        onClick={() => markAsRead()}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600"
                    >
                        <CheckCheck className="h-4 w-4 mr-2" />
                        Mark all as read
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
                <div className="flex items-center justify-between">
                    <TabsList className="bg-white/5 border-white/10">
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="unread">
                            Unread
                            {unreadCount > 0 && (
                                <Badge variant="danger" className="ml-2">
                                    {unreadCount}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="all" className="mt-4">
                    <NotificationList
                        notifications={notifications}
                        loading={loading}
                        onMarkRead={markAsRead}
                        formatTime={formatTime}
                    />
                </TabsContent>

                <TabsContent value="unread" className="mt-4">
                    <NotificationList
                        notifications={notifications.filter(n => !n.isRead)}
                        loading={loading}
                        onMarkRead={markAsRead}
                        formatTime={formatTime}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function NotificationList({
    notifications,
    loading,
    onMarkRead,
    formatTime,
}: {
    notifications: Notification[]
    loading: boolean
    onMarkRead: (id?: string) => void
    formatTime: (date: string) => string
}) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-white/20 border-t-white rounded-full" />
            </div>
        )
    }

    if (notifications.length === 0) {
        return (
            <Card className="bg-[#12121A] border-white/10">
                <CardContent className="py-16 text-center">
                    <Bell className="h-12 w-12 mx-auto text-white/20 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">
                        No notifications
                    </h3>
                    <p className="text-white/40">
                        You're all caught up! New notifications will appear here.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-3">
            {notifications.map((notification) => (
                <Card
                    key={notification.id}
                    className={cn(
                        "bg-[#12121A] border-white/10 overflow-hidden transition-all",
                        "hover:border-white/20 cursor-pointer",
                        !notification.isRead && "border-l-2 border-l-blue-500"
                    )}
                    onClick={() => {
                        if (!notification.isRead) {
                            onMarkRead(notification.id)
                        }
                        if (notification.link) {
                            window.location.href = notification.link
                        }
                    }}
                >
                    <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className={cn(
                                "p-3 rounded-xl bg-gradient-to-br shrink-0",
                                typeColors[notification.type] || typeColors.default
                            )}>
                                {typeIcons[notification.type] || typeIcons.default}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h4 className={cn(
                                            "font-medium",
                                            notification.isRead ? "text-white/60" : "text-white"
                                        )}>
                                            {notification.title}
                                        </h4>
                                        <p className="text-sm text-white/40 mt-1">
                                            {notification.message}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-white/30">
                                            {formatTime(notification.createdAt)}
                                        </span>
                                        {!notification.isRead && (
                                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
