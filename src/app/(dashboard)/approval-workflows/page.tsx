"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { cn } from "@/lib/utils";
import {
    GitPullRequest,
    Plus,
    Trash2,
    Pencil,
    X,
    Check,
    Loader2,
    GripVertical,
    ChevronDown,
    Power,
    PowerOff,
    UserCheck,
    ArrowRight,
} from "lucide-react";

interface WorkflowStep {
    order: number;
    role: string;
    label?: string;
}

interface Workflow {
    id: string;
    entityType: string;
    name: string;
    steps: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

const entityTypes = ["leave", "expense", "loan", "attendance_regularize"];
const approverRoles = ["manager", "hrAdmin", "departmentHead", "ceo"];

const entityTypeIcons: Record<string, string> = {
    leave: "🏖️",
    expense: "💰",
    loan: "🏦",
    attendance_regularize: "📋",
};

export default function ApprovalWorkflowsPage() {
    const t = useTranslations("ApprovalWorkflows");
    const { addToast } = useToast();
    const { confirm, dialog: confirmDialog } = useConfirmDialog();
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        entityType: "",
        name: "",
        steps: [{ order: 1, role: "manager" }] as WorkflowStep[],
        isActive: true,
    });

    const fetchWorkflows = async () => {
        try {
            const res = await fetch("/api/approval-workflows");
            if (res.ok) {
                const data = await res.json();
                setWorkflows(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to fetch workflows:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const resetForm = () => {
        setFormData({
            entityType: "",
            name: "",
            steps: [{ order: 1, role: "manager" }],
            isActive: true,
        });
        setEditingId(null);
        setShowForm(false);
    };

    const addStep = () => {
        setFormData(prev => ({
            ...prev,
            steps: [...prev.steps, { order: prev.steps.length + 1, role: "hrAdmin" }],
        }));
    };

    const removeStep = (index: number) => {
        setFormData(prev => ({
            ...prev,
            steps: prev.steps
                .filter((_, i) => i !== index)
                .map((s, i) => ({ ...s, order: i + 1 })),
        }));
    };

    const updateStepRole = (index: number, role: string) => {
        setFormData(prev => ({
            ...prev,
            steps: prev.steps.map((s, i) => i === index ? { ...s, role } : s),
        }));
    };

    const handleEdit = (workflow: Workflow) => {
        let steps: WorkflowStep[];
        try {
            steps = JSON.parse(workflow.steps);
        } catch {
            steps = [{ order: 1, role: "manager" }];
        }

        setFormData({
            entityType: workflow.entityType,
            name: workflow.name,
            steps,
            isActive: workflow.isActive,
        });
        setEditingId(workflow.id);
        setShowForm(true);
    };

    const handleSubmit = async () => {
        if (!formData.entityType || !formData.name || formData.steps.length === 0) return;

        setSaving(true);
        try {
            const url = editingId
                ? `/api/approval-workflows/${editingId}`
                : "/api/approval-workflows";
            const method = editingId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    steps: JSON.stringify(formData.steps),
                }),
            });

            if (res.ok) {
                addToast({
                    type: "success",
                    title: editingId ? t("updated") : t("created"),
                });
                resetForm();
                fetchWorkflows();
            } else {
                const data = await res.json();
                addToast({
                    type: "error",
                    title: editingId ? t("updateFailed") : t("createFailed"),
                    description: data.error,
                });
            }
        } catch {
            addToast({
                type: "error",
                title: editingId ? t("updateFailed") : t("createFailed"),
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        const _ok = await confirm({ title: t("confirmDelete"), description: "This workflow will be permanently removed.", confirmLabel: "Delete", variant: "destructive" }); if (!_ok) return;

        try {
            const res = await fetch(`/api/approval-workflows/${id}`, { method: "DELETE" });
            if (res.ok) {
                addToast({ type: "success", title: t("deleted") });
                fetchWorkflows();
            } else {
                addToast({ type: "error", title: t("deleteFailed") });
            }
        } catch {
            addToast({ type: "error", title: t("deleteFailed") });
        }
    };

    const handleToggleActive = async (workflow: Workflow) => {
        try {
            const res = await fetch(`/api/approval-workflows/${workflow.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !workflow.isActive }),
            });

            if (res.ok) {
                addToast({ type: "success", title: t("updated") });
                fetchWorkflows();
            }
        } catch {
            addToast({ type: "error", title: t("updateFailed") });
        }
    };

    // Available entity types (exclude already configured ones unless editing)
    const availableEntityTypes = entityTypes.filter(et =>
        editingId
            ? true
            : !workflows.some(w => w.entityType === et)
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-foreground">{t("title")}</h1>
                    <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
                </div>
                {!showForm && availableEntityTypes.length > 0 && (
                    <Button onClick={() => setShowForm(true)} className="shrink-0">
                        <Plus className="h-4 w-4" />
                        {t("addWorkflow")}
                    </Button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <Card className="bg-card-bg border-primary/20">
                    <CardHeader>
                        <CardTitle className="text-lg">
                            {editingId ? t("editWorkflow") : t("addWorkflow")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {/* Entity Type */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                {t("entityType")}
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {availableEntityTypes.map(et => (
                                    <button
                                        key={et}
                                        onClick={() => setFormData(prev => ({ ...prev, entityType: et }))}
                                        disabled={editingId !== null && et !== formData.entityType}
                                        className={cn(
                                            "p-3 rounded-xl border text-sm font-medium transition-all text-center",
                                            formData.entityType === et
                                                ? "border-primary bg-primary/10 text-primary"
                                                : "border-card-border bg-card-bg text-muted-foreground hover:border-primary/30"
                                        )}
                                    >
                                        <span className="text-lg block mb-1">{entityTypeIcons[et]}</span>
                                        {t(et as any)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                {t("name")}
                            </label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder={`e.g. Leave Approval Chain`}
                            />
                        </div>

                        {/* Steps */}
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-2">
                                {t("steps")}
                            </label>
                            <div className="space-y-2">
                                {formData.steps.map((step, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="flex items-center gap-2 flex-1 p-3 rounded-xl border border-card-border bg-background">
                                            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                {step.order}
                                            </div>
                                            {index > 0 && (
                                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            )}
                                            <select
                                                value={step.role}
                                                onChange={(e) => updateStepRole(index, e.target.value)}
                                                className="flex-1 bg-transparent text-sm text-foreground border-none focus:outline-none"
                                            >
                                                {approverRoles.map(role => (
                                                    <option key={role} value={role}>{t(role as any)}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {formData.steps.length > 1 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => removeStep(index)}
                                                className="shrink-0 h-9 w-9 p-0"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addStep}
                                className="mt-2"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                {t("addStep")}
                            </Button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-2">
                            <Button
                                onClick={handleSubmit}
                                disabled={saving || !formData.entityType || !formData.name}
                                className="min-w-[100px]"
                            >
                                {saving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Check className="h-4 w-4" />
                                        {t("save")}
                                    </>
                                )}
                            </Button>
                            <Button variant="outline" onClick={resetForm}>
                                <X className="h-4 w-4" />
                                {t("cancel")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Workflows list */}
            {workflows.length === 0 && !showForm ? (
                <Card className="bg-card-bg border-card-border">
                    <CardContent className="py-16 text-center">
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                            <GitPullRequest className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-1">{t("noWorkflows")}</h3>
                        <p className="text-muted-foreground text-sm mb-4">{t("noWorkflowsDesc")}</p>
                        <Button onClick={() => setShowForm(true)}>
                            <Plus className="h-4 w-4" />
                            {t("addWorkflow")}
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {workflows.map((workflow) => {
                        let steps: WorkflowStep[] = [];
                        try {
                            steps = JSON.parse(workflow.steps);
                        } catch { /* empty */ }

                        return (
                            <Card key={workflow.id} className={cn(
                                "bg-card-bg border-card-border transition-all",
                                !workflow.isActive && "opacity-60"
                            )}>
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{entityTypeIcons[workflow.entityType] || "📄"}</span>
                                            <div>
                                                <h3 className="font-semibold text-foreground">{workflow.name}</h3>
                                                <p className="text-xs text-muted-foreground">{t(workflow.entityType as any)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleToggleActive(workflow)}
                                                className={cn(
                                                    "p-1.5 rounded-lg transition-colors",
                                                    workflow.isActive
                                                        ? "text-green-400 hover:bg-green-500/10"
                                                        : "text-muted-foreground hover:bg-muted/50"
                                                )}
                                                title={t("isActive")}
                                            >
                                                {workflow.isActive ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(workflow)}
                                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(workflow.id)}
                                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Approval chain visualization */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {steps.map((step, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                                                    <UserCheck className="h-3.5 w-3.5 text-primary" />
                                                    <span className="text-xs font-medium text-primary">
                                                        {t(step.role as any)}
                                                    </span>
                                                </div>
                                                {i < steps.length - 1 && (
                                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Status badge */}
                                    <div className="mt-3 pt-3 border-t border-card-border flex items-center justify-between">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium",
                                            workflow.isActive
                                                ? "bg-green-500/15 text-green-400 border border-green-500/20"
                                                : "bg-gray-500/15 text-gray-400 border border-gray-500/20"
                                        )}>
                                            {workflow.isActive ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                                            {workflow.isActive ? t("isActive") : t("inactive")}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {steps.length} {t("steps").toLowerCase()}
                                        </span>
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
