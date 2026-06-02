"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
    Search,
    LayoutGrid,
    List,
    Filter,
    Users,
    UserCheck,
    Clock,
    Building2,
    Mail,
    Phone,
    ChevronRight,
    Briefcase,
    Calendar,
    ArrowUpDown,
    UserCircle,
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

export interface DirectoryEmployee {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    gender: string | null;
    photoUrl: string | null;
    joiningDate: string;
    employmentType: string;
    employmentStatus: string;
    department: { name: string; code: string | null } | null;
    designation: { name: string; grade: number | null } | null;
    branch: { name: string } | null;
    manager: { name: string; photo: string | null } | null;
}

export interface DirectoryDepartment {
    id: string;
    name: string;
    code: string | null;
}

interface DirectoryOrganization {
    id: string;
    name: string;
    slug: string;
}

export interface DirectoryConfig {
    /** Base path for linking to individual profiles, e.g. "/employees" or "/platform/employees" */
    profileBasePath: string;
    /** Whether to show CRUD action buttons (Add, Edit, Delete) — tenant only */
    showCrudActions?: boolean;
    /** Callback for "Add Employee" button */
    onAddEmployee?: () => void;
    /** Callback for "Edit" action in dropdown */
    onEditEmployee?: (id: string) => void;
    /** Callback for "Delete" action in dropdown */
    onDeleteEmployee?: (id: string) => void;
    /** Whether to show analytics header (DepartmentBar + Workforce) */
    showAnalytics?: boolean;
    /** Whether to show the organization selector (platform only) */
    organizations?: DirectoryOrganization[];
    selectedOrgId?: string;
    /** Page title override */
    title?: string;
    /** Page subtitle override */
    subtitle?: string;
}

export interface EmployeeDirectoryProps {
    employees: DirectoryEmployee[];
    departments: DirectoryDepartment[];
    stats: {
        total: number;
        active: number;
        onProbation: number;
        departments: number;
    };
    config: DirectoryConfig;
}

// ══════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    ENG: { bg: "bg-blue-500/12", text: "text-blue-400", border: "border-blue-500/20" },
    HR: { bg: "bg-pink-500/12", text: "text-pink-400", border: "border-pink-500/20" },
    SM: { bg: "bg-amber-500/12", text: "text-amber-400", border: "border-amber-500/20" },
    FIN: { bg: "bg-emerald-500/12", text: "text-emerald-400", border: "border-emerald-500/20" },
    RMG: { bg: "bg-orange-500/12", text: "text-orange-400", border: "border-orange-500/20" },
    OPS: { bg: "bg-violet-500/12", text: "text-violet-400", border: "border-violet-500/20" },
    QA: { bg: "bg-cyan-500/12", text: "text-cyan-400", border: "border-cyan-500/20" },
    ADM: { bg: "bg-rose-500/12", text: "text-rose-400", border: "border-rose-500/20" },
};

const DEFAULT_DEPT_COLOR = { bg: "bg-zinc-500/12", text: "text-muted-foreground", border: "border-zinc-500/20" };

