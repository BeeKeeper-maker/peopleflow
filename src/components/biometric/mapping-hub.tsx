"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Fingerprint,
    CheckCircle2,
    XCircle,
    Loader2,
    Users,
    Link2,
    Unlink,
    Wand2,
    ArrowRight,
    AlertTriangle,
    Sparkles,
    ShieldCheck,
    Search,
    ChevronDown,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

interface MappingSuggestion {
    deviceUserId: string;
    deviceUserName: string;
    matchType: "exact" | "code" | "name" | "none";
    confidence: number;
    employee: {
        id: string;
        name: string;
        code: string;
        department?: string;
        designation?: string;
    } | null;
}

interface AvailableEmployee {
    id: string;
    name: string;
    code: string;
    department?: string;
}

interface MappingHubProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    deviceId: string;
    deviceName: string;
    deviceModel: string;
}

// ── Component ────────────────────────────────────────────────────────

export function BiometricMappingHub({
    open,
    onOpenChange,
    deviceId,
    deviceName,
    deviceModel,
}: MappingHubProps) {
    const t = useTranslations("Devices");
    const { addToast } = useToast();

    const [loading, setLoading] = useState(false);
    const [applying, setApplying] = useState(false);
    const [suggestions, setSuggestions] = useState<MappingSuggestion[]>([]);
    const [availableEmployees, setAvailableEmployees] = useState<AvailableEmployee[]>([]);
    const [manualMappings, setManualMappings] = useState<Record<string, string>>({});
    const [hasFetched, setHasFetched] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"all" | "mapped" | "unmapped" | "suggested">("all");

    // ── Fetch Device Users & Get Suggestions ──────────────────────

    const fetchAndAnalyze = useCallback(async () => {
        setLoading(true);
        setHasFetched(false);

        try {
            // Step 1: Get users from device
            const usersRes = await fetch(`/api/biometric-devices/${deviceId}/users`, {
                method: "GET",
            });

            if (!usersRes.ok) {
                throw new Error("Failed to fetch device users");
            }

            const usersData = await usersRes.json();

            if (!usersData.success) {
                addToast({
                    title: usersData.message || "Failed to connect to device",
                    type: "error",
                });
                setLoading(false);
                return;
            }

            if (!usersData.users || usersData.users.length === 0) {
                setSuggestions([]);
                setAvailableEmployees([]);
                setHasFetched(true);
                setLoading(false);
                return;
            }

            // Step 2: Get auto-mapping suggestions
            const mapRes = await fetch("/api/biometric-devices/auto-map", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deviceUsers: usersData.users.map((u: { userId: string; name: string }) => ({
                        userId: u.userId,
                        name: u.name,
                    })),
                }),
            });

            if (!mapRes.ok) {
                throw new Error("Failed to analyze mappings");
            }

            const mapData = await mapRes.json();
            setSuggestions(mapData.suggestions || []);
            setAvailableEmployees(mapData.availableEmployees || []);
            setManualMappings({});
            setHasFetched(true);
        } catch (error) {
            console.error("Mapping hub error:", error);
            addToast({
                title: error instanceof Error ? error.message : "Failed to analyze device",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    }, [deviceId, addToast]);

    // ── Apply Mappings ────────────────────────────────────────────

    const applyMappings = useCallback(async () => {
        // Collect all mappings to apply:
        // 1. Confirmed suggestions (code/name matches)
        // 2. Manual selections
        const mappingsToApply: { deviceUserId: string; employeeId: string }[] = [];

        for (const suggestion of suggestions) {
            // Skip already-mapped (exact match)
            if (suggestion.matchType === "exact") continue;

            // Check if user manually selected an employee
            const manualId = manualMappings[suggestion.deviceUserId];
            if (manualId) {
                mappingsToApply.push({
                    deviceUserId: suggestion.deviceUserId,
                    employeeId: manualId,
                });
                continue;
            }

            // Auto-apply high-confidence suggestions (code match = 90+, name match = 80+)
            if (
                suggestion.employee &&
                ((suggestion.matchType === "code" && suggestion.confidence >= 90) ||
                    (suggestion.matchType === "name" && suggestion.confidence >= 80))
            ) {
                mappingsToApply.push({
                    deviceUserId: suggestion.deviceUserId,
                    employeeId: suggestion.employee.id,
                });
            }
        }

        if (mappingsToApply.length === 0) {
            addToast({ title: "No mappings to apply", type: "info" });
            return;
        }

        setApplying(true);
        try {
            const res = await fetch("/api/biometric-devices/auto-map", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mappings: mappingsToApply }),
            });

            const data = await res.json();

            if (data.success) {
                addToast({
                    title: `✅ ${t("mappingApplied")} — ${data.applied}/${data.total}`,
                    type: "success",
                });
                // Refresh data
                await fetchAndAnalyze();
            } else {
                addToast({ title: t("mappingFailed"), type: "error" });
            }
        } catch {
            addToast({ title: t("mappingFailed"), type: "error" });
        } finally {
            setApplying(false);
        }
    }, [suggestions, manualMappings, addToast, t, fetchAndAnalyze]);

    // ── Derived Data ──────────────────────────────────────────────

    const stats = useMemo(() => {
        const mapped = suggestions.filter((s) => s.matchType === "exact").length;
        const suggested = suggestions.filter(
            (s) => s.matchType === "code" || s.matchType === "name"
        ).length;
        const unmapped = suggestions.filter((s) => s.matchType === "none").length;
        return { total: suggestions.length, mapped, suggested, unmapped };
    }, [suggestions]);

    const filteredSuggestions = useMemo(() => {
        let list = suggestions;

        // Apply type filter
        if (filterType === "mapped")
            list = list.filter((s) => s.matchType === "exact");
        else if (filterType === "unmapped")
            list = list.filter((s) => s.matchType === "none");
        else if (filterType === "suggested")
            list = list.filter((s) => s.matchType === "code" || s.matchType === "name");

        // Apply search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (s) =>
                    s.deviceUserName.toLowerCase().includes(q) ||
                    s.deviceUserId.includes(q) ||
                    s.employee?.name.toLowerCase().includes(q) ||
                    s.employee?.code.toLowerCase().includes(q)
            );
        }

        return list;
    }, [suggestions, filterType, searchQuery]);

    const pendingMappingsCount = useMemo(() => {
        let count = 0;
        for (const s of suggestions) {
            if (s.matchType === "exact") continue;
            if (manualMappings[s.deviceUserId]) {
                count++;
                continue;
            }
            if (
                s.employee &&
                ((s.matchType === "code" && s.confidence >= 90) ||
                    (s.matchType === "name" && s.confidence >= 80))
            ) {
                count++;
            }
        }
        return count;
    }, [suggestions, manualMappings]);

    // ── Render Helpers ────────────────────────────────────────────

    const getMatchBadge = (matchType: string, confidence: number) => {
        switch (matchType) {
            case "exact":
                return (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 gap-1 text-xs">
                        <ShieldCheck className="h-3 w-3" />
                        {t("alreadyLinked")}
                    </Badge>
                );
            case "code":
                return (
                    <Badge className="bg-blue-500/15 text-blue-400 border border-blue-500/25 gap-1 text-xs">
                        <Sparkles className="h-3 w-3" />
                        {t("codeMatch")} · {confidence}%
                    </Badge>
                );
            case "name":
                return (
                    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/25 gap-1 text-xs">
                        <Wand2 className="h-3 w-3" />
                        {t("nameMatch")} · {confidence}%
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-red-500/15 text-red-400 border border-red-500/25 gap-1 text-xs">
                        <Unlink className="h-3 w-3" />
                        {t("noMatch")}
                    </Badge>
                );
        }
    };

    // ── Render ─────────────────────────────────────────────────────

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden bg-card border-card-border flex flex-col">
                <DialogHeader className="border-b border-card-border pb-4">
                    <DialogTitle className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-linear-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20">
                            <Fingerprint className="h-5 w-5 text-violet-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">
                                {t("mappingHub")}
                            </h2>
                            <p className="text-xs text-muted-foreground font-normal">
                                {deviceName} · {deviceModel}
                            </p>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {/* ── Initial State: Fetch Button ──────────────── */}
                    {!hasFetched && !loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="w-20 h-20 rounded-2xl bg-linear-to-br from-violet-500/10 to-blue-500/10 border border-violet-500/20 flex items-center justify-center">
                                <Users className="h-10 w-10 text-violet-400/60" />
                            </div>
                            <div className="text-center max-w-sm">
                                <h3 className="text-lg font-semibold text-foreground mb-1">
                                    {t("deviceUsers")}
                                </h3>
                                <p className="text-sm text-muted-foreground mb-6">
                                    {t("connectFirst")}
                                </p>
                            </div>
                            <Button
                                onClick={fetchAndAnalyze}
                                className="bg-linear-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white shadow-lg shadow-violet-500/20 gap-2 px-6"
                            >
                                <Fingerprint className="h-4 w-4" />
                                {t("viewDeviceUsers")}
                            </Button>
                        </div>
                    )}

                    {/* ── Loading State ─────────────────────────────── */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center animate-pulse">
                                    <Fingerprint className="h-8 w-8 text-violet-400" />
                                </div>
                                <Loader2 className="absolute -bottom-1 -right-1 h-6 w-6 text-blue-400 animate-spin" />
                            </div>
                            <p className="text-sm text-muted-foreground animate-pulse">
                                {t("fetchingUsers")}
                            </p>
                        </div>
                    )}

                    {/* ── Results ───────────────────────────────────── */}
                    {hasFetched && !loading && (
                        <div className="space-y-4 py-4">
                            {/* Summary Stats */}
                            {suggestions.length > 0 && (
                                <>
                                    <div className="grid grid-cols-4 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setFilterType("all")}
                                            className={cn(
                                                "rounded-xl p-3 text-center transition-all duration-200 border cursor-pointer",
                                                filterType === "all"
                                                    ? "bg-violet-500/10 border-violet-500/30 ring-1 ring-violet-500/20"
                                                    : "bg-hover border-card-border hover:border-violet-500/20"
                                            )}
                                        >
                                            <p className="text-xl font-bold text-foreground">{stats.total}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Total</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFilterType("mapped")}
                                            className={cn(
                                                "rounded-xl p-3 text-center transition-all duration-200 border cursor-pointer",
                                                filterType === "mapped"
                                                    ? "bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500/20"
                                                    : "bg-hover border-card-border hover:border-emerald-500/20"
                                            )}
                                        >
                                            <p className="text-xl font-bold text-emerald-400">{stats.mapped}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{t("mappedUsers")}</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFilterType("suggested")}
                                            className={cn(
                                                "rounded-xl p-3 text-center transition-all duration-200 border cursor-pointer",
                                                filterType === "suggested"
                                                    ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20"
                                                    : "bg-hover border-card-border hover:border-blue-500/20"
                                            )}
                                        >
                                            <p className="text-xl font-bold text-blue-400">{stats.suggested}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{t("suggestedMatch")}</p>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFilterType("unmapped")}
                                            className={cn(
                                                "rounded-xl p-3 text-center transition-all duration-200 border cursor-pointer",
                                                filterType === "unmapped"
                                                    ? "bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20"
                                                    : "bg-hover border-card-border hover:border-red-500/20"
                                            )}
                                        >
                                            <p className="text-xl font-bold text-red-400">{stats.unmapped}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{t("unmappedUsers")}</p>
                                        </button>
                                    </div>

                                    {/* All Mapped Banner */}
                                    {stats.unmapped === 0 && stats.suggested === 0 && (
                                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                                            <div>
                                                <p className="text-sm font-medium text-emerald-300">{t("allMapped")}</p>
                                                <p className="text-xs text-emerald-400/70">{t("allMappedDesc")}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Orphan Warning */}
                                    {stats.unmapped > 0 && (
                                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
                                            <p className="text-sm text-amber-300">
                                                <span className="font-semibold">{stats.unmapped}</span>{" "}
                                                {t("orphanedWarning")}
                                            </p>
                                        </div>
                                    )}

                                    {/* Search Bar */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Search users..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full h-9 pl-9 pr-3 rounded-lg bg-hover border border-card-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 transition-all"
                                        />
                                    </div>

                                    {/* User List */}
                                    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                                        {filteredSuggestions.map((suggestion) => (
                                            <MappingRow
                                                key={suggestion.deviceUserId}
                                                suggestion={suggestion}
                                                availableEmployees={availableEmployees}
                                                manualMapping={manualMappings[suggestion.deviceUserId]}
                                                onManualMap={(employeeId) =>
                                                    setManualMappings((prev) => ({
                                                        ...prev,
                                                        [suggestion.deviceUserId]: employeeId,
                                                    }))
                                                }
                                                getMatchBadge={getMatchBadge}
                                                t={t}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Empty device */}
                            {suggestions.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 gap-3">
                                    <XCircle className="h-12 w-12 text-muted-foreground/30" />
                                    <p className="text-sm text-muted-foreground">{t("noUsersOnDevice")}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Footer Actions ─────────────────────────────── */}
                {hasFetched && suggestions.length > 0 && (
                    <div className="border-t border-card-border pt-4 flex items-center justify-between gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchAndAnalyze}
                            disabled={loading}
                            className="gap-2"
                        >
                            <Fingerprint className="h-3.5 w-3.5" />
                            Refresh
                        </Button>
                        <div className="flex items-center gap-2">
                            {pendingMappingsCount > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    {pendingMappingsCount} pending
                                </span>
                            )}
                            <Button
                                onClick={applyMappings}
                                disabled={applying || pendingMappingsCount === 0}
                                className="bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-lg shadow-emerald-500/20 gap-2"
                            >
                                {applying ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Link2 className="h-4 w-4" />
                                )}
                                {applying ? t("applying") : t("applyMappings")}
                                {pendingMappingsCount > 0 && (
                                    <Badge className="bg-white/20 text-white border-0 text-[10px] ml-1">
                                        {pendingMappingsCount}
                                    </Badge>
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Individual Mapping Row ──────────────────────────────────────────

interface MappingRowProps {
    suggestion: MappingSuggestion;
    availableEmployees: AvailableEmployee[];
    manualMapping?: string;
    onManualMap: (employeeId: string) => void;
    getMatchBadge: (matchType: string, confidence: number) => React.ReactNode;
    t: ReturnType<typeof useTranslations>;
}

function MappingRow({
    suggestion,
    availableEmployees,
    manualMapping,
    onManualMap,
    getMatchBadge,
    t,
}: MappingRowProps) {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [searchFilter, setSearchFilter] = useState("");

    const isExact = suggestion.matchType === "exact";
    const hasSuggestion = suggestion.employee && !isExact;
    const hasManualOverride = !!manualMapping;

    const effectiveEmployee = hasManualOverride
        ? availableEmployees.find((e) => e.id === manualMapping)
        : suggestion.employee;

    const filteredEmployees = useMemo(() => {
        if (!searchFilter) return availableEmployees;
        const q = searchFilter.toLowerCase();
        return availableEmployees.filter(
            (e) =>
                e.name.toLowerCase().includes(q) ||
                e.code.toLowerCase().includes(q) ||
                e.department?.toLowerCase().includes(q)
        );
    }, [availableEmployees, searchFilter]);

    return (
        <Card
            className={cn(
                "transition-all duration-200 border",
                isExact
                    ? "bg-emerald-500/5 border-emerald-500/15"
                    : hasSuggestion || hasManualOverride
                        ? "bg-blue-500/5 border-blue-500/15"
                        : "bg-card border-card-border"
            )}
        >
            <CardContent className="p-3">
                <div className="flex items-center gap-3">
                    {/* Device User Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <div
                                className={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold shrink-0",
                                    isExact
                                        ? "bg-emerald-500/15 text-emerald-400"
                                        : "bg-violet-500/15 text-violet-400"
                                )}
                            >
                                {suggestion.deviceUserId}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {suggestion.deviceUserName}
                                </p>
                                <div className="mt-0.5">
                                    {getMatchBadge(suggestion.matchType, suggestion.confidence)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Arrow */}
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />

                    {/* Employee Mapping */}
                    <div className="flex-1 min-w-0">
                        {isExact && suggestion.employee && (
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-emerald-300 truncate">
                                        {suggestion.employee.name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {suggestion.employee.code}
                                        {suggestion.employee.department && ` · ${suggestion.employee.department}`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {!isExact && (hasSuggestion || hasManualOverride) && effectiveEmployee && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="w-full flex items-center gap-2 p-1.5 rounded-lg bg-hover border border-card-border hover:border-blue-500/30 transition-all cursor-pointer text-left"
                                >
                                    <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-foreground truncate">
                                            {effectiveEmployee.name}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                            {effectiveEmployee.code}
                                        </p>
                                    </div>
                                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                </button>

                                {/* Dropdown */}
                                {dropdownOpen && (
                                    <EmployeeDropdown
                                        employees={filteredEmployees}
                                        searchFilter={searchFilter}
                                        onSearchChange={setSearchFilter}
                                        onSelect={(id) => {
                                            onManualMap(id);
                                            setDropdownOpen(false);
                                        }}
                                        onClose={() => setDropdownOpen(false)}
                                        t={t}
                                    />
                                )}
                            </div>
                        )}

                        {!isExact && !hasSuggestion && !hasManualOverride && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="w-full flex items-center gap-2 p-1.5 rounded-lg border border-dashed border-card-border hover:border-violet-500/30 transition-all cursor-pointer bg-transparent"
                                >
                                    <Unlink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="text-xs text-muted-foreground">
                                        {t("selectEmployee")}
                                    </span>
                                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
                                </button>

                                {/* Dropdown */}
                                {dropdownOpen && (
                                    <EmployeeDropdown
                                        employees={filteredEmployees}
                                        searchFilter={searchFilter}
                                        onSearchChange={setSearchFilter}
                                        onSelect={(id) => {
                                            onManualMap(id);
                                            setDropdownOpen(false);
                                        }}
                                        onClose={() => setDropdownOpen(false)}
                                        t={t}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ── Employee Dropdown ───────────────────────────────────────────────

interface EmployeeDropdownProps {
    employees: AvailableEmployee[];
    searchFilter: string;
    onSearchChange: (value: string) => void;
    onSelect: (employeeId: string) => void;
    onClose: () => void;
    t: ReturnType<typeof useTranslations>;
}

function EmployeeDropdown({
    employees,
    searchFilter,
    onSearchChange,
    onSelect,
    onClose,
    t,
}: EmployeeDropdownProps) {
    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={onClose} />

            {/* Dropdown Panel */}
            <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-card border border-card-border shadow-xl shadow-black/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search */}
                <div className="p-2 border-b border-card-border">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={`${t("selectEmployee")}...`}
                            value={searchFilter}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 rounded-lg bg-hover border border-card-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                            autoFocus
                        />
                    </div>
                </div>

                {/* List */}
                <div className="max-h-40 overflow-y-auto">
                    {employees.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                            No employees available
                        </p>
                    ) : (
                        employees.map((emp) => (
                            <button
                                key={emp.id}
                                type="button"
                                onClick={() => onSelect(emp.id)}
                                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-hover text-left transition-colors"
                            >
                                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-500/10 text-violet-400 text-[10px] font-bold shrink-0">
                                    {emp.code.replace(/\D/g, "").slice(-2) || "—"}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-foreground truncate">
                                        {emp.name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                        {emp.code}
                                        {emp.department && ` · ${emp.department}`}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
