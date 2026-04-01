"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
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
    X
} from "lucide-react"
import { cn } from "@/lib/utils"

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

export function NotificationCenter() {
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications?limit=10")
            if (res.ok) {
                const data = await res.json()
                setNotifications(data.notifications || [])
                setUnreadCount(data.unreadCount || 0)
            }
        } catch {
            // Silent — notification bell gracefully shows 0 when API is unavailable
        }
    }, [])

    useEffect(() => {
        fetchNotifications()
        // Poll every 30 seconds
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
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
        } catch {
            // Silent — marking as read can fail gracefully
        }
    }

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            markAsRead(notification.id)
        }
        if (notification.link) {
            window.location.href = notification.link
        }
        setOpen(false)
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return "Just now"
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative text-muted-foreground hover:text-foreground hover:bg-hover"
                >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-xs text-foreground flex items-center justify-center font-medium">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-96 p-0 bg-card border-card-border"
                align="end"
                sideOffset={8}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-card-border">
                    <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-foreground" />
                        <h3 className="font-semibold text-foreground">Notifications</h3>
                        {unreadCount > 0 && (
                            <Badge variant="danger" className="ml-1">
                                {unreadCount}
                            </Badge>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead()}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            <CheckCheck className="h-4 w-4 mr-1" />
                            Mark all read
                        </Button>
                    )}
                </div>

                {/* Notifications List */}
                <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                            <Bell className="h-10 w-10 mx-auto text-muted-text mb-3" />
                            <p className="text-muted-foreground">No notifications yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={cn(
                                        "flex items-start gap-3 p-4 cursor-pointer transition-colors",
                                        "hover:bg-hover",
                                        !notification.isRead && "bg-hover"
                                    )}
                                >
                                    {/* Icon */}
                                    <div className={cn(
                                        "p-2 rounded-lg bg-linear-to-br shrink-0",
                                        typeColors[notification.type] || typeColors.default
                                    )}>
                                        {typeIcons[notification.type] || typeIcons.default}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={cn(
                                                "text-sm truncate",
                                                notification.isRead ? "text-muted-foreground" : "text-foreground font-medium"
                                            )}>
                                                {notification.title}
                                            </p>
                                            {!notification.isRead && (
                                                <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                                            )}
                                        </div>
                                        <p className="text-xs text-tertiary-foreground line-clamp-2 mt-0.5">
                                            {notification.message}
                                        </p>
                                        <p className="text-xs text-muted-text mt-1">
                                            {formatTime(notification.createdAt)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                    <div className="p-3 border-t border-card-border">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-muted-foreground hover:text-foreground text-xs"
                            onClick={() => {
                                window.location.href = "/notifications"
                                setOpen(false)
                            }}
                        >
                            View all notifications
                        </Button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
