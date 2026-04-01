"use client";

import { useEffect, useState } from "react";
import { CreditCard, Users, Check, Building2, Layers } from "lucide-react";

interface Plan {
    id: string; name: string; slug: string;
    priceMonthly: number; priceYearly: number;
    maxEmployees: number; maxAdmins: number; maxBranches: number;
    features: Record<string, boolean>;
    isActive: boolean;
    _count?: { subscriptions: number };
}

const PLAN_COLORS = ["from-indigo-600 to-indigo-800", "from-violet-600 to-purple-800", "from-amber-600 to-orange-800"];

export default function PlansPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/platform/plans", { credentials: "include" })
            .then(r => r.json())
            .then(data => setPlans(data.plans || []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-8 w-32 rounded bg-white/[0.04] animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-72 rounded-xl bg-white/[0.03] animate-pulse" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Plans</h1>
                <p className="text-sm text-zinc-500 mt-1">Manage subscription tiers and pricing</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {plans.map((plan, i) => (
                    <div key={plan.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.1] transition-all group">
                        {/* Header gradient */}
                        <div className={`p-5 bg-gradient-to-br ${PLAN_COLORS[i % PLAN_COLORS.length]}`}>
                            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">{plan.slug}</p>
                            <h3 className="text-xl font-bold text-white mt-1">{plan.name}</h3>
                            <div className="flex items-baseline gap-1 mt-3">
                                <span className="text-3xl font-bold text-white tabular-nums">৳{plan.priceMonthly.toLocaleString()}</span>
                                <span className="text-sm text-white/60">/month</span>
                            </div>
                            <p className="text-xs text-white/40 mt-1">৳{plan.priceYearly.toLocaleString()}/year</p>
                        </div>

                        {/* Limits */}
                        <div className="p-5 space-y-3">
                            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Resource Limits</p>
                            {[
                                { icon: Users, label: "Employees", value: plan.maxEmployees === -1 ? "Unlimited" : plan.maxEmployees },
                                { icon: Users, label: "Admins", value: plan.maxAdmins === -1 ? "Unlimited" : plan.maxAdmins },
                                { icon: Building2, label: "Branches", value: plan.maxBranches === -1 ? "Unlimited" : plan.maxBranches },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-zinc-500">
                                        <item.icon className="w-3.5 h-3.5" />
                                        <span>{item.label}</span>
                                    </div>
                                    <span className="text-white font-medium tabular-nums">{item.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Features */}
                        <div className="px-5 pb-5 space-y-2">
                            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Features</p>
                            {Object.entries(plan.features || {}).map(([key, enabled]) => (
                                <div key={key} className="flex items-center gap-2 text-xs">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${enabled ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/10 text-zinc-600"}`}>
                                        <Check className="w-2.5 h-2.5" />
                                    </div>
                                    <span className={enabled ? "text-zinc-300" : "text-zinc-600 line-through"}>{key}</span>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between">
                            <span className="text-xs text-zinc-600">
                                {plan._count?.subscriptions || 0} subscribers
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${plan.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-500"}`}>
                                {plan.isActive ? "Active" : "Inactive"}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
