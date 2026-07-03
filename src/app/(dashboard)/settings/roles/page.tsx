"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Shield,
    Plus,
    Edit2,
    Trash2,
    Users,
    Lock,
    Palette,
    Save,
    X,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface Permission {
    id: string;
    key: string;
    module: string;
    action: string;
    description: string | null;
    isDangerous: boolean;
}

interface RolePermission {
    id: string;
    permissionId: string;
    scope: string;
    permission: Permission;
}

interface Role {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isSystem: boolean;
    isDefault: boolean;
    color: string | null;
    sortOrder: number;
    rolePermissions: RolePermission[];
    _count: { userAssignments: number };
}

const SCOPE_LABELS: Record<string, string> = {
    global: "Global",
    department: "Department",
    branch: "Branch",
    self: "Self",
    team: "Team",
};

const MODULE_LABELS: Record<string, string> = {
    employee: "Employee Management",
    leave: "Leave Management",
    attendance: "Attendance",
    payroll: "Payroll",
    recruitment: "Recruitment",
    performance: "Performance",
    expense: "Expense Claims",
    settings: "Settings",
    reports: "Reports",
    rbac: "Role & Permissions",
};

export default function RolesPage() {
    const t = useTranslations("Settings");
    const { addToast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [showEditor, setShowEditor] = useState(false);
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

    const fetchData = useCallback(async () => {
        try {
            const [rolesRes, permsRes] = await Promise.all([
                fetch("/api/rbac/roles"),
                fetch("/api/rbac/permissions"),
            ]);
            if (rolesRes.ok) {
                const data = await rolesRes.json();
                setRoles(data.data || []);
            }
            if (permsRes.ok) {
                const data = await permsRes.json();
                setPermissions(data.data || []);
            }
        } catch {
            addToast({ title: "Error", description: "Failed to load roles", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCreate = () => {
        setEditingRole(null);
        setShowEditor(true);
    };

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setShowEditor(true);
    };

    const handleDelete = async (role: Role) => {
        if (role.isSystem) return;
        if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/rbac/roles/${role.id}`, { method: "DELETE" });
            if (res.ok) {
                addToast({ title: "Role deleted", type: "success" });
                fetchData();
            } else {
                const err = await res.json();
                addToast({ title: "Error", description: err.error || "Failed to delete", type: "error" });
            }
        } catch {
            addToast({ title: "Error", description: "Network error", type: "error" });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-muted-foreground">Loading roles...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="h-6 w-6" />
                        Roles & Permissions
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Create custom roles with granular permissions. System roles cannot be deleted.
                    </p>
                </div>
                <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                </Button>
            </div>

            <div className="grid gap-4">
                {roles.map((role) => (
                    <Card key={role.id}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                            <div className="flex items-center gap-3">
                                {role.color && (
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: role.color }}
                                    />
                                )}
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        {role.name}
                                        {role.isSystem && (
                                            <Badge variant="outline" className="text-blue-400 border-blue-400/30">
                                                <Lock className="h-3 w-3 mr-1" />
                                                System
                                            </Badge>
                                        )}
                                        {role.isDefault && (
                                            <Badge variant="outline" className="text-green-400 border-green-400/30">
                                                Default
                                            </Badge>
                                        )}
                                    </CardTitle>
                                    {role.description && (
                                        <p className="text-sm text-muted-foreground mt-0.5">{role.description}</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="gap-1">
                                    <Users className="h-3 w-3" />
                                    {role._count.userAssignments} user{role._count.userAssignments !== 1 ? "s" : ""}
                                </Badge>
                                <Badge variant="secondary">
                                    {role.rolePermissions.length} perm{role.rolePermissions.length !== 1 ? "s" : ""}
                                </Badge>
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(role)}>
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                                {!role.isSystem && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(role)}
                                        className="text-red-400 hover:text-red-300"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            {showEditor && (
                <RoleEditor
                    role={editingRole}
                    permissions={permissions}
                    expandedModules={expandedModules}
                    setExpandedModules={setExpandedModules}
                    onClose={() => {
                        setShowEditor(false);
                        setEditingRole(null);
                    }}
                    onSaved={() => {
                        setShowEditor(false);
                        setEditingRole(null);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}

// ── Role Editor Dialog ───────────────────────────────────────────────

interface RoleEditorProps {
    role: Role | null;
    permissions: Permission[];
    expandedModules: Record<string, boolean>;
    setExpandedModules: (v: Record<string, boolean>) => void;
    onClose: () => void;
    onSaved: () => void;
}

function RoleEditor({
    role,
    permissions,
    expandedModules,
    setExpandedModules,
    onClose,
    onSaved,
}: RoleEditorProps) {
    const { addToast } = useToast();
    const [name, setName] = useState(role?.name || "");
    const [slug, setSlug] = useState(role?.slug || "");
    const [description, setDescription] = useState(role?.description || "");
    const [color, setColor] = useState(role?.color || "#3b82f6");
    const [selectedPerms, setSelectedPerms] = useState<Record<string, { scope: string }>>(
        role
            ? Object.fromEntries(
                  role.rolePermissions.map((rp) => [rp.permissionId, { scope: rp.scope }]),
              )
            : {},
    );
    const [saving, setSaving] = useState(false);
    const isSystem = role?.isSystem ?? false;

    // Group permissions by module
    const modules = Array.from(new Set(permissions.map((p) => p.module))).sort();
    const permsByModule: Record<string, Permission[]> = {};
    for (const mod of modules) {
        permsByModule[mod] = permissions.filter((p) => p.module === mod);
    }

    const generateSlug = (n: string) =>
        n.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    const togglePerm = (permId: string) => {
        setSelectedPerms((prev) => {
            const next = { ...prev };
            if (next[permId]) {
                delete next[permId];
            } else {
                next[permId] = { scope: "global" };
            }
            return next;
        });
    };

    const setScope = (permId: string, scope: string) => {
        setSelectedPerms((prev) => ({
            ...prev,
            [permId]: { scope },
        }));
    };

    const toggleModule = (mod: string) => {
        setExpandedModules({
            ...expandedModules,
            [mod]: !expandedModules[mod],
        });
    };

    const selectAllInModule = (mod: string) => {
        const modulePerms = permsByModule[mod] || [];
        const allSelected = modulePerms.every((p) => selectedPerms[p.id]);
        const next = { ...selectedPerms };
        for (const p of modulePerms) {
            if (allSelected) {
                delete next[p.id];
            } else {
                next[p.id] = { scope: "global" };
            }
        }
        setSelectedPerms(next);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            addToast({ title: "Error", description: "Name is required", type: "error" });
            return;
        }
        if (!isSystem && !slug.trim()) {
            addToast({ title: "Error", description: "Slug is required", type: "error" });
            return;
        }

        setSaving(true);
        try {
            const permArray = Object.entries(selectedPerms).map(([permissionId, { scope }]) => ({
                permissionId,
                scope,
            }));

            const url = role ? `/api/rbac/roles/${role.id}` : "/api/rbac/roles";
            const method = role ? "PATCH" : "POST";
            const body: Record<string, unknown> = {
                name,
                description: description || null,
                color,
                permissions: permArray,
            };
            if (!role) body.slug = slug || generateSlug(name);
            if (role && !isSystem) body.slug = slug;

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                addToast({
                    title: role ? "Role updated" : "Role created",
                    type: "success",
                });
                onSaved();
            } else {
                const err = await res.json();
                addToast({
                    title: "Error",
                    description: err.error || "Failed to save",
                    type: "error",
                });
            }
        } catch {
            addToast({ title: "Error", description: "Network error", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={() => onClose()}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-card-border">
                <DialogHeader>
                    <DialogTitle>
                        {role ? `Edit Role: ${role.name}` : "Create Custom Role"}
                    </DialogTitle>
                    <DialogDescription>
                        {isSystem
                            ? "System role — permissions can be extended but the role cannot be deleted."
                            : "Define a custom role with granular permissions and scoping."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Role Name</label>
                            <Input
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (!role) setSlug(generateSlug(e.target.value));
                                }}
                                placeholder="e.g. Branch Manager"
                                className="bg-hover border-card-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Slug (identifier)</label>
                            <Input
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                placeholder="branch_manager"
                                disabled={isSystem}
                                className="bg-hover border-card-border"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What can this role do?"
                                className="bg-hover border-card-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-1">
                                <Palette className="h-3 w-3" /> Color
                            </label>
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="h-10 w-16 rounded border border-card-border bg-transparent cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Permission Matrix */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium">
                                Permissions ({Object.keys(selectedPerms).length} selected)
                            </label>
                        </div>

                        <div className="border border-card-border rounded-md divide-y divide-card-border">
                            {modules.map((mod) => {
                                const modulePerms = permsByModule[mod] || [];
                                const selectedCount = modulePerms.filter(
                                    (p) => selectedPerms[p.id],
                                ).length;
                                const isExpanded = expandedModules[mod] ?? false;

                                return (
                                    <div key={mod}>
                                        <button
                                            type="button"
                                            onClick={() => toggleModule(mod)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-hover/50"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                                <span className="font-medium text-sm">
                                                    {MODULE_LABELS[mod] || mod}
                                                </span>
                                                <Badge variant="secondary" className="text-xs">
                                                    {selectedCount}/{modulePerms.length}
                                                </Badge>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    selectAllInModule(mod);
                                                }}
                                                className="text-xs text-blue-400 hover:underline"
                                            >
                                                {selectedCount === modulePerms.length
                                                    ? "Clear all"
                                                    : "Select all"}
                                            </button>
                                        </button>

                                        {isExpanded && (
                                            <div className="pl-8 pr-3 pb-2 space-y-1">
                                                {modulePerms.map((perm) => {
                                                    const selected = !!selectedPerms[perm.id];
                                                    const scope = selectedPerms[perm.id]?.scope || "global";
                                                    return (
                                                        <div
                                                            key={perm.id}
                                                            className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-hover/30"
                                                        >
                                                            <div className="flex items-center gap-2 flex-1">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selected}
                                                                    onChange={() => togglePerm(perm.id)}
                                                                    className="rounded"
                                                                />
                                                                <div>
                                                                    <span className="text-sm font-mono">
                                                                        {perm.key}
                                                                    </span>
                                                                    {perm.isDangerous && (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="ml-2 text-xs text-red-400 border-red-400/30"
                                                                        >
                                                                            Dangerous
                                                                        </Badge>
                                                                    )}
                                                                    {perm.description && (
                                                                        <p className="text-xs text-muted-foreground">
                                                                            {perm.description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {selected && (
                                                                <select
                                                                    value={scope}
                                                                    onChange={(e) =>
                                                                        setScope(perm.id, e.target.value)
                                                                    }
                                                                    className="text-xs bg-hover border border-card-border rounded px-2 py-1"
                                                                >
                                                                    <option value="global">Global</option>
                                                                    <option value="department">Department</option>
                                                                    <option value="branch">Branch</option>
                                                                    <option value="self">Self only</option>
                                                                    <option value="team">Team (reportees)</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-card-border">
                        <Button variant="ghost" onClick={onClose}>
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? "Saving..." : role ? "Update Role" : "Create Role"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
