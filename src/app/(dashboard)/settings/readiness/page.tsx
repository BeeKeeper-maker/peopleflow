"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Fingerprint,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ReadinessStatus = "ready" | "attention" | "optional";

type ReadinessItem = {
  id: string;
  title: string;
  description: string;
  status: ReadinessStatus;
  count?: number;
  target?: number;
  fixHref: string;
  fixLabel: string;
  detail?: string;
};

type ReadinessPayload = {
  organization: { name: string; status: string; timezone: string } | null;
  summary: { total: number; ready: number; attention: number; optional: number; score: number };
  items: ReadinessItem[];
  generatedAt: string;
};

const statusStyles: Record<ReadinessStatus, string> = {
  ready: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  attention: "border-amber-500/25 bg-amber-500/10 text-amber-400",
  optional: "border-slate-500/25 bg-slate-500/10 text-slate-400",
};

const statusLabels: Record<ReadinessStatus, string> = {
  ready: "Ready",
  attention: "Needs attention",
  optional: "Optional",
};

const iconById: Record<string, typeof ClipboardCheck> = {
  "organization-profile": Settings,
  branches: Building2,
  departments: Building2,
  designations: Users,
  "admin-access": ShieldCheck,
  "manager-access": Users,
  "employee-ess": Users,
  "reporting-managers": GitPullRequest,
  "leave-types": ClipboardCheck,
  "leave-workflow": GitPullRequest,
  "biometric-devices": Fingerprint,
  "biometric-mapping": Fingerprint,
  "recent-device-activity": Fingerprint,
};

function StatusIcon({ status }: { status: ReadinessStatus }) {
  if (status === "ready") return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  if (status === "attention") return <AlertTriangle className="h-5 w-5 text-amber-400" />;
  return <ClipboardCheck className="h-5 w-5 text-slate-400" />;
}

function formatGeneratedAt(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dhaka",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function SetupReadinessPage() {
  const { addToast } = useToast();
  const [payload, setPayload] = useState<ReadinessPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | ReadinessStatus>("all");

  const fetchReadiness = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup/readiness", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load readiness checklist");
      }
      setPayload(await res.json());
    } catch (error) {
      addToast({
        title: "Readiness check failed",
        description: error instanceof Error ? error.message : undefined,
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  const filteredItems = useMemo(() => {
    if (!payload) return [];
    if (filter === "all") return payload.items;
    return payload.items.filter((item) => item.status === filter);
  }, [filter, payload]);

  const priorityItems = useMemo(() => payload?.items.filter((item) => item.status === "attention") || [], [payload]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
            <ClipboardCheck className="h-7 w-7 text-blue-400" /> Office Setup Readiness
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            One handover checklist for office admins: setup gaps, approval readiness, ESS access, and biometric attendance health in one place.
          </p>
        </div>
        <Button variant="outline" onClick={fetchReadiness} disabled={loading} className="gap-2 self-start lg:self-auto">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh check
        </Button>
      </div>

      <Card className="border-blue-500/20 bg-linear-to-r from-blue-500/10 via-card to-card">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_340px] lg:items-center">
          <div>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <ShieldCheck className="h-5 w-5 text-blue-400" /> Handover purpose
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              This page is read-only. It does not change employee, approval, or device data. It simply tells the office what is ready and where to fix configuration gaps before real attendance and leave operations begin.
            </p>
            {payload?.generatedAt && <p className="mt-3 text-xs text-muted-foreground">Last checked: {formatGeneratedAt(payload.generatedAt)} BDT</p>}
          </div>
          <div className="rounded-2xl border border-card-border bg-background/40 p-4">
            {loading || !payload ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Readiness score</p>
                    <p className="text-4xl font-bold tabular-nums text-foreground">{payload.summary.score}%</p>
                  </div>
                  <Badge className={payload.summary.attention === 0 ? statusStyles.ready : statusStyles.attention}>
                    {payload.summary.attention === 0 ? "Handover ready" : `${payload.summary.attention} gap(s)`}
                  </Badge>
                </div>
                <Progress value={payload.summary.score} className="mt-4 h-2" />
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-hover p-2"><b className="block text-foreground">{payload.summary.ready}</b>Ready</div>
                  <div className="rounded-lg bg-hover p-2"><b className="block text-foreground">{payload.summary.attention}</b>Needs attention</div>
                  <div className="rounded-lg bg-hover p-2"><b className="block text-foreground">{payload.summary.optional}</b>Optional</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {priorityItems.length > 0 && (
        <Card className="border-amber-500/25 bg-amber-500/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
              <div>
                <h2 className="font-semibold text-foreground">Recommended handover blockers</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Fix these before the office demo or live handover. Everything else can be handled as polish.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {priorityItems.slice(0, 6).map((gap) => (
                    <Link key={gap.id} href={gap.fixHref} className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 hover:bg-amber-500/15">
                      {gap.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-card-border bg-card">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-muted-foreground">
            {payload?.organization ? <span>{payload.organization.name} · {payload.organization.timezone}</span> : <span>Tenant setup checklist</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "attention", "ready", "optional"] as const).map((item) => (
              <Button key={item} size="sm" variant={filter === item ? "default" : "outline"} onClick={() => setFilter(item)}>
                {item === "all" ? "All checks" : statusLabels[item]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {loading
          ? Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-44" />)
          : filteredItems.map((check) => {
              const Icon = iconById[check.id] || ClipboardCheck;
              const showRatio = typeof check.count === "number" && typeof check.target === "number";
              const target = check.target ?? 0;
              const count = check.count ?? 0;
              const progress = showRatio && target > 0 ? Math.min(100, Math.round((count / target) * 100)) : undefined;

              return (
                <Card key={check.id} className={cn("border-card-border bg-card", check.status === "attention" && "border-amber-500/25", check.status === "ready" && "border-emerald-500/15")}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hover">
                          <Icon className="h-5 w-5 text-blue-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-foreground">{check.title}</h3>
                            <Badge className={cn("border", statusStyles[check.status])}>{statusLabels[check.status]}</Badge>
                          </div>
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{check.description}</p>
                        </div>
                      </div>
                      <StatusIcon status={check.status} />
                    </div>

                    {check.detail && <p className="mt-4 rounded-lg bg-hover p-3 text-xs text-muted-foreground">{check.detail}</p>}

                    {showRatio && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Current coverage</span>
                          <span>{count}/{target}</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    <div className="mt-5 flex justify-end">
                      <Link
                        href={check.fixHref}
                        className={buttonVariants({ variant: check.status === "attention" ? "default" : "outline", size: "sm", className: "gap-2" })}
                      >
                        {check.fixLabel}<ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {!loading && filteredItems.length === 0 && (
        <Card className="border-card-border bg-card">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
            <Loader2 className="mb-3 h-6 w-6" />
            No checklist items match this filter.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
