"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
// useCallback kept for useToasts hook
import {
    Search,
    Filter,
    Mail,
    Phone,
    Building2,
    Users,
    Clock,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Globe,
    MessageSquare,
    X,
    Trash2,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
} from "lucide-react";
import { updateLeadStatus, deleteLead } from "../actions";

// ── Types ────────────────────────────────────────────────────────
interface Lead {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    companyName: string;
    companySize: string;
    sector: string;
    message: string | null;
    source: string;
    status: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    createdAt: string;
    updatedAt: string;
}

interface LeadsCRMTableProps {
    leads: Lead[];
    pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
    };
}

type SortField = "createdAt" | "name" | "companyName" | "status";
type SortDir = "asc" | "desc";

// ══════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ══════════════════════════════════════════════════════════════════

interface Toast {
    id: string;
    type: "success" | "error";
    message: string;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
                        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl
                        shadow-[0_8px_32px_rgba(0,0,0,0.4)] min-w-[300px] max-w-[420px]
                        animate-[toastSlideIn_0.3s_ease-out]
                        ${toast.type === "success"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                            : "bg-red-500/10 border-red-500/20 text-red-300"
                        }
                    `}
                >
                    {toast.type === "success"
                        ? <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-400" />
                        : <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-400" />
                    }
                    <p className="text-sm font-medium flex-1">{toast.message}</p>
                    <button
                        onClick={() => onDismiss(toast.id)}
                        className="p-1 rounded-md hover:bg-white/[0.08] text-white/40 hover:text-white/80 transition-colors shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}

function useToasts() {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((type: "success" | "error", message: string) => {
        const id = crypto.randomUUID();
        setToasts((prev) => [...prev, { id, type, message }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return { toasts, addToast, dismissToast };
}

// ══════════════════════════════════════════════════════════════════
// DELETE CONFIRMATION MODAL
// ══════════════════════════════════════════════════════════════════

function DeleteConfirmModal({
    lead,
    onConfirm,
    onCancel,
    isPending,
}: {
    lead: Lead;
    onConfirm: () => void;
    onCancel: () => void;
    isPending: boolean;
}) {
    // Close on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape" && !isPending) onCancel();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onCancel, isPending]);

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
                onClick={!isPending ? onCancel : undefined}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm rounded-2xl bg-[#141419] border border-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)] animate-[modalPop_0.2s_ease-out] overflow-hidden">
                {/* Danger Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-gradient-to-b from-red-500/15 to-transparent rounded-full blur-2xl pointer-events-none" />

                <div className="relative p-6 space-y-5">
                    {/* Icon */}
                    <div className="flex justify-center">
                        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-[0_0_20px_-4px_rgba(239,68,68,0.3)]">
                            <AlertTriangle className="w-7 h-7 text-red-400" />
                        </div>
                    </div>

                    {/* Text */}
                    <div className="text-center space-y-2">
                        <h3 className="text-lg font-bold text-white">Delete Lead</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Permanently delete <span className="text-white font-medium">{lead.name}</span> from{" "}
                            <span className="text-zinc-300">{lead.companyName}</span>? This action cannot be undone.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={onCancel}
                            disabled={isPending}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]
                                       text-sm text-zinc-400 font-medium
                                       hover:bg-white/[0.07] hover:text-white
                                       disabled:opacity-40 disabled:cursor-not-allowed
                                       transition-all duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isPending}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 border border-red-500/30
                                       text-sm text-white font-semibold
                                       hover:bg-red-500 hover:shadow-[0_0_20px_-3px_rgba(239,68,68,0.5)]
                                       disabled:opacity-50 disabled:cursor-wait
                                       active:scale-[0.98] transition-all duration-200"
                        >
                            {isPending ? "Deleting..." : "Delete Permanently"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// STATUS CONFIG & LABELS
// ══════════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<
    string,
    { label: string; bg: string; text: string; dot: string; border: string; glow: string }
> = {
    new: {
        label: "New",
        bg: "bg-blue-500/12",
        text: "text-blue-400",
        dot: "bg-blue-400",
        border: "border-blue-500/25",
        glow: "hover:shadow-[0_0_12px_-2px_rgba(59,130,246,0.4)]",
    },
    contacted: {
        label: "Contacted",
        bg: "bg-amber-500/12",
        text: "text-amber-400",
        dot: "bg-amber-400",
        border: "border-amber-500/25",
        glow: "hover:shadow-[0_0_12px_-2px_rgba(245,158,11,0.4)]",
    },
    qualified: {
        label: "Qualified",
        bg: "bg-purple-500/12",
        text: "text-purple-400",
        dot: "bg-purple-400",
        border: "border-purple-500/25",
        glow: "hover:shadow-[0_0_12px_-2px_rgba(168,85,247,0.4)]",
    },
    demo_scheduled: {
        label: "Demo Scheduled",
        bg: "bg-cyan-500/12",
        text: "text-cyan-400",
        dot: "bg-cyan-400",
        border: "border-cyan-500/25",
        glow: "hover:shadow-[0_0_12px_-2px_rgba(6,182,212,0.4)]",
    },
    converted: {
        label: "Converted",
        bg: "bg-emerald-500/12",
        text: "text-emerald-400",
        dot: "bg-emerald-400",
        border: "border-emerald-500/25",
        glow: "hover:shadow-[0_0_12px_-2px_rgba(16,185,129,0.4)]",
    },
    lost: {
        label: "Lost",
        bg: "bg-red-500/12",
        text: "text-red-400",
        dot: "bg-red-400",
        border: "border-red-500/25",
        glow: "hover:shadow-[0_0_12px_-2px_rgba(239,68,68,0.4)]",
    },
};

const STATUS_ORDER: Record<string, number> = {
    new: 0, contacted: 1, qualified: 2, demo_scheduled: 3, converted: 4, lost: 5,
};

const SECTOR_LABELS: Record<string, string> = {
    rmg: "RMG / Garments",
    corporate: "Corporate",
    ngo: "NGO",
    other: "Other",
};

const SIZE_LABELS: Record<string, string> = {
    "1-50": "1–50",
    "51-200": "51–200",
    "201-500": "201–500",
    "500+": "500+",
};

// ══════════════════════════════════════════════════════════════════
// STATUS BADGE (Click-to-Edit)
// ══════════════════════════════════════════════════════════════════

function StatusBadge({
    lead,
    isOpen,
    onToggle,
    onToast,
}: {
    lead: Lead;
    isOpen: boolean;
    onToggle: () => void;
    onToast: (type: "success" | "error", msg: string) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const dropdownRef = useRef<HTMLDivElement>(null);

    const config = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                onToggle();
            }
        }
        function handleEscape(e: KeyboardEvent) {
            if (e.key === "Escape") onToggle();
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleEscape);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
                document.removeEventListener("keydown", handleEscape);
            };
        }
    }, [isOpen, onToggle]);

    function handleStatusChange(newStatus: string) {
        if (newStatus === lead.status) {
            onToggle();
            return;
        }

        const oldLabel = STATUS_CONFIG[lead.status]?.label || lead.status;
        const newLabel = STATUS_CONFIG[newStatus]?.label || newStatus;

        startTransition(async () => {
            const result = await updateLeadStatus(lead.id, newStatus);
            onToggle();
            if (result.error) {
                onToast("error", result.error);
            } else {
                onToast("success", `${lead.name}: ${oldLabel} → ${newLabel}`);
            }
        });
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={onToggle}
                disabled={isPending}
                className={`
                    inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                    border transition-all duration-200 cursor-pointer select-none
                    ${config.bg} ${config.text} ${config.border} ${config.glow}
                    ${isPending ? "opacity-50 cursor-wait" : "hover:scale-[1.03] active:scale-[0.98]"}
                `}
            >
                <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${lead.status === "new" ? "animate-pulse" : ""}`} />
                {isPending ? "Updating..." : config.label}
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Status dropdown */}
            {isOpen && (
                <div
                    className="absolute top-full left-0 mt-1.5 w-48 py-1.5 z-[200]
                               rounded-xl border border-white/[0.08] bg-[#141419]
                               shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.05)]
                               animate-fade-in"
                >
                    <p className="px-3 py-1.5 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                        Update Status
                    </p>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                        <button
                            key={key}
                            onClick={() => handleStatusChange(key)}
                            className={`
                                w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-all duration-150
                                ${key === lead.status
                                    ? `${cfg.bg} ${cfg.text} font-medium`
                                    : "text-zinc-400 hover:text-white hover:bg-white/[0.04]"
                                }
                            `}
                        >
                            <span className={`w-2 h-2 rounded-full ${cfg.dot} ${key === lead.status ? "ring-2 ring-offset-1 ring-offset-[#141419]" : "opacity-50"}`}
                                style={key === lead.status ? { boxShadow: `0 0 6px currentColor` } : {}}
                            />
                            {cfg.label}
                            {key === lead.status && (
                                <span className="ml-auto text-[10px] opacity-50">current</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ══════════════════════════════════════════════════════════════════

function LeadDetailDrawer({
    lead,
    onClose,
    onToast,
}: {
    lead: Lead;
    onClose: () => void;
    onToast: (type: "success" | "error", msg: string) => void;
}) {
    const [drawerDropdownOpen, setDrawerDropdownOpen] = useState(false);

    // Close on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />
            {/* Panel */}
            <div
                className="relative w-full max-w-md bg-[#0E0E16] border-l border-white/[0.06] h-full overflow-y-auto
                           animate-slide-in-right"
                style={{
                    animation: "slideInRight 0.25s ease-out",
                }}
            >
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[#0E0E16]/95 backdrop-blur-md border-b border-white/[0.06] px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Lead Details</h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Identity */}
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-600/20 border border-indigo-500/20 flex items-center justify-center">
                            <span className="text-xl font-bold text-indigo-400">
                                {lead.name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-white font-semibold text-lg">{lead.name}</h3>
                            <p className="text-sm text-zinc-500">{lead.companyName}</p>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-600">Pipeline Status</span>
                        <StatusBadge
                            lead={lead}
                            isOpen={drawerDropdownOpen}
                            onToggle={() => setDrawerDropdownOpen(!drawerDropdownOpen)}
                            onToast={onToast}
                        />
                    </div>

                    {/* Contact Info */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                        <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Contact</h4>
                        <div className="flex items-center gap-3 text-sm">
                            <Mail className="w-4 h-4 text-zinc-600" />
                            <a href={`mailto:${lead.email}`} className="text-indigo-400 hover:text-indigo-300 transition-colors">
                                {lead.email}
                            </a>
                        </div>
                        {lead.phone && (
                            <div className="flex items-center gap-3 text-sm">
                                <Phone className="w-4 h-4 text-zinc-600" />
                                <a href={`tel:${lead.phone}`} className="text-zinc-300 hover:text-white transition-colors">
                                    {lead.phone}
                                </a>
                            </div>
                        )}
                    </div>

                    {/* Company Info */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                        <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Company</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Sector</p>
                                <p className="text-sm text-zinc-300 mt-0.5">{SECTOR_LABELS[lead.sector] || lead.sector}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Size</p>
                                <p className="text-sm text-zinc-300 mt-0.5">{SIZE_LABELS[lead.companySize] || lead.companySize} employees</p>
                            </div>
                        </div>
                    </div>

                    {/* Message */}
                    {lead.message && (
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
                            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Message</h4>
                            <p className="text-sm text-zinc-300 leading-relaxed">{lead.message}</p>
                        </div>
                    )}

                    {/* Source & UTM */}
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                        <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Acquisition</h4>
                        <div className="flex items-center gap-3 text-sm">
                            <Globe className="w-4 h-4 text-zinc-600" />
                            <span className="text-zinc-300">{lead.source}</span>
                        </div>
                        {(lead.utmSource || lead.utmMedium || lead.utmCampaign) && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {lead.utmSource && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                                        src: {lead.utmSource}
                                    </span>
                                )}
                                {lead.utmMedium && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                                        med: {lead.utmMedium}
                                    </span>
                                )}
                                {lead.utmCampaign && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                                        cmp: {lead.utmCampaign}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Timestamps */}
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Created {new Date(lead.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}} />
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// SORTABLE COLUMN HEADER
// ══════════════════════════════════════════════════════════════════

function SortableHeader({
    label,
    field,
    currentSort,
    currentDir,
    onSort,
    icon,
}: {
    label: string;
    field: SortField;
    currentSort: SortField;
    currentDir: SortDir;
    onSort: (field: SortField) => void;
    icon?: React.ReactNode;
}) {
    const isActive = currentSort === field;

    return (
        <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-white/[0.02]">
            <button
                onClick={() => onSort(field)}
                className={`
                    flex items-center gap-1.5 transition-colors duration-150
                    ${isActive ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"}
                `}
            >
                {icon}
                {label}
                {isActive ? (
                    currentDir === "asc"
                        ? <ArrowUp className="w-3 h-3" />
                        : <ArrowDown className="w-3 h-3" />
                ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                )}
            </button>
        </th>
    );
}

// ══════════════════════════════════════════════════════════════════
// MAIN CRM TABLE
// ══════════════════════════════════════════════════════════════════

export function LeadsCRMTable({ leads: serverLeads, pagination }: LeadsCRMTableProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [sectorFilter, setSectorFilter] = useState<string>("all");
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
    const [optimisticallyDeleted, setOptimisticallyDeleted] = useState<Set<string>>(new Set());
    const [isDeletePending, startDeleteTransition] = useTransition();
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

    // Sorting
    const [sortField, setSortField] = useState<SortField>("createdAt");
    const [sortDir, setSortDir] = useState<SortDir>("desc");

    // Toasts
    const { toasts, addToast, dismissToast } = useToasts();

    // ── Compute visible leads (filter out optimistic deletes) ────
    const visibleLeads = serverLeads.filter((l) => !optimisticallyDeleted.has(l.id));

    // ── Filtering ────────────────────────────────────────────────
    const filteredLeads = visibleLeads.filter((lead) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
            searchQuery === "" ||
            lead.name.toLowerCase().includes(q) ||
            lead.email.toLowerCase().includes(q) ||
            lead.companyName.toLowerCase().includes(q) ||
            lead.phone?.toLowerCase().includes(q);

        const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
        const matchesSector = sectorFilter === "all" || lead.sector === sectorFilter;

        return matchesSearch && matchesStatus && matchesSector;
    });

    // ── Sorting ──────────────────────────────────────────────────
    const sortedLeads = [...filteredLeads].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
            case "createdAt":
                cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                break;
            case "name":
                cmp = a.name.localeCompare(b.name);
                break;
            case "companyName":
                cmp = a.companyName.localeCompare(b.companyName);
                break;
            case "status":
                cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
                break;
        }
        return sortDir === "asc" ? cmp : -cmp;
    });

    function handleSort(field: SortField) {
        if (field === sortField) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDir(field === "createdAt" ? "desc" : "asc");
        }
    }

    // ── Delete Flow (Optimistic UI) ──────────────────────────────
    function handleDeleteConfirm() {
        if (!deleteTarget) return;
        const target = deleteTarget;

        // Optimistic removal — row disappears immediately
        setOptimisticallyDeleted((prev) => new Set(prev).add(target.id));
        if (selectedLead?.id === target.id) setSelectedLead(null);

        startDeleteTransition(async () => {
            const result = await deleteLead(target.id);
            if (result.error) {
                // Rollback optimistic deletion
                setOptimisticallyDeleted((prev) => {
                    const next = new Set(prev);
                    next.delete(target.id);
                    return next;
                });
                addToast("error", result.error);
            } else {
                addToast("success", `Deleted ${target.name} (${target.companyName})`);
            }
            setDeleteTarget(null);
        });
    }

    // ── Pagination navigation ────────────────────────────────────
    function navigatePage(page: number) {
        const params = new URLSearchParams(window.location.search);
        params.set("page", String(page));
        window.location.href = `/platform/leads?${params.toString()}`;
    }

    return (
        <>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 w-full sm:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                        type="text"
                        placeholder="Search leads by name, email, company..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]
                                   text-sm text-white placeholder-zinc-600
                                   focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.05]
                                   transition-all duration-200"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-zinc-600">
                        <Filter className="w-3.5 h-3.5" />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]
                                   text-xs text-zinc-400 focus:outline-none focus:border-indigo-500/40
                                   transition-all duration-200 cursor-pointer appearance-none
                                   bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717A%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]
                                   bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7"
                    >
                        <option value="all">All Status</option>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                            <option key={key} value={key}>
                                {cfg.label}
                            </option>
                        ))}
                    </select>

                    {/* Sector Filter */}
                    <select
                        value={sectorFilter}
                        onChange={(e) => setSectorFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]
                                   text-xs text-zinc-400 focus:outline-none focus:border-indigo-500/40
                                   transition-all duration-200 cursor-pointer appearance-none
                                   bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717A%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]
                                   bg-[length:12px] bg-[right_8px_center] bg-no-repeat pr-7"
                    >
                        <option value="all">All Sectors</option>
                        {Object.entries(SECTOR_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>
                                {label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Result Count */}
                <span className="text-xs text-zinc-600 tabular-nums ml-auto">
                    {sortedLeads.length} of {pagination.totalCount} leads
                </span>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/[0.06]">
                                <SortableHeader
                                    label="Date"
                                    field="createdAt"
                                    currentSort={sortField}
                                    currentDir={sortDir}
                                    onSort={handleSort}
                                    icon={<Clock className="w-3 h-3" />}
                                />
                                <SortableHeader
                                    label="Lead"
                                    field="name"
                                    currentSort={sortField}
                                    currentDir={sortDir}
                                    onSort={handleSort}
                                />
                                <SortableHeader
                                    label="Company"
                                    field="companyName"
                                    currentSort={sortField}
                                    currentDir={sortDir}
                                    onSort={handleSort}
                                    icon={<Building2 className="w-3 h-3" />}
                                />
                                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-white/[0.02]">
                                    <span className="flex items-center gap-1.5">
                                        <Users className="w-3 h-3" />
                                        Size
                                    </span>
                                </th>
                                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-white/[0.02]">
                                    Sector
                                </th>
                                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-white/[0.02]">
                                    Contact
                                </th>
                                <SortableHeader
                                    label="Status"
                                    field="status"
                                    currentSort={sortField}
                                    currentDir={sortDir}
                                    onSort={handleSort}
                                    icon={<Sparkles className="w-3 h-3" />}
                                />
                                <th className="px-4 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-white/[0.02]">
                                    Source
                                </th>
                                <th className="px-3 py-3 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider bg-white/[0.02] w-10">
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {sortedLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3 text-zinc-600">
                                            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                                                <Search className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-zinc-500">No leads found</p>
                                                <p className="text-xs mt-0.5">
                                                    {searchQuery || statusFilter !== "all" || sectorFilter !== "all"
                                                        ? "Try adjusting your filters"
                                                        : "Incoming leads from the marketing page will appear here"}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                sortedLeads.map((lead, index) => (
                                    <tr
                                        key={lead.id}
                                        className={`
                                            group transition-all duration-200 cursor-pointer
                                            hover:bg-white/[0.025]
                                            ${openDropdownId === lead.id ? "relative z-50" : ""}
                                        `}
                                        style={{
                                            animation: `slideUp 0.3s ease-out ${index * 30}ms both`,
                                        }}
                                        onClick={() => setSelectedLead(lead)}
                                    >
                                        {/* Date */}
                                        <td className="px-4 py-3.5">
                                            <div className="text-xs text-zinc-400 tabular-nums">
                                                {new Date(lead.createdAt).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </div>
                                            <div className="text-[10px] text-zinc-600 tabular-nums mt-0.5">
                                                {new Date(lead.createdAt).toLocaleTimeString("en-US", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </div>
                                        </td>

                                        {/* Lead Name */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/15 to-violet-500/15 border border-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                                                    {lead.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm text-white font-medium truncate group-hover:text-indigo-300 transition-colors">
                                                        {lead.name}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Company */}
                                        <td className="px-4 py-3.5">
                                            <p className="text-sm text-zinc-300 truncate max-w-[180px]">
                                                {lead.companyName}
                                            </p>
                                        </td>

                                        {/* Size */}
                                        <td className="px-4 py-3.5">
                                            <span className="inline-flex items-center gap-1 text-xs text-zinc-400 bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.04]">
                                                <Users className="w-3 h-3 text-zinc-600" />
                                                {SIZE_LABELS[lead.companySize] || lead.companySize}
                                            </span>
                                        </td>

                                        {/* Sector */}
                                        <td className="px-4 py-3.5">
                                            <span className="text-xs text-zinc-400">
                                                {SECTOR_LABELS[lead.sector] || lead.sector}
                                            </span>
                                        </td>

                                        {/* Contact */}
                                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={`mailto:${lead.email}`}
                                                    className="p-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/10 transition-all duration-200"
                                                    title={lead.email}
                                                >
                                                    <Mail className="w-3.5 h-3.5" />
                                                </a>
                                                {lead.phone && (
                                                    <a
                                                        href={`tel:${lead.phone}`}
                                                        className="p-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all duration-200"
                                                        title={lead.phone}
                                                    >
                                                        <Phone className="w-3.5 h-3.5" />
                                                    </a>
                                                )}
                                                {lead.message && (
                                                    <div
                                                        className="p-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] text-zinc-600"
                                                        title="Has message"
                                                    >
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                                            <StatusBadge
                                                lead={lead}
                                                isOpen={openDropdownId === lead.id}
                                                onToggle={() => setOpenDropdownId(openDropdownId === lead.id ? null : lead.id)}
                                                onToast={addToast}
                                            />
                                        </td>

                                        {/* Source */}
                                        <td className="px-4 py-3.5">
                                            <span className="text-[10px] text-zinc-600 bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.04]">
                                                {lead.source}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => setDeleteTarget(lead)}
                                                className="p-1.5 rounded-md text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 opacity-0 group-hover:opacity-100"
                                                title="Delete lead"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Pagination Controls ──────────────────────────────── */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-zinc-600 tabular-nums">
                        Page {pagination.page} of {pagination.totalPages}
                        <span className="mx-1.5 text-zinc-700">·</span>
                        {pagination.totalCount} total leads
                    </p>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => navigatePage(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg
                                       bg-white/[0.03] border border-white/[0.06]
                                       text-xs text-zinc-400 font-medium
                                       hover:bg-white/[0.06] hover:text-white
                                       disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/[0.03] disabled:hover:text-zinc-400
                                       transition-all duration-200"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Previous
                        </button>

                        {/* Page number pills */}
                        <div className="hidden sm:flex items-center gap-1">
                            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                                .filter((p) => {
                                    // Show first, last, and pages near current
                                    return p === 1 || p === pagination.totalPages ||
                                        Math.abs(p - pagination.page) <= 1;
                                })
                                .map((p, idx, arr) => (
                                    <span key={p} className="contents">
                                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                                            <span className="px-1 text-zinc-700 text-xs">…</span>
                                        )}
                                        <button
                                            onClick={() => navigatePage(p)}
                                            className={`
                                                w-8 h-8 rounded-lg text-xs font-medium tabular-nums
                                                transition-all duration-200
                                                ${p === pagination.page
                                                    ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-400"
                                                    : "bg-white/[0.02] border border-white/[0.04] text-zinc-500 hover:text-white hover:bg-white/[0.06]"
                                                }
                                            `}
                                        >
                                            {p}
                                        </button>
                                    </span>
                                ))}
                        </div>

                        <button
                            onClick={() => navigatePage(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg
                                       bg-white/[0.03] border border-white/[0.06]
                                       text-xs text-zinc-400 font-medium
                                       hover:bg-white/[0.06] hover:text-white
                                       disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white/[0.03] disabled:hover:text-zinc-400
                                       transition-all duration-200"
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            {selectedLead && (
                <LeadDetailDrawer
                    lead={selectedLead}
                    onClose={() => setSelectedLead(null)}
                    onToast={addToast}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <DeleteConfirmModal
                    lead={deleteTarget}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => !isDeletePending && setDeleteTarget(null)}
                    isPending={isDeletePending}
                />
            )}

            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            {/* ── Animations ──────────────────────────────────────── */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes toastSlideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modalPop {
                    from { transform: scale(0.95) translateY(8px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
                @keyframes slideUp {
                    from { transform: translateY(8px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}} />
        </>
    );
}
