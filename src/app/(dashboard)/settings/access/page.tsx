"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, CheckCircle2, Clock, KeyRound, Mail, RefreshCw, Search, Shield, ShieldCheck, UserCheck, Users, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useAccessUsers, queryKeys } from "@/hooks/use-data";
import { cn } from "@/lib/utils";

type Role = "admin" | "hr_admin" | "manager" | "employee" | "super_admin";
type Filter = "all" | "admins" | "hr_admin" | "manager" | "employee" | "issues" | "inactive";

interface AccessUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  emailVerified: string | null;
  lastLogin: string | null;
  createdAt: string;
  twoFactorEnabled: boolean;
  employee: null | {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    employmentStatus: string;
    branch: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
    designation: { id: string; name: string } | null;
    reportingManager: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
    _count: { reportees: number };
  };
}

interface Summary {
  total: number;
  active: number;
  inactive: number;
  admins: number;
  hrAdmins: number;
  managers: number;
  employees: number;
  unlinked: number;
  managersWithoutReportees: number;
  setupPending: number;
}

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Office Admin",
  hr_admin: "HR Admin",
  manager: "Manager",
  employee: "Employee",
};

const roleHelp: Record<Exclude<Role, "super_admin">, string> = {
  admin: "Full office control: setup, billing-sensitive settings, users, HR operations.",
  hr_admin: "HR operations: employees, leave, attendance, payroll, reports. No user role control.",
  manager: "Team operations: direct report attendance, leaves, approvals. Requires linked employee profile.",
  employee: "Self-service only: own attendance, leave, documents, payslips.",
};

function hasSetupIssue(user: AccessUser) {
  if (!user.emailVerified) return true;
  if (!user.employee) return true;
  if (user.role === "manager" && user.employee._count.reportees === 0) return true;
  if (user.role === "employee" && !user.employee.reportingManager) return true;
  return false;
}

function getDisplayName(user: AccessUser) {
  if (user.employee) return `${user.employee.firstName} ${user.employee.lastName}`;
  return user.name || user.email;
}

