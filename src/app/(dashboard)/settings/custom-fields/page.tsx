"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, Plus, Edit2, Trash2, X, Save, Type, Hash, Calendar, List, ToggleLeft, AlignLeft } from "lucide-react";

interface CustomField {
    id: string;
    label: string;
    key: string;
    entityType: string;
    fieldType: string;
    options: string[];
    isRequired: boolean;
    isFilterable: boolean;
    isSearchable: boolean;
    defaultValue: string | null;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
}

const ENTITY_LABELS: Record<string, string> = {
    Employee: "Employee",
    Attendance: "Attendance",
    LeaveApplication: "Leave Application",
};

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
    text: Type,
    textarea: AlignLeft,
    number: Hash,
    date: Calendar,
    select: List,
    boolean: ToggleLeft,
};

const FIELD_TYPES = [
    { value: "text", label: "Text", icon: Type },
    { value: "textarea", label: "Text Area", icon: AlignLeft },
    { value: "number", label: "Number", icon: Hash },
    { value: "date", label: "Date", icon: Calendar },
    { value: "select", label: "Dropdown", icon: List },
    { value: "boolean", label: "Yes/No", icon: ToggleLeft },
];

export default function CustomFieldsPage() {
    const { addToast } = useToast();
    const { confirm, dialog: confirmDialog } = useConfirmDialog();
    const [fields, setFields] = useState<CustomField[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingField, setEditingField] = useState<CustomField | null>(null);

    const fetchFields = useCallback(async () => {
        try {
            const res = await fetch("/api/settings/custom-fields");
            if (res.ok) {
                const data = await res.json();
                setFields(data.data || []);
            }
        } catch {
            addToast({ title: "Error", description: "Failed to load fields", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchFields();
    }, [fetchFields]);

    const handleDelete = async (field: CustomField) => {
        const _ok = await confirm({ title: `Deactivate field "${field.label}"?`, description: "Existing values will be preserved. The field will be hidden from forms.", confirmLabel: "Deactivate", variant: "destructive" }); if (!_ok) return;
        try {
            await fetch(`/api/settings/custom-fields/${field.id}`, { method: "DELETE" });
            addToast({ title: "Field deactivated", type: "success" });
            fetchFields();
        } catch {
            addToast({ title: "Error", description: "Failed to delete", type: "error" });
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div>;
    }

    // Group by entityType
    const byEntity: Record<string, CustomField[]> = {};
    for (const f of fields) {
        if (!byEntity[f.entityType]) byEntity[f.entityType] = [];
        byEntity[f.entityType].push(f);
    }

    return (
        <div className="space-y-6 p-6 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <Settings2 className="h-6 w-6" />
                        Custom Fields
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Add custom fields to employees, attendance, and leave applications.
                        Values are stored per-entity and appear in forms and reports.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        setEditingField(null);
                        setShowForm(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Field
                </Button>
            </div>

            {fields.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No custom fields yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Add fields like Blood Group, Emergency Contact, Driving License, etc.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {Object.entries(byEntity).map(([entity, entityFields]) => (
                        <Card key={entity}>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    {ENTITY_LABELS[entity] || entity}
                                    <Badge variant="secondary" className="ml-2">{entityFields.length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {entityFields.map((field) => {
                                        const Icon = FIELD_TYPE_ICONS[field.fieldType] || Type;
                                        return (
                                            <div
                                                key={field.id}
                                                className={`flex items-center justify-between py-2 px-3 rounded-md ${
                                                    field.isActive ? "hover:bg-hover/30" : "opacity-50"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                                    <div>
                                                        <div className="font-medium text-sm flex items-center gap-2">
                                                            {field.label}
                                                            {field.isRequired && (
                                                                <Badge variant="outline" className="text-xs text-red-400 border-red-400/30">Required</Badge>
                                                            )}
                                                            {!field.isActive && (
                                                                <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground font-mono">
                                                            {field.key} · {field.fieldType}
                                                            {field.options.length > 0 && ` · ${field.options.join(", ")}`}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setEditingField(field);
                                                            setShowForm(true);
                                                        }}
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(field)}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {showForm && (
                <FieldForm
                    field={editingField}
                    onClose={() => {
                        setShowForm(false);
                        setEditingField(null);
                    }}
                    onSaved={() => {
                        setShowForm(false);
                        setEditingField(null);
                        fetchFields();
                    }}
                />
            )}
        </div>
    );
}

function FieldForm({
    field,
    onClose,
    onSaved,
}: {
    field: CustomField | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const { addToast } = useToast();
    const { confirm, dialog: confirmDialog } = useConfirmDialog();
    const [saving, setSaving] = useState(false);
    const [label, setLabel] = useState(field?.label || "");
    const [key, setKey] = useState(field?.key || "");
    const [entityType, setEntityType] = useState(field?.entityType || "Employee");
    const [fieldType, setFieldType] = useState(field?.fieldType || "text");
    const [options, setOptions] = useState(field?.options.join(", ") || "");
    const [isRequired, setIsRequired] = useState(field?.isRequired || false);
    const [isFilterable, setIsFilterable] = useState(field?.isFilterable || false);
    const [isSearchable, setIsSearchable] = useState(field?.isSearchable || false);
    const [description, setDescription] = useState(field?.description || "");

    const generateKey = (l: string) =>
        l.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    const handleSave = async () => {
        if (!label.trim()) {
            addToast({ title: "Error", description: "Label is required", type: "error" });
            return;
        }

        setSaving(true);
        try {
            const body: Record<string, unknown> = {
                label,
                key: field ? field.key : (key || generateKey(label)),
                entityType,
                fieldType,
                options: fieldType === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : [],
                isRequired,
                isFilterable,
                isSearchable,
                description: description || undefined,
            };

            const url = field ? `/api/settings/custom-fields/${field.id}` : "/api/settings/custom-fields";
            const method = field ? "PATCH" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                addToast({ title: field ? "Field updated" : "Field created", type: "success" });
                onSaved();
            } else {
                const err = await res.json();
                addToast({ title: "Error", description: err.error || "Failed to save", type: "error" });
            }
        } catch {
            addToast({ title: "Error", description: "Network error", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg bg-card border-card-border max-h-[90vh] overflow-y-auto">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{field ? "Edit Field" : "Add Custom Field"}</CardTitle>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div>
                        <label className="text-sm font-medium">Label *</label>
                        <Input
                            value={label}
                            onChange={(e) => {
                                setLabel(e.target.value);
                                if (!field) setKey(generateKey(e.target.value));
                            }}
                            placeholder="e.g. Blood Group"
                            className="mt-1 bg-hover border-card-border"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Key (identifier)</label>
                        <Input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="blood_group"
                            disabled={!!field}
                            className="mt-1 bg-hover border-card-border font-mono"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Used internally in the database.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium">Entity</label>
                            <select
                                value={entityType}
                                onChange={(e) => setEntityType(e.target.value)}
                                disabled={!!field}
                                className="mt-1 w-full bg-hover border border-card-border rounded-md px-3 py-2"
                            >
                                <option value="Employee">Employee</option>
                                <option value="Attendance">Attendance</option>
                                <option value="LeaveApplication">Leave Application</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Field Type</label>
                            <select
                                value={fieldType}
                                onChange={(e) => setFieldType(e.target.value)}
                                disabled={!!field}
                                className="mt-1 w-full bg-hover border border-card-border rounded-md px-3 py-2"
                            >
                                {FIELD_TYPES.map((ft) => (
                                    <option key={ft.value} value={ft.value}>{ft.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {fieldType === "select" && (
                        <div>
                            <label className="text-sm font-medium">Options (comma-separated)</label>
                            <Input
                                value={options}
                                onChange={(e) => setOptions(e.target.value)}
                                placeholder="O+, A+, B+, AB+, O-, A-, B-, AB-"
                                className="mt-1 bg-hover border-card-border"
                            />
                        </div>
                    )}
                    <div>
                        <label className="text-sm font-medium">Description</label>
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Optional help text for this field"
                            className="mt-1 bg-hover border-card-border"
                        />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-card-border">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
                            <span className="text-sm">Required (must be filled)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isFilterable} onChange={(e) => setIsFilterable(e.target.checked)} />
                            <span className="text-sm">Filterable (show in report builder)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isSearchable} onChange={(e) => setIsSearchable(e.target.checked)} />
                            <span className="text-sm">Searchable (include in global search)</span>
                        </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-3">
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                            <Save className="h-4 w-4 mr-2" />
                            {saving ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
