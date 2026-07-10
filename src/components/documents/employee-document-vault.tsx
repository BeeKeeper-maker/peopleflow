"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertCircle,
  Archive,
  BadgeCheck,
  Download,
  FileText,
  Loader2,
  Search,
  Shield,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { DOCUMENT_CATEGORIES, DOCUMENT_TYPES, getDocumentCategoryLabel, getDocumentTypeLabel, isDocumentExpired, isDocumentExpiringSoon } from "@/lib/employee-documents";
import { cn } from "@/lib/utils";

interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  email?: string | null;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
}

interface EmployeeDocument {
  id: string;
  name: string;
  type: string;
  category: string;
  fileUrl: string;
  originalName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  status: "pending" | "verified" | "rejected" | string;
  isVerified: boolean;
  notes?: string | null;
  tags: string[];
  createdAt: string;
  verifiedAt?: string | null;
  employee: EmployeeSummary;
}

interface VaultStats {
  total: number;
  verified: number;
  pending: number;
  expired: number;
  expiringSoon: number;
}

interface EmployeeDocumentVaultProps {
  employeeId?: string;
  employeeName?: string;
  compact?: boolean;
}

const initialStats: VaultStats = {
  total: 0,
  verified: 0,
  pending: 0,
  expired: 0,
  expiringSoon: 0,
};

function formatBytes(size?: number | null) {
  if (!size) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return format(new Date(value), "dd MMM yyyy");
  } catch {
    return "Invalid date";
  }
}

