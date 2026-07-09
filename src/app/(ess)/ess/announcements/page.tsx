"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import {
    Megaphone,
    Clock,
    Loader2,
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    Calendar,
    Flag,
    User,
    Shield,
} from "lucide-react";
import { useEssAnnouncements } from "@/hooks/use-data";

// Maps to Prisma Announcement.type values
const typeConfig: Record<string, { color: string; icon: React.ElementType }> = {
    general: { color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: Megaphone },
    urgent: { color: "bg-red-500/15 text-red-400 border-red-500/20", icon: AlertTriangle },
    celebration: { color: "bg-purple-500/15 text-purple-400 border-purple-500/20", icon: Calendar },
    policy: { color: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: Shield },
};

// Maps to Prisma Announcement.priority values
const priorityConfig: Record<string, { color: string; label: string }> = {
    low: { color: "bg-slate-500/15 text-slate-400 border-slate-500/20", label: "low" },
    medium: { color: "bg-blue-500/15 text-blue-400 border-blue-500/20", label: "medium" },
    high: { color: "bg-orange-500/15 text-orange-400 border-orange-500/20", label: "high" },
    critical: { color: "bg-red-500/15 text-red-400 border-red-500/20", label: "critical" },
};

export default function ESSAnnouncementsPage() {
    const t = useTranslations("ESSAnnouncements");
    const locale = useLocale();
    const dateLocale = locale.startsWith("bn") ? "bn-BD" : "en-US";
    const formatDate = (value: string) => new Intl.DateTimeFormat(dateLocale, { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
    // ── TanStack Query: announcements (active only) ──
    const { data: announcements = [], isLoading: loading } = useEssAnnouncements();
    const [filter, setFilter] = useState<string>("all");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const filtered = filter === "all"
        ? announcements
        : announcements.filter(a => a.type === filter);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const filters = ["all", "general", "urgent", "celebration", "policy"];

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHeader
                title={t("title")}
                subtitle={t("subtitle")}
                icon={Megaphone}
                iconColor="purple"
            />

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                {filters.map(f => (
                    <Button
                        key={f}
                        variant={filter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(f)}
                        className={cn(
                            "rounded-lg text-xs",
                            filter === f && "shadow-md"
                        )}
                    >
                        {t(f as any)}
                    </Button>
                ))}
            </div>

            {/* Announcements list */}
            {filtered.length === 0 ? (
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="py-16 text-center">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                            <Megaphone className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">{t("noAnnouncements")}</h3>
                        <p className="text-muted-foreground text-sm">{t("noAnnouncementsDesc")}</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((announcement) => {
                        const config = typeConfig[announcement.type] || typeConfig.general;
                        const TypeIcon = config.icon;
                        const prioConfig = priorityConfig[announcement.priority] || priorityConfig.medium;
                        const isExpanded = expandedIds.has(announcement.id);
                        const isLong = announcement.content.length > 200;

                        return (
                            <Card key={announcement.id} className={cn(
                                "bg-card-bg border-card-border hover:border-primary/20 transition-colors",
                                announcement.isPinned && "border-l-2 border-l-primary"
                            )}>
                                <CardContent className="p-5">
                                    <div className="flex items-start gap-4">
                                        <div className={cn("p-2.5 rounded-xl shrink-0", config.color.split(" ")[0])}>
                                            <TypeIcon className={cn("h-5 w-5", config.color.split(" ")[1])} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="font-semibold text-foreground">
                                                        {announcement.isPinned && "📌 "}
                                                        {announcement.title}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                                                        {/* Type badge */}
                                                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border", config.color)}>
                                                            {t(announcement.type as any)}
                                                        </span>

                                                        {/* Priority badge — backed by schema */}
                                                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border", prioConfig.color)}>
                                                            <Flag className="h-3 w-3" />
                                                            {t(`priority_${prioConfig.label}` as any)}
                                                        </span>

                                                        {/* Posted date */}
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {t("postedOn")} {formatDate(announcement.publishDate || announcement.createdAt)}
                                                        </span>

                                                        {/* Author — backed by schema relation */}
                                                        {announcement.author && (
                                                            <span className="flex items-center gap-1">
                                                                <User className="h-3 w-3" />
                                                                {t("postedBy")} {announcement.author.firstName} {announcement.author.lastName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className={cn(
                                                "mt-3 text-sm text-muted-foreground leading-relaxed",
                                                !isExpanded && isLong && "line-clamp-3"
                                            )}>
                                                {announcement.content}
                                            </div>

                                            {isLong && (
                                                <button
                                                    onClick={() => toggleExpand(announcement.id)}
                                                    className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            <ChevronUp className="h-3.5 w-3.5" />
                                                            {t("showLess")}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown className="h-3.5 w-3.5" />
                                                            {t("readMore")}
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
