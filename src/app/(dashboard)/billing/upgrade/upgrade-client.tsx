"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Crown, Loader2, ShieldCheck, Sparkles, Users, Building2, HardDrive, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type PlanMarketing = {
    badge?: string;
    tagline?: string;
    cta?: string;
    audience?: string;
    highlights?: string[];
};

type Plan = {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    maxEmployees: number;
    maxAdmins: number;
    maxBranches: number;
    maxDevices: number;
    maxStorageMB: number;
    features: Record<string, boolean | PlanMarketing | string[] | undefined>;
    checkoutReady: boolean;
};

function marketingOf(plan: Plan): PlanMarketing {
    const raw = plan.features?.__marketing;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as PlanMarketing : {};
}

function plural(value: number, singular: string, pluralLabel = `${singular}s`) {
    if (value === -1) return `Unlimited ${pluralLabel}`;
    return `${value.toLocaleString()} ${value === 1 ? singular : pluralLabel}`;
}

function formatMoney(value: number, currency = "BDT") {
    return new Intl.NumberFormat("en-BD", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(value / 100);
}

function limitText(value: number, suffix = "") {
    return value === -1 ? "Unlimited" : `${value.toLocaleString()}${suffix}`;
}

export function UpgradeBillingClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { addToast } = useToast();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [currentPlanSlug, setCurrentPlanSlug] = useState<string | null>(searchParams.get("current"));
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
    const [loading, setLoading] = useState(true);
    const [checkingOut, setCheckingOut] = useState<string | null>(null);

    const source = searchParams.get("source");

    useEffect(() => {
        let alive = true;
        fetch("/api/billing/plans")
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to load plans");
                if (!alive) return;
                setPlans(data.plans || []);
                setCurrentPlanSlug(data.currentPlanSlug || searchParams.get("current"));
            })
            .catch((error) => addToast({ title: error.message, type: "error" }))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [addToast, searchParams]);

    const recommendedSlug = useMemo(() => {
        if (source === "branch-limit") return plans.find((p) => p.maxBranches === -1 || p.maxBranches > 1)?.slug;
        return plans.find((p) => p.slug !== currentPlanSlug)?.slug;
    }, [currentPlanSlug, plans, source]);

    const handleCheckout = async (plan: Plan) => {
        if (plan.slug === currentPlanSlug) {
            router.push("/settings?tab=billing");
            return;
        }

        setCheckingOut(plan.slug);
        try {
            const res = await fetch("/api/billing/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ planSlug: plan.slug, billingCycle }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not start checkout");
            if (data.url) window.location.href = data.url;
        } catch (error) {
            addToast({
                title: "Upgrade could not start",
                description: error instanceof Error ? error.message : "Please contact support or try again.",
                type: "error",
                duration: 9000,
            });
        } finally {
            setCheckingOut(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <Button variant="ghost" className="mb-3 gap-2 text-muted-foreground" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                            <Crown className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-display font-bold text-foreground tabular-nums">Upgrade PeopleFlow Plan</h1>
                            <p className="text-muted-foreground mt-1">Choose the plan that matches your organization’s growth.</p>
                        </div>
                    </div>
                </div>

                <div className="inline-flex rounded-xl border border-card-border bg-card-bg p-1 self-start">
                    <button
                        onClick={() => setBillingCycle("monthly")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-medium transition", billingCycle === "monthly" ? "bg-blue-600 text-white" : "text-muted-foreground")}
                    >Monthly</button>
                    <button
                        onClick={() => setBillingCycle("yearly")}
                        className={cn("px-4 py-2 rounded-lg text-sm font-medium transition", billingCycle === "yearly" ? "bg-blue-600 text-white" : "text-muted-foreground")}
                    >Yearly <span className="text-xs opacity-80">save more</span></button>
                </div>
            </div>

            {source === "branch-limit" && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex gap-3">
                    <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Your current branch limit is blocking growth.</h2>
                        <p className="text-sm text-muted-foreground mt-1">Select Growth or Enterprise to add more branches and keep GPS attendance organized per location.</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex h-64 items-center justify-center rounded-xl border border-card-border bg-card-bg">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                </div>
            ) : (
                <div className="grid gap-5 lg:grid-cols-3">
                    {plans.map((plan) => {
                        const isCurrent = plan.slug === currentPlanSlug;
                        const isRecommended = plan.slug === recommendedSlug;
                        const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
                        const marketing = marketingOf(plan);
                        const featureEntries = Object.entries(plan.features || {}).filter(([key, value]) => key !== "__marketing" && typeof value === "boolean") as [string, boolean][];
                        return (
                            <Card key={plan.id} className={cn("relative overflow-hidden border-card-border bg-card-bg", isRecommended && "border-blue-500/50 shadow-lg shadow-blue-500/10")}>
                                {isRecommended && (
                                    <div className="absolute right-4 top-4">
                                        <Badge className="gap-1 bg-blue-500/15 text-blue-300 border-blue-500/20"><Sparkles className="h-3 w-3" /> {marketing.badge || "Best next step"}</Badge>
                                    </div>
                                )}
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-foreground">
                                        {plan.name}
                                        {isCurrent && <Badge variant="outline">Current</Badge>}
                                    </CardTitle>
                                    <CardDescription>{marketing.tagline || plan.description || "Complete HRMS subscription tier"}</CardDescription>
                                    {marketing.audience && <p className="text-xs text-muted-foreground">Ideal for {marketing.audience}</p>}
                                    <div className="pt-4">
                                        <span className="text-3xl font-display font-bold text-foreground">{formatMoney(price, plan.currency)}</span>
                                        <span className="text-sm text-muted-foreground"> / {billingCycle === "yearly" ? "year" : "month"}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="rounded-lg border border-card-border bg-hover p-3"><Users className="h-4 w-4 text-blue-400 mb-2" />{plural(plan.maxEmployees, "employee")}</div>
                                        <div className="rounded-lg border border-card-border bg-hover p-3"><Building2 className="h-4 w-4 text-emerald-400 mb-2" />{plural(plan.maxBranches, "branch", "branches")}</div>
                                        <div className="rounded-lg border border-card-border bg-hover p-3"><Smartphone className="h-4 w-4 text-purple-400 mb-2" />{plural(plan.maxDevices, "device")}</div>
                                        <div className="rounded-lg border border-card-border bg-hover p-3"><HardDrive className="h-4 w-4 text-amber-400 mb-2" />{limitText(plan.maxStorageMB, " MB")}</div>
                                    </div>

                                    <div className="space-y-2">
                                        {(marketing.highlights?.length ? marketing.highlights : []).map((highlight) => (
                                            <div key={highlight} className="flex items-center gap-2 text-sm text-foreground">
                                                <Sparkles className="h-4 w-4 text-blue-400" />
                                                {highlight}
                                            </div>
                                        ))}
                                        {featureEntries.slice(0, 8).map(([feature, enabled]) => (
                                            <div key={feature} className={cn("flex items-center gap-2 text-sm", enabled ? "text-foreground" : "text-muted-foreground/50 line-through")}>
                                                <Check className={cn("h-4 w-4", enabled ? "text-emerald-400" : "text-muted-foreground/40")} />
                                                {feature.replace(/([A-Z])/g, " $1").trim()}
                                            </div>
                                        ))}
                                    </div>

                                    <Button
                                        className="w-full gap-2"
                                        variant={isCurrent ? "outline" : "default"}
                                        disabled={checkingOut === plan.slug}
                                        onClick={() => handleCheckout(plan)}
                                    >
                                        {checkingOut === plan.slug && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {isCurrent ? "Manage current plan" : marketing.cta || (plan.checkoutReady ? "Continue to checkout" : "Request upgrade")}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