function statusBadge(document: EmployeeDocument) {
  if (isDocumentExpired(document.expiryDate)) {
    return { label: "Expired", className: "border-red-500/20 bg-red-500/10 text-red-400", icon: AlertCircle };
  }
  if (document.status === "verified") {
    return { label: "Verified", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400", icon: BadgeCheck };
  }
  if (document.status === "rejected") {
    return { label: "Rejected", className: "border-red-500/20 bg-red-500/10 text-red-400", icon: AlertCircle };
  }
  return { label: "Pending", className: "border-amber-500/20 bg-amber-500/10 text-amber-400", icon: AlertCircle };
}

export function EmployeeDocumentVault({ employeeId, employeeName, compact = false }: EmployeeDocumentVaultProps) {
  const { addToast } = useToast();
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [stats, setStats] = useState<VaultStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [form, setForm] = useState({
    employeeId: employeeId || "",
    name: "",
    type: "nid",
    category: "identity",
    issueDate: "",
    expiryDate: "",
    notes: "",
    tags: "",
  });
  const [file, setFile] = useState<File | null>(null);

  const selectedType = useMemo(() => DOCUMENT_TYPES.find((item) => item.value === form.type), [form.type]);

  useEffect(() => {
    if (selectedType && !form.category) {
      setForm((current) => ({ ...current, category: selectedType.category }));
    }
  }, [selectedType, form.category]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: compact ? "10" : "50" });
      if (employeeId) params.set("employeeId", employeeId);
      if (query.trim()) params.set("q", query.trim());
      if (category !== "all") params.set("category", category);
      if (status !== "all") params.set("status", status);

      const res = await fetch(`/api/employee-documents?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load documents");
      const json = await res.json();
      setDocuments(json.data?.documents || []);
      setStats(json.data?.stats || initialStats);
    } catch (error) {
      addToast({ title: "Could not load document vault", description: error instanceof Error ? error.message : "Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [addToast, category, compact, employeeId, query, status]);

  const loadEmployees = useCallback(async () => {
    if (employeeId) return;
    try {
      const res = await fetch("/api/employees?limit=200");
      if (!res.ok) return;
      const json = await res.json();
      setEmployees(json.data || []);
    } catch {
      // Non-blocking: upload dialog will show a fallback message.
    }
  }, [employeeId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const resetForm = () => {
    setForm({
      employeeId: employeeId || "",
      name: "",
      type: "nid",
      category: "identity",
      issueDate: "",
      expiryDate: "",
      notes: "",
      tags: "",
    });
    setFile(null);
  };

  const handleTypeChange = (value: string) => {
    const nextType = DOCUMENT_TYPES.find((item) => item.value === value);
    setForm((current) => ({
      ...current,
      type: value,
      category: nextType?.category || current.category || "other",
      name: current.name || nextType?.label || "",
    }));
  };

  const handleUpload = async () => {
    if (!form.employeeId) {
      addToast({ title: "Select an employee", type: "warning" });
      return;
    }
    if (!file) {
      addToast({ title: "Select a document file", type: "warning" });
      return;
    }
    if (!form.name.trim()) {
      addToast({ title: "Document name is required", type: "warning" });
      return;
    }

    setSaving(true);
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("folder", "documents");
      uploadData.append("prefix", `${form.employeeId}-${form.type}`);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadData });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson.success) {
        throw new Error(uploadJson.error?.message || "File upload failed");
      }

      const createRes = await fetch("/api/employee-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: form.employeeId,
          name: form.name.trim(),
          type: form.type,
          category: form.category,
          fileUrl: uploadJson.data.url,
          originalName: uploadJson.data.originalName,
          mimeType: uploadJson.data.mimeType,
          fileSize: uploadJson.data.size,
          issueDate: form.issueDate || null,
          expiryDate: form.expiryDate || null,
          notes: form.notes || null,
          tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      const createJson = await createRes.json();
      if (!createRes.ok || !createJson.success) {
        throw new Error(createJson.error?.message || createJson.error || "Could not save document metadata");
      }

      addToast({ title: "Document uploaded", description: "Saved to the employee document vault.", type: "success" });
      setUploadOpen(false);
      resetForm();
      await loadDocuments();
    } catch (error) {
      addToast({ title: "Upload failed", description: error instanceof Error ? error.message : "Please try again.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (document: EmployeeDocument, nextStatus: "verified" | "pending" | "rejected") => {
    try {
      const res = await fetch(`/api/employee-documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("Could not update document status");
      addToast({ title: "Document updated", type: "success" });
      await loadDocuments();
    } catch (error) {
      addToast({ title: "Update failed", description: error instanceof Error ? error.message : "Please try again.", type: "error" });
    }
  };

  const archiveDocument = async (document: EmployeeDocument) => {
    const confirmed = window.confirm(`Archive ${document.name}? The file will be hidden but retained for audit/recovery.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/employee-documents/${document.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not archive document");
      addToast({ title: "Document archived", type: "success" });
      await loadDocuments();
    } catch (error) {
      addToast({ title: "Archive failed", description: error instanceof Error ? error.message : "Please try again.", type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-card-border bg-card-bg/80 backdrop-blur-xl">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <CardTitle>{employeeName ? `${employeeName}'s Document Vault` : "Employee Document Vault"}</CardTitle>
                <CardDescription>
                  Secure employee files with search, verification and expiry tracking.
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setUploadOpen(true)} className="gap-2 bg-linear-to-r from-blue-500 to-indigo-600">
              <Upload className="h-4 w-4" />
              Upload Document
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Total", stats.total, "text-blue-400"],
              ["Verified", stats.verified, "text-emerald-400"],
              ["Pending", stats.pending, "text-amber-400"],
              ["Expiring", stats.expiringSoon, "text-orange-400"],
              ["Expired", stats.expired, "text-red-400"],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-xl border border-card-border bg-hover/40 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={cn("mt-1 text-2xl font-semibold tabular-nums", color as string)}>{value}</p>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by employee, code, document, tag..."
                className="pl-9"
              />
            </div>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
              <option value="all">All categories</option>
              {DOCUMENT_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
              <option value="all">All status</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {loading ? (
            <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-card-border">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-card-border p-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 font-semibold text-foreground">No documents found</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Upload NID, contracts, certificates and HR records to build a searchable employee file database.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-card-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-card-border bg-hover/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Document</th>
                      {!employeeId && <th className="px-4 py-3">Employee</th>}
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-card-border">
                    {documents.map((document) => {
                      const badge = statusBadge(document);
                      const StatusIcon = badge.icon;
                      const expiringSoon = isDocumentExpiringSoon(document.expiryDate);
                      return (
                        <tr key={document.id} className="bg-card-bg/30 hover:bg-hover/50">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 rounded-lg bg-blue-500/10 p-2 text-blue-400">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">{document.name}</p>
                                <p className="text-xs text-muted-foreground">{getDocumentTypeLabel(document.type)} · {formatBytes(document.fileSize)}</p>
                                {document.tags.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {document.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          {!employeeId && (
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{document.employee.firstName} {document.employee.lastName}</p>
                              <p className="text-xs text-muted-foreground">{document.employee.employeeCode} · {document.employee.department?.name || "No department"}</p>
                            </td>
                          )}
                          <td className="px-4 py-3 text-muted-foreground">{getDocumentCategoryLabel(document.category)}</td>
                          <td className="px-4 py-3">
                            <span className={cn("text-muted-foreground", expiringSoon && "text-orange-400", isDocumentExpired(document.expiryDate) && "text-red-400")}>{formatDate(document.expiryDate)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={cn("gap-1 border", badge.className)}>
                              <StatusIcon className="h-3 w-3" />
                              {badge.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => window.open(document.fileUrl, "_blank", "noopener,noreferrer")}>
                                <Download className="h-4 w-4" />
                              </Button>
                              {document.status !== "verified" && (
                                <Button variant="outline" size="sm" onClick={() => updateStatus(document, "verified")}>Verify</Button>
                              )}
                              {document.status === "verified" && (
                                <Button variant="outline" size="sm" onClick={() => updateStatus(document, "pending")}>Unverify</Button>
                              )}
                              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={() => archiveDocument(document)}>
                                <Archive className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload employee document</DialogTitle>
            <DialogDescription>
              Store HR records in the protected employee document vault. Only HR/admin users can upload or download these files.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            {!employeeId && (
              <div className="space-y-2 md:col-span-2">
                <Label>Employee</Label>
                <select value={form.employeeId} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.employeeCode} — {employee.firstName} {employee.lastName}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Document type</Label>
              <select value={form.type} onChange={(event) => handleTypeChange(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {DOCUMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {DOCUMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Document name</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. NID front copy, signed appointment letter" />
            </div>
            <div className="space-y-2">
              <Label>Issue date</Label>
              <Input type="date" value={form.issueDate} onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Expiry date</Label>
              <Input type="date" value={form.expiryDate} onChange={(event) => setForm((current) => ({ ...current, expiryDate: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>File</Label>
              <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <p className="text-xs text-muted-foreground">Allowed: PDF, DOC, DOCX, XLS, XLSX. Max size follows plan/file policy.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Tags</Label>
              <Input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="Comma separated: nid, contract, onboarding" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Internal HR notes" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleUpload} disabled={saving} className="gap-2 bg-linear-to-r from-blue-500 to-indigo-600">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Save document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