const TYPE_BADGES: Record<string, { label: string; class: string }> = {
    permanent: { label: "Permanent", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    probation: { label: "Probation", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    contractual: { label: "Contract", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    intern: { label: "Intern", class: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

const EMPLOYEE_DIRECTORY_LABELS = {
    en: {
        totalEmployees: "Total Employees",
        active: "Active",
        onProbation: "On Probation",
        departments: "Departments",
        workforceInsights: "Workforce Insights",
        departmentDistribution: "Department Distribution",
        deptCount: "depts",
        workforce: "Workforce",
        searchPlaceholder: "Search by name, email, code, role...",
        allDepartments: "All Departments",
        allTypes: "All Types",
        showing: "of",
        gridView: "Grid view",
        listView: "List view",
        employee: "Employee",
        designation: "Designation",
        department: "Department",
        contact: "Contact",
        type: "Type",
        joined: "Joined",
        joinedPrefix: "Joined",
        addEmployee: "Add Employee",
        viewProfile: "View Profile",
        editEmployee: "Edit Employee",
        delete: "Delete",
        noEmployeesFound: "No employees found",
        noEmployeesYet: "No employees yet",
        noResults: (query: string) => `No results matching "${query}". Try a different search term or adjust your filters.`,
        emptyTeam: "Start building your team by adding your first employee.",
        unassigned: "Unassigned",
        gender: "Gender",
        male: "Male",
        female: "Female",
        employmentTypes: {
            permanent: "Permanent",
            probation: "Probation",
            contractual: "Contractual",
            intern: "Intern",
        },
    },
    bn: {
        totalEmployees: "মোট কর্মচারী",
        active: "সক্রিয়",
        onProbation: "প্রবেশনে",
        departments: "বিভাগ",
        workforceInsights: "কর্মী বিশ্লেষণ",
        departmentDistribution: "বিভাগভিত্তিক বণ্টন",
        deptCount: "বিভাগ",
        workforce: "কর্মী কাঠামো",
        searchPlaceholder: "নাম, ইমেইল, কোড বা পদবি দিয়ে খুঁজুন...",
        allDepartments: "সব বিভাগ",
        allTypes: "সব ধরন",
        showing: "এর মধ্যে",
        gridView: "গ্রিড ভিউ",
        listView: "লিস্ট ভিউ",
        employee: "কর্মচারী",
        designation: "পদবি",
        department: "বিভাগ",
        contact: "যোগাযোগ",
        type: "ধরন",
        joined: "যোগদান",
        joinedPrefix: "যোগদান",
        addEmployee: "কর্মচারী যোগ করুন",
        viewProfile: "প্রোফাইল দেখুন",
        editEmployee: "কর্মচারী সম্পাদনা",
        delete: "মুছুন",
        noEmployeesFound: "কোনো কর্মচারী পাওয়া যায়নি",
        noEmployeesYet: "এখনো কোনো কর্মচারী নেই",
        noResults: (query: string) => `"${query}" মিলে কোনো ফল পাওয়া যায়নি। অন্য শব্দ দিয়ে খুঁজুন বা ফিল্টার বদলান।`,
        emptyTeam: "প্রথম কর্মচারী যোগ করে আপনার টিম তৈরি শুরু করুন।",
        unassigned: "নির্ধারিত নয়",
        gender: "লিঙ্গ",
        male: "পুরুষ",
        female: "নারী",
        employmentTypes: {
            permanent: "স্থায়ী",
            probation: "প্রবেশন",
            contractual: "চুক্তিভিত্তিক",
            intern: "ইন্টার্ন",
        },
    },
};

type EmployeeDirectoryLabels = typeof EMPLOYEE_DIRECTORY_LABELS.en;

function getEmployeeDirectoryLabels(locale: string): EmployeeDirectoryLabels {
    return locale.startsWith("bn") ? EMPLOYEE_DIRECTORY_LABELS.bn : EMPLOYEE_DIRECTORY_LABELS.en;
}

function formatEmployeeDate(date: string, locale: string, options: Intl.DateTimeFormatOptions) {
    return new Intl.DateTimeFormat(locale.startsWith("bn") ? "bn-BD" : "en-US", options).format(new Date(date));
}

const BAR_COLORS = [
    "from-blue-500 to-blue-600",
    "from-purple-500 to-purple-600",
    "from-cyan-500 to-cyan-600",
    "from-emerald-500 to-emerald-600",
    "from-amber-500 to-amber-600",
    "from-pink-500 to-pink-600",
    "from-indigo-500 to-indigo-600",
    "from-teal-500 to-teal-600",
];

// ══════════════════════════════════════════════════════════════════
// AVATAR COMPONENT
// ══════════════════════════════════════════════════════════════════

function Avatar({ src, name, size = "md" }: { src: string | null; name: string; size?: "sm" | "md" | "lg" }) {
    const [failed, setFailed] = useState(false);
    const sizeClasses = {
        sm: "w-8 h-8 text-xs",
        md: "w-11 h-11 text-sm",
        lg: "w-16 h-16 text-lg",
    };

    const initials = name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    if (src && !failed) {
        return (
            <img
                src={src}
                alt={name}
                onError={() => setFailed(true)}
                className={`${sizeClasses[size]} rounded-xl object-cover border border-border bg-muted`}
            />
        );
    }

    return (
        <div
            className={`${sizeClasses[size]} rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/15 flex items-center justify-center font-bold text-indigo-400`}
        >
            {initials}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// STAT CARD
// ══════════════════════════════════════════════════════════════════

function StatCard({ icon: Icon, label, value, color }: {
    icon: React.ElementType;
    label: string;
    value: number;
    color: string;
}) {
    return (
        <div className="rounded-xl bg-card border border-card-border p-4 flex items-center gap-4 hover:bg-hover transition-all duration-200">
            <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// DEPARTMENT BAR (Analytics)
// ══════════════════════════════════════════════════════════════════

function DepartmentBar({ departments }: { departments: { name: string; count: number }[] }) {
    const max = Math.max(...departments.map(d => d.count), 1);

    return (
        <div className="space-y-3">
            {departments.slice(0, 6).map((dept, i) => (
                <div key={dept.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">
                            {dept.name}
                        </span>
                        <span className="text-xs font-bold text-foreground tabular-nums">{dept.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                            className={`h-full rounded-full bg-gradient-to-r ${BAR_COLORS[i % BAR_COLORS.length]} transition-all duration-700 ease-out`}
                            style={{ width: `${(dept.count / max) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// WORKFORCE COMPOSITION (Analytics)
// ══════════════════════════════════════════════════════════════════

function WorkforceComposition({ employees, total, labels }: { employees: DirectoryEmployee[]; total: number; labels: EmployeeDirectoryLabels }) {
    const permanent = employees.filter(e => e.employmentType === "permanent").length;
    const contractual = employees.filter(e => e.employmentType === "contractual").length;
    const probation = employees.filter(e => e.employmentType === "probation").length;
    const intern = employees.filter(e => e.employmentType === "intern").length;
    const male = employees.filter(e => e.gender === "male").length;
    const female = employees.filter(e => e.gender === "female").length;
    const genderTotal = male + female;

    const types = [
        { label: labels.employmentTypes.permanent, count: permanent, color: "bg-emerald-400" },
        { label: labels.employmentTypes.contractual, count: contractual, color: "bg-blue-400" },
        { label: labels.employmentTypes.probation, count: probation, color: "bg-amber-400" },
        { label: labels.employmentTypes.intern, count: intern, color: "bg-violet-400" },
    ].filter(i => i.count > 0);

    return (
        <div className="space-y-4">
            <div className="space-y-3">
                {types.map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${item.color}`} />
                            <span className="text-xs text-muted-foreground">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground tabular-nums">{item.count}</span>
                            <span className="text-[10px] text-muted-foreground/70">
                                ({total > 0 ? Math.round((item.count / total) * 100) : 0}%)
                            </span>
                        </div>
                    </div>
                ))}
            </div>
            {genderTotal > 0 && (
                <>
                    <div className="border-t border-card-border pt-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">{labels.gender}</p>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-400" />
                                <span className="text-xs text-muted-foreground">{labels.male}</span>
                                <span className="text-xs font-bold text-foreground">{male}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-pink-400" />
                                <span className="text-xs text-muted-foreground">{labels.female}</span>
                                <span className="text-xs font-bold text-foreground">{female}</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
                            style={{ width: `${(male / genderTotal) * 100}%` }}
                        />
                        <div
                            className="h-full bg-gradient-to-r from-pink-400 to-pink-500 transition-all duration-700"
                            style={{ width: `${(female / genderTotal) * 100}%` }}
                        />
                    </div>
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// CARD ACTION MENU (CRUD dropdown for tenant)
// ══════════════════════════════════════════════════════════════════

function CardActionMenu({ employeeId, config, labels }: { employeeId: string; config: DirectoryConfig; labels: EmployeeDirectoryLabels }) {
    const [open, setOpen] = useState(false);

    if (!config.showCrudActions) return null;

    return (
        <div className="relative">
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}
                className="p-1 rounded-md text-muted-foreground/70 hover:text-foreground/80 hover:bg-white/[0.06] transition-all"
            >
                <MoreVertical className="w-4 h-4" />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-7 z-50 w-40 rounded-xl bg-popover border border-white/[0.08] shadow-2xl py-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `${config.profileBasePath}/${employeeId}`; setOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        >
                            <Eye className="w-3.5 h-3.5" /> {labels.viewProfile}
                        </button>
                        {config.onEditEmployee && (
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); config.onEditEmployee!(employeeId); setOpen(false); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                            >
                                <Edit className="w-3.5 h-3.5" /> {labels.editEmployee}
                            </button>
                        )}
                        {config.onDeleteEmployee && (
                            <>
                                <div className="my-1 border-t border-card-border" />
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); config.onDeleteEmployee!(employeeId); setOpen(false); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/[0.06] transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> {labels.delete}
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// EMPLOYEE CARD (Grid View)
// ══════════════════════════════════════════════════════════════════

function EmployeeCard({ employee, config, labels, locale }: { employee: DirectoryEmployee; config: DirectoryConfig; labels: EmployeeDirectoryLabels; locale: string }) {
    const deptColor = employee.department?.code
        ? DEPT_COLORS[employee.department.code] || DEFAULT_DEPT_COLOR
        : DEFAULT_DEPT_COLOR;
    const typeBadge = TYPE_BADGES[employee.employmentType] || TYPE_BADGES.permanent;
    const typeLabel = labels.employmentTypes[employee.employmentType as keyof typeof labels.employmentTypes] || typeBadge.label;

    return (
        <Link
            href={`${config.profileBasePath}/${employee.id}`}
            className="group relative block rounded-2xl bg-card border border-border/70 shadow-sm p-5
                        hover:bg-muted/70 hover:border-indigo-500/25 hover:shadow-[0_8px_40px_-12px_rgba(99,102,241,0.15)]
                        transition-all duration-300 cursor-pointer"
            style={{ animation: `fadeSlideUp 0.4s ease-out both` }}
        >
            {/* Top Row: Avatar + Type Badge + Actions */}
            <div className="flex items-start justify-between mb-4">
                <Avatar src={employee.photoUrl} name={`${employee.firstName} ${employee.lastName}`} size="lg" />
                <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${typeBadge.class}`}>
                        {typeLabel}
                    </span>
                    <CardActionMenu employeeId={employee.id} config={config} labels={labels} />
                </div>
            </div>

            {/* Name & Designation */}
            <h3 className="text-sm font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                {employee.firstName} {employee.lastName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {employee.designation?.name || "—"}
            </p>

            {/* Department Badge */}
            <div className="mt-3">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-md border ${deptColor.bg} ${deptColor.text} ${deptColor.border}`}>
                    <Building2 className="w-3 h-3" />
                    {employee.department?.name || labels.unassigned}
                </span>
            </div>

            {/* Info Row */}
            <div className="mt-4 pt-3 border-t border-card-border space-y-1.5">
                {employee.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{employee.email}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 shrink-0" />
                    <span>{labels.joinedPrefix} {formatEmployeeDate(employee.joiningDate, locale, { month: "short", year: "numeric" })}</span>
                </div>
            </div>

            {/* Employee Code (hover reveal) */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {!config.showCrudActions && (
                    <span className="text-[10px] text-muted-foreground/70 font-mono">{employee.employeeCode}</span>
                )}
            </div>

            {/* Hover glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/[0.02] to-violet-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </Link>
    );
}

// ══════════════════════════════════════════════════════════════════
// EMPLOYEE ROW (List View)
// ══════════════════════════════════════════════════════════════════

function EmployeeRow({ employee, index, config, labels, locale }: { employee: DirectoryEmployee; index: number; config: DirectoryConfig; labels: EmployeeDirectoryLabels; locale: string }) {
    const deptColor = employee.department?.code
        ? DEPT_COLORS[employee.department.code] || DEFAULT_DEPT_COLOR
        : DEFAULT_DEPT_COLOR;

    return (
        <tr
            className="group hover:bg-muted/70 transition-all duration-200 cursor-pointer"
            style={{ animation: `slideUp 0.3s ease-out ${index * 20}ms both` }}
            onClick={() => window.location.href = `${config.profileBasePath}/${employee.id}`}
        >
            {/* Employee */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <Avatar src={employee.photoUrl} name={`${employee.firstName} ${employee.lastName}`} size="sm" />
                    <div className="min-w-0">
                        <p className="text-sm text-foreground font-medium truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                            {employee.firstName} {employee.lastName}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70 font-mono">{employee.employeeCode}</p>
                    </div>
                </div>
            </td>

            {/* Designation */}
            <td className="px-4 py-3">
                <p className="text-xs text-foreground/80 truncate max-w-[160px]">
                    {employee.designation?.name || "—"}
                </p>
            </td>

            {/* Department */}
            <td className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-md border ${deptColor.bg} ${deptColor.text} ${deptColor.border}`}>
                    {employee.department?.name || "—"}
                </span>
            </td>

            {/* Contact */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                    {employee.email && (
                        <a href={`mailto:${employee.email}`} onClick={e => e.stopPropagation()} className="p-1 rounded-md text-muted-foreground/70 hover:text-indigo-400 hover:bg-indigo-500/10 transition-all" title={employee.email}>
                            <Mail className="w-3.5 h-3.5" />
                        </a>
                    )}
                    {employee.phone && (
                        <a href={`tel:${employee.phone}`} onClick={e => e.stopPropagation()} className="p-1 rounded-md text-muted-foreground/70 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all" title={employee.phone}>
                            <Phone className="w-3.5 h-3.5" />
                        </a>
                    )}
                </div>
            </td>

            {/* Type */}
            <td className="px-4 py-3">
                {(() => {
                    const badge = TYPE_BADGES[employee.employmentType] || TYPE_BADGES.permanent;
                    return (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.class}`}>
                            {labels.employmentTypes[employee.employmentType as keyof typeof labels.employmentTypes] || badge.label}
                        </span>
                    );
                })()}
            </td>

            {/* Joined */}
            <td className="px-4 py-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                    {formatEmployeeDate(employee.joiningDate, locale, { month: "short", day: "numeric", year: "numeric" })}
                </span>
            </td>

            {/* Actions or Arrow */}
            <td className="px-3 py-3">
                {config.showCrudActions ? (
                    <div onClick={e => e.stopPropagation()}>
                        <CardActionMenu employeeId={employee.id} config={config} labels={labels} />
                    </div>
                ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                )}
            </td>
        </tr>
    );
}

// ══════════════════════════════════════════════════════════════════
// EMPTY STATE
// ══════════════════════════════════════════════════════════════════

function EmptyState({ query, config, labels }: { query: string; config: DirectoryConfig; labels: EmployeeDirectoryLabels }) {
    return (
        <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-hover border border-card-border flex items-center justify-center mb-6">
                <UserCircle className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                {query ? labels.noEmployeesFound : labels.noEmployeesYet}
            </h3>
            <p className="text-sm text-muted-foreground/70 max-w-sm text-center">
                {query ? labels.noResults(query) : labels.emptyTeam}
            </p>
            {!query && config.onAddEmployee && (
                <button
                    onClick={config.onAddEmployee}
                    className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400
                               text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-indigo-500/25"
                >
                    <Plus className="w-4 h-4" />
                    {labels.addEmployee}
                </button>
            )}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// MAIN DIRECTORY COMPONENT
// ══════════════════════════════════════════════════════════════════

export function EmployeeDirectory({
    employees,
    departments,
    stats,
    config,
}: EmployeeDirectoryProps) {
    const locale = useLocale();
    const labels = getEmployeeDirectoryLabels(locale);
    const [view, setView] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [deptFilter, setDeptFilter] = useState("all");
    const [typeFilter, setTypeFilter] = useState("all");
    const [sortField, setSortField] = useState<"name" | "department" | "joined">("name");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [analyticsOpen, setAnalyticsOpen] = useState(false);

    // Computed analytics data
    const analyticsData = useMemo(() => {
        const deptMap = new Map<string, number>();
        employees.forEach(e => {
            const dept = e.department?.name || labels.unassigned;
            deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
        });
        return [...deptMap.entries()]
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [employees, labels.unassigned]);

    // Filter & Search
    const filteredEmployees = useMemo(() => {
        let result = employees;

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(
                (e) =>
                    `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
                    e.email?.toLowerCase().includes(q) ||
                    e.employeeCode.toLowerCase().includes(q) ||
                    e.designation?.name.toLowerCase().includes(q) ||
                    e.department?.name.toLowerCase().includes(q)
            );
        }

        // Department filter
        if (deptFilter !== "all") {
            result = result.filter((e) => e.department?.code === deptFilter || e.department?.name === deptFilter);
        }

        // Type filter
        if (typeFilter !== "all") {
            result = result.filter((e) => e.employmentType === typeFilter);
        }

        // Sort
        result = [...result].sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case "name":
                    cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
                    break;
                case "department":
                    cmp = (a.department?.name || "").localeCompare(b.department?.name || "");
                    break;
                case "joined":
                    cmp = new Date(a.joiningDate).getTime() - new Date(b.joiningDate).getTime();
                    break;
            }
            return sortDir === "asc" ? cmp : -cmp;
        });

        return result;
    }, [employees, searchQuery, deptFilter, typeFilter, sortField, sortDir]);

    function handleSort(field: "name" | "department" | "joined") {
        if (field === sortField) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    }

    return (
        <>
            {/* CSS Animations */}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}} />

            {/* Page Header */}
            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        {config.title || labels.employee}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {config.subtitle || labels.emptyTeam}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Org Selector (platform only) */}
                    {config.organizations && config.organizations.length > 1 && (
                        <select
                            value={config.selectedOrgId || ""}
                            onChange={(e) => {
                                window.location.href = `/platform/employees?org=${e.target.value}`;
                            }}
                            className="px-3 py-2 rounded-lg bg-hover border border-card-border text-xs text-muted-foreground focus:outline-none focus:border-indigo-500/40 transition-all"
                        >
                            {config.organizations.map((org) => (
                                <option key={org.id} value={org.id} className="bg-popover">
                                    {org.name}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* {labels.addEmployee} Button (tenant only) */}
                    {config.onAddEmployee && (
                        <button
                            onClick={config.onAddEmployee}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                                       bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400
                                       text-white text-sm font-medium transition-all duration-200
                                       shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                        >
                            <Plus className="w-4 h-4" />
                            {labels.addEmployee}
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <StatCard icon={Users} label={labels.totalEmployees} value={stats.total} color="bg-indigo-500/15 text-indigo-400" />
                <StatCard icon={UserCheck} label={labels.active} value={stats.active} color="bg-emerald-500/15 text-emerald-400" />
                <StatCard icon={Clock} label={labels.onProbation} value={stats.onProbation} color="bg-amber-500/15 text-amber-400" />
                <StatCard icon={Building2} label={labels.departments} value={stats.departments} color="bg-violet-500/15 text-violet-400" />
            </div>

            {/* Analytics Panel (collapsible) */}
            {config.showAnalytics && employees.length > 0 && analyticsData.length > 0 && (
                <div className="mb-6">
                    <button
                        onClick={() => setAnalyticsOpen(!analyticsOpen)}
                        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground/80 transition-colors mb-3"
                    >
                        {analyticsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {labels.workforceInsights}
                    </button>
                    {analyticsOpen && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            {/* Department Distribution */}
                            <div className="lg:col-span-2 rounded-xl bg-card border border-card-border p-5">
                                <div className="flex items-center justify-between mb-5">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-blue-400" />
                                        <h3 className="text-sm font-semibold text-foreground">{labels.departmentDistribution}</h3>
                                    </div>
                                    <span className="text-[10px] font-medium text-muted-foreground/70 px-2 py-0.5 rounded-full bg-muted border border-card-border">
                                        {analyticsData.length} {labels.deptCount}
                                    </span>
                                </div>
                                <DepartmentBar departments={analyticsData} />
                            </div>

                            {/* Workforce Composition */}
                            <div className="rounded-xl bg-card border border-card-border p-5">
                                <div className="flex items-center gap-2 mb-5">
                                    <Briefcase className="h-4 w-4 text-purple-400" />
                                    <h3 className="text-sm font-semibold text-foreground">{labels.workforce}</h3>
                                </div>
                                <WorkforceComposition employees={employees} total={stats.total} labels={labels} />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
                {/* Search */}
                <div className="relative flex-1 w-full sm:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                    <input
                        type="text"
                        placeholder={labels.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-hover border border-card-border
                                   text-sm text-foreground placeholder:text-muted-foreground
                                   focus:outline-none focus:border-indigo-500/40 focus:bg-muted
                                   transition-all duration-200"
                    />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground/70">
                        <Filter className="w-3.5 h-3.5" />
                    </div>

                    {/* Department Filter */}
                    <select
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-hover border border-card-border
                                   text-xs text-muted-foreground focus:outline-none focus:border-indigo-500/40
                                   transition-all cursor-pointer"
                    >
                        <option value="all" className="bg-popover">{labels.allDepartments}</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.code || d.name} className="bg-popover">
                                {d.name}
                            </option>
                        ))}
                    </select>

                    {/* Type Filter */}
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-hover border border-card-border
                                   text-xs text-muted-foreground focus:outline-none focus:border-indigo-500/40
                                   transition-all cursor-pointer"
                    >
                        <option value="all" className="bg-popover">{labels.allTypes}</option>
                        <option value="permanent" className="bg-popover">{labels.employmentTypes.permanent}</option>
                        <option value="probation" className="bg-popover">{labels.employmentTypes.probation}</option>
                        <option value="contractual" className="bg-popover">{labels.employmentTypes.contractual}</option>
                        <option value="intern" className="bg-popover">{labels.employmentTypes.intern}</option>
                    </select>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* View Toggle + Count */}
                <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground/70 tabular-nums">
                        {filteredEmployees.length} {labels.showing} {employees.length}
                    </span>
                    <div className="flex items-center rounded-lg bg-hover border border-card-border p-0.5">
                        <button
                            onClick={() => setView("grid")}
                            className={`p-1.5 rounded-md transition-all duration-200 ${
                                view === "grid"
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "text-muted-foreground/70 hover:text-muted-foreground"
                            }`}
                            title={labels.gridView}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setView("list")}
                            className={`p-1.5 rounded-md transition-all duration-200 ${
                                view === "list"
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "text-muted-foreground/70 hover:text-muted-foreground"
                            }`}
                            title={labels.listView}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {filteredEmployees.length === 0 ? (
                <EmptyState query={searchQuery} config={config} labels={labels} />
            ) : view === "grid" ? (
                /* ═══ GRID VIEW ═══ */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredEmployees.map((employee) => (
                        <EmployeeCard key={employee.id} employee={employee} config={config} labels={labels} locale={locale} />
                    ))}
                </div>
            ) : (
                /* ═══ LIST VIEW ═══ */
                <div className="rounded-xl border border-card-border bg-card">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-card-border">
                                    <th className="px-4 py-3">
                                        <button onClick={() => handleSort("name")} className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground/80 transition-colors">
                                            {labels.employee}
                                            <ArrowUpDown className="w-3 h-3" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{labels.designation}</span>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button onClick={() => handleSort("department")} className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground/80 transition-colors">
                                            {labels.department}
                                            <ArrowUpDown className="w-3 h-3" />
                                        </button>
                                    </th>
                                    <th className="px-4 py-3">
                                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{labels.contact}</span>
                                    </th>
                                    <th className="px-4 py-3">
                                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{labels.type}</span>
                                    </th>
                                    <th className="px-4 py-3">
                                        <button onClick={() => handleSort("joined")} className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground/80 transition-colors">
                                            {labels.joined}
                                            <ArrowUpDown className="w-3 h-3" />
                                        </button>
                                    </th>
                                    <th className="px-3 py-3 w-10" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.04]">
                                {filteredEmployees.map((employee, index) => (
                                    <EmployeeRow key={employee.id} employee={employee} index={index} config={config} labels={labels} locale={locale} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
}
