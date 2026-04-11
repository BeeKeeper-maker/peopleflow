/**
 * Lead Management Dashboard — PeopleFlow CRM
 *
 * Platform Admin route to manage incoming SalesLead records.
 * Server Component that fetches leads and renders the client CRM table.
 */

import { prisma } from "@/lib/prisma";
import { verifyPlatformCookie } from "@/lib/platform-token";
import { redirect } from "next/navigation";
import { LeadsCRMTable } from "./_components/leads-table";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
    // ── Server-side auth gate — prevents data leak before client redirect ──
    const session = await verifyPlatformCookie();
    if (!session) {
        redirect("/platform/login");
    }

    const leads = await prisma.salesLead.findMany({
        orderBy: { createdAt: "desc" },
    });

    // Compute pipeline stats
    const stats = {
        total: leads.length,
        new: leads.filter((l) => l.status === "new").length,
        contacted: leads.filter((l) => l.status === "contacted").length,
        qualified: leads.filter((l) => l.status === "qualified").length,
        demo_scheduled: leads.filter((l) => l.status === "demo_scheduled").length,
        converted: leads.filter((l) => l.status === "converted").length,
        lost: leads.filter((l) => l.status === "lost").length,
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Lead Pipeline
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">
                        Manage incoming sales leads and track conversions
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-xs text-indigo-400 font-medium tabular-nums">
                        {stats.total} total leads
                    </span>
                </div>
            </div>

            {/* Pipeline Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <PipelineStat label="New" count={stats.new} color="blue" />
                <PipelineStat label="Contacted" count={stats.contacted} color="amber" />
                <PipelineStat label="Qualified" count={stats.qualified} color="purple" />
                <PipelineStat label="Demo" count={stats.demo_scheduled} color="cyan" />
                <PipelineStat label="Converted" count={stats.converted} color="emerald" />
                <PipelineStat label="Lost" count={stats.lost} color="red" />
            </div>

            {/* CRM Table */}
            <LeadsCRMTable
                leads={leads.map((lead) => ({
                    ...lead,
                    createdAt: lead.createdAt.toISOString(),
                    updatedAt: lead.updatedAt.toISOString(),
                }))}
            />
        </div>
    );
}

// ── Pipeline Stat Card ───────────────────────────────────────────
function PipelineStat({
    label,
    count,
    color,
}: {
    label: string;
    count: number;
    color: string;
}) {
    const colorMap: Record<string, { bg: string; text: string; border: string; glow: string }> = {
        blue: {
            bg: "bg-blue-500/8",
            text: "text-blue-400",
            border: "border-blue-500/15",
            glow: "shadow-[0_0_15px_-3px_rgba(59,130,246,0.15)]",
        },
        amber: {
            bg: "bg-amber-500/8",
            text: "text-amber-400",
            border: "border-amber-500/15",
            glow: "shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]",
        },
        purple: {
            bg: "bg-purple-500/8",
            text: "text-purple-400",
            border: "border-purple-500/15",
            glow: "shadow-[0_0_15px_-3px_rgba(168,85,247,0.15)]",
        },
        cyan: {
            bg: "bg-cyan-500/8",
            text: "text-cyan-400",
            border: "border-cyan-500/15",
            glow: "shadow-[0_0_15px_-3px_rgba(6,182,212,0.15)]",
        },
        emerald: {
            bg: "bg-emerald-500/8",
            text: "text-emerald-400",
            border: "border-emerald-500/15",
            glow: "shadow-[0_0_15px_-3px_rgba(16,185,129,0.15)]",
        },
        red: {
            bg: "bg-red-500/8",
            text: "text-red-400",
            border: "border-red-500/15",
            glow: "shadow-[0_0_15px_-3px_rgba(239,68,68,0.15)]",
        },
    };

    const c = colorMap[color] || colorMap.blue;

    return (
        <div
            className={`rounded-xl border ${c.border} ${c.bg} ${c.glow} px-4 py-3 transition-all duration-200 hover:scale-[1.02]`}
        >
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                {label}
            </p>
            <p className={`text-2xl font-bold ${c.text} tabular-nums mt-0.5`}>
                {count}
            </p>
        </div>
    );
}