export default function AccessSettingsPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { data: accessData, isLoading: loading, isFetching, refetch } = useAccessUsers();
  const users = useMemo<AccessUser[]>(() => (accessData?.data ?? []) as unknown as AccessUser[], [accessData]);
  const summary = useMemo<Summary | null>(() => (accessData?.summary ?? null) as unknown as Summary | null, [accessData]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [setupSendingId, setSetupSendingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const invalidateUsers = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.access.users() });
  };

  const fetchUsers = () => {
    void refetch();
  };

  const sendSetupLink = async (userId: string) => {
    setSetupSendingId(userId);
    try {
      const res = await fetch("/api/access/users/setup-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || await res.text());
      addToast({ title: "Setup link sent", description: data?.email ? `Sent to ${data.email}` : undefined, type: "success" });
      invalidateUsers();
    } catch (error) {
      addToast({ title: "Setup link failed", description: error instanceof Error ? error.message : undefined, type: "error" });
    } finally {
      setSetupSendingId(null);
    }
  };

  const updateUser = async (userId: string, payload: { role?: string; isActive?: boolean }) => {
    setSavingId(userId);
    try {
      const res = await fetch("/api/access/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || await res.text());
      }
      addToast({ title: "Access updated", type: "success" });
      invalidateUsers();
    } catch (error) {
      addToast({ title: "Access update failed", description: error instanceof Error ? error.message : undefined, type: "error" });
    } finally {
      setSavingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (filter === "admins" && !["admin", "super_admin"].includes(user.role)) return false;
      if (filter === "hr_admin" && user.role !== "hr_admin") return false;
      if (filter === "manager" && user.role !== "manager") return false;
      if (filter === "employee" && user.role !== "employee") return false;
      if (filter === "issues" && !hasSetupIssue(user)) return false;
      if (filter === "inactive" && user.isActive) return false;
      if (!q) return true;
      const haystack = [
        user.email,
        user.name,
        user.role,
        user.employee?.employeeCode,
        user.employee?.firstName,
        user.employee?.lastName,
        user.employee?.branch?.name,
        user.employee?.department?.name,
        user.employee?.designation?.name,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [filter, query, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3"><ShieldCheck className="h-7 w-7 text-blue-400" /> Access Control</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">Control who can log in, what role they have, and whether each office user is ready for leave/attendance approval flows.</p>
        </div>
        <Button variant="outline" onClick={fetchUsers} disabled={loading || isFetching} className="gap-2 self-start md:self-auto"><RefreshCw className={cn("h-4 w-4", (loading || isFetching) && "animate-spin")} />Refresh</Button>
      </div>

      <Card className="bg-linear-to-r from-blue-500/10 via-card to-card border-blue-500/20">
        <CardContent className="p-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 font-semibold text-foreground"><KeyRound className="h-5 w-5 text-blue-400" /> Office access governance</div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-3xl">Best practice: first create employee profiles, then assign role access. Managers must be linked to an employee profile and have reportees. Employees should have a reporting manager so leave requests route cleanly.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground min-w-[260px]">
            <div className="rounded-lg bg-hover p-3"><b className="text-foreground">Admin</b><br />User & setup control</div>
            <div className="rounded-lg bg-hover p-3"><b className="text-foreground">HR</b><br />HR operations</div>
            <div className="rounded-lg bg-hover p-3"><b className="text-foreground">Manager</b><br />Direct team approvals</div>
            <div className="rounded-lg bg-hover p-3"><b className="text-foreground">Employee</b><br />Self-service only</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {(loading || !summary) ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />) : [
          ["Total", summary.total, Users], ["Active", summary.active, CheckCircle2], ["Inactive", summary.inactive, XCircle], ["Admins", summary.admins, Shield], ["HR", summary.hrAdmins, UserCheck], ["Managers", summary.managers, Building2], ["Setup Pending", summary.setupPending, Mail], ["Setup Issues", summary.managersWithoutReportees, AlertTriangle],
        ].map(([label, value, Icon]) => {
          const I = Icon as typeof Users;
          return <Card key={String(label)} className="bg-card border-card-border"><CardContent className="p-4"><I className="h-4 w-4 text-blue-400 mb-2" /><p className="text-2xl font-display font-bold text-foreground tabular-nums">{String(value)}</p><p className="text-xs text-muted-foreground">{String(label)}</p></CardContent></Card>;
        })}
      </div>

      <Card className="bg-card border-card-border">
        <CardContent className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search user, employee, department, branch, or role..." className="pl-9" /></div>
          <div className="flex flex-wrap gap-2">
            {(["all", "issues", "admins", "hr_admin", "manager", "employee", "inactive"] as Filter[]).map((item) => <Button key={item} size="sm" variant={filter === item ? "default" : "outline"} onClick={() => setFilter(item)}>{item.replace("hr_admin", "HR").replace("admins", "Admins").replace("issues", "Issues")}</Button>)}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-36" />) : filteredUsers.map((user) => {
          const issue = hasSetupIssue(user);
          const canEditRole = user.role !== "super_admin";
          return (
            <Card key={user.id} className={cn("bg-card border-card-border", !user.isActive && "opacity-70", issue && "border-amber-500/25")}>
              <CardContent className="p-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex gap-4 min-w-0">
                    <Avatar className="h-12 w-12"><AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 text-white">{getDisplayName(user).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-foreground truncate">{getDisplayName(user)}</h3><RoleBadge role={user.role} /><Badge className={user.isActive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}>{user.isActive ? "Active" : "Inactive"}</Badge>{!user.emailVerified && <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/25">Setup pending</Badge>}</div>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{user.employee?.employeeCode || "No employee link"}</span>
                        <span>·</span><span>{user.employee?.designation?.name || "No designation"}</span>
                        <span>·</span><span>{user.employee?.department?.name || "No department"}</span>
                        <span>·</span><span>{user.employee?.branch?.name || "No branch"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_180px_160px] xl:items-start">
                    <div className="rounded-lg border border-card-border bg-hover p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Approval readiness</p>
                      {user.role === "manager" ? <p>{user.employee?._count.reportees || 0} reportees assigned</p> : <p>Manager: {user.employee?.reportingManager ? `${user.employee.reportingManager.firstName} ${user.employee.reportingManager.lastName}` : "Not assigned"}</p>}
                      {!user.emailVerified && <p className="text-amber-400 mt-1">Account setup link not completed</p>}
                      {issue && <p className="text-amber-400 mt-1">Setup attention needed</p>}
                    </div>

                    <Select value={user.role} onValueChange={(role) => updateUser(user.id, { role })} disabled={!canEditRole || savingId === user.id}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["admin", "hr_admin", "manager", "employee"] as const).map((role) => <SelectItem key={role} value={role}><div><span>{roleLabels[role]}</span><p className="text-xs text-muted-foreground">{roleHelp[role]}</p></div></SelectItem>)}
                      </SelectContent>
                    </Select>

                    <div className="grid gap-2">
                      {!user.emailVerified && user.isActive && user.role !== "super_admin" && (
                        <Button variant="secondary" disabled={setupSendingId === user.id} onClick={() => sendSetupLink(user.id)} className="gap-2">
                          {setupSendingId === user.id ? <Clock className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          Send setup link
                        </Button>
                      )}
                      <Button variant={user.isActive ? "outline" : "default"} disabled={savingId === user.id || user.role === "super_admin"} onClick={() => updateUser(user.id, { isActive: !user.isActive })}>
                        {savingId === user.id ? <Clock className="h-4 w-4 animate-spin" /> : user.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    super_admin: "bg-red-500/15 text-red-400 border-red-500/25",
    admin: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    hr_admin: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    manager: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    employee: "bg-slate-500/15 text-slate-400 border-slate-500/25",
  };
  return <Badge className={cn("border", styles[role])}>{roleLabels[role]}</Badge>;
}
