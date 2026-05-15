"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CreditCard, HardDrive, Plus, Save, Smartphone, Sparkles, Users } from "lucide-react";

interface PlanMarketing {
    badge?: string;
    tagline?: string;
    cta?: string;
    audience?: string;
    highlights?: string[];
}

interface Plan {
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
    isActive: boolean;
    subscriberCount?: number;
}

const PLAN_COLORS = ["from-indigo-600 to-indigo-800", "from-violet-600 to-purple-800", "from-amber-600 to-orange-800"];
const FEATURE_KEYS = ["payroll", "attendance", "biometric", "expenses", "loans", "recruitment", "performance", "customDocuments", "advancedReports", "apiAccess"];
const FEATURE_LABELS: Record<string, string> = {
    payroll: "Payroll",
    attendance: "Attendance",
    biometric: "Biometric devices",
    expenses: "Expense claims",
    loans: "Loans",
    recruitment: "Recruitment",
    performance: "Performance reviews",
    customDocuments: "Custom documents",
    advancedReports: "Advanced reports",
    apiAccess: "API access",
};

function taka(value: number) {
    return `৳${Math.round(value / 100).toLocaleString("en-BD")}`;
}

function parseLines(value?: string[]) {
    return (value || []).join("\n");
}

function marketingOf(plan: Plan): PlanMarketing {
    const raw = plan.features?.__marketing;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as PlanMarketing : {};
}

export default function PlansPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, Plan>>({});

    const loadPlans = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/platform/plans", { credentials: "include" });
            const data = await res.json();
            setPlans(data.plans || []);
            setDrafts(Object.fromEntries((data.plans || []).map((p: Plan) => [p.id, p])));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadPlans(); }, []);

    const activeSubscribers = useMemo(() => plans.reduce((sum, p) => sum + (p.subscriberCount || 0), 0), [plans]);

    const patchDraft = (id: string, patch: Partial<Plan>) => {
        setDrafts(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const patchMarketing = (id: string, patch: Partial<PlanMarketing>) => {
        setDrafts(prev => {
            const current = prev[id];
            const features = { ...(current.features || {}) };
            features.__marketing = { ...marketingOf(current), ...patch };
            return { ...prev, [id]: { ...current, features } };
        });
    };

    const toggleFeature = (id: string, key: string) => {
        setDrafts(prev => {
            const current = prev[id];
            const features = { ...(current.features || {}) };
            features[key] = !features[key];
            return { ...prev, [id]: { ...current, features } };
        });
    };

    const savePlan = async (plan: Plan) => {
        setSavingId(plan.id);
        try {
            const res = await fetch("/api/platform/plans", {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: plan.id,
                    name: plan.name,
                    description: plan.description,
                    priceMonthly: Number(plan.priceMonthly),
                    priceYearly: Number(plan.priceYearly),
                    maxEmployees: Number(plan.maxEmployees),
                    maxAdmins: Number(plan.maxAdmins),
                    maxBranches: Number(plan.maxBranches),
                    maxDevices: Number(plan.maxDevices),
                    maxStorageMB: Number(plan.maxStorageMB),
                    features: plan.features,
                    isActive: plan.isActive,
                }),
            });
            if (!res.ok) throw new Error("Save failed");
            await loadPlans();
        } finally {
            setSavingId(null);
        }
    };

    const createPlan = async () => {
        const slug = `custom-${Date.now().toString().slice(-5)}`;
        await fetch("/api/platform/plans", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "New Growth Plan",
                slug,
                description: "Position this plan for a specific buying moment before publishing.",
                priceMonthly: 499900,
                priceYearly: 4999000,
                maxEmployees: 100,
                maxAdmins: 5,
                maxBranches: 3,
                maxDevices: 0,
                maxStorageMB: 2048,
                sortOrder: plans.length + 1,
                features: { attendance: true, customDocuments: true, __marketing: { badge: "New", tagline: "Built for growing teams", cta: "Upgrade to Growth", highlights: ["Scale HR without spreadsheets", "Unlock stronger compliance"] } },
            }),
        });
        await loadPlans();
    };

    if (loading) {
        return <div className="h-72 rounded-xl bg-white/[0.03] animate-pulse" />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Plan Studio</h1>
                    <p className="text-sm text-zinc-500 mt-1">Create SaaS packages, marketing positioning, resource limits, and feature access from master admin.</p>
                </div>
                <button onClick={createPlan} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                    <Plus className="h-4 w-4" /> Create plan
                </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Metric icon={CreditCard} label="Total plans" value={plans.length.toString()} />
                <Metric icon={Users} label="Subscribers" value={activeSubscribers.toLocaleString()} />
                <Metric icon={Sparkles} label="Owner control" value="Pricing + UX" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                {plans.map((plan, i) => {
                    const draft = drafts[plan.id] || plan;
                    const marketing = marketingOf(draft);
                    return (
                        <div key={plan.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.1] transition-all group">
                            <div className={`p-5 bg-gradient-to-br ${PLAN_COLORS[i % PLAN_COLORS.length]}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">{draft.slug}</p>
                                        <input value={draft.name} onChange={(e) => patchDraft(plan.id, { name: e.target.value })} className="mt-1 w-full bg-transparent text-xl font-bold text-white outline-none placeholder:text-white/40" />
                                    </div>
                                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs text-white">{plan.subscriberCount || 0} subs</span>
                                </div>
                                <textarea value={draft.description || ""} onChange={(e) => patchDraft(plan.id, { description: e.target.value })} className="mt-3 min-h-14 w-full resize-none rounded-lg border border-white/10 bg-black/10 p-2 text-xs text-white/80 outline-none" />
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                    <MoneyInput label="Monthly" value={draft.priceMonthly} onChange={(v) => patchDraft(plan.id, { priceMonthly: v })} />
                                    <MoneyInput label="Yearly" value={draft.priceYearly} onChange={(v) => patchDraft(plan.id, { priceYearly: v })} />
                                </div>
                            </div>

                            <div className="p-5 space-y-5">
                                <section className="space-y-3">
                                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Business psychology</p>
                                    <Input label="Badge" value={marketing.badge || ""} onChange={(v) => patchMarketing(plan.id, { badge: v })} placeholder="Best value / Popular" />
                                    <Input label="Buyer tagline" value={marketing.tagline || ""} onChange={(v) => patchMarketing(plan.id, { tagline: v })} placeholder="For teams ready to automate HR" />
                                    <Input label="CTA" value={marketing.cta || ""} onChange={(v) => patchMarketing(plan.id, { cta: v })} placeholder="Upgrade now" />
                                    <Input label="Ideal audience" value={marketing.audience || ""} onChange={(v) => patchMarketing(plan.id, { audience: v })} placeholder="20–100 employee companies" />
                                    <label className="block text-xs text-zinc-500">Conversion highlights</label>
                                    <textarea value={parseLines(marketing.highlights)} onChange={(e) => patchMarketing(plan.id, { highlights: e.target.value.split("\n").map(x => x.trim()).filter(Boolean) })} className="min-h-20 w-full rounded-lg border border-white/[0.06] bg-white/[0.03] p-2 text-sm text-zinc-200 outline-none" placeholder="One selling point per line" />
                                </section>

                                <section className="space-y-3">
                                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Resource limits</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <NumberInput icon={Users} label="Employees" value={draft.maxEmployees} onChange={(v) => patchDraft(plan.id, { maxEmployees: v })} />
                                        <NumberInput icon={Users} label="Admins" value={draft.maxAdmins} onChange={(v) => patchDraft(plan.id, { maxAdmins: v })} />
                                        <NumberInput icon={Building2} label="Branches" value={draft.maxBranches} onChange={(v) => patchDraft(plan.id, { maxBranches: v })} />
                                        <NumberInput icon={Smartphone} label="Devices" value={draft.maxDevices} onChange={(v) => patchDraft(plan.id, { maxDevices: v })} />
                                        <NumberInput icon={HardDrive} label="Storage MB" value={draft.maxStorageMB} onChange={(v) => patchDraft(plan.id, { maxStorageMB: v })} />
                                    </div>
                                </section>

                                <section className="space-y-3">
                                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Feature gates</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {FEATURE_KEYS.map(key => (
                                            <label key={key} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-100">
                                                <span>{FEATURE_LABELS[key] || key}</span>
                                                <input type="checkbox" checked={Boolean(draft.features?.[key])} onChange={() => toggleFeature(plan.id, key)} className="accent-indigo-500" />
                                            </label>
                                        ))}
                                    </div>
                                </section>
                            </div>

                            <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between">
                                <label className="flex items-center gap-2 text-xs text-zinc-500">
                                    <input type="checkbox" checked={draft.isActive} onChange={(e) => patchDraft(plan.id, { isActive: e.target.checked })} className="accent-emerald-500" /> Active
                                </label>
                                <button onClick={() => savePlan(draft)} disabled={savingId === plan.id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                                    <Save className="h-3.5 w-3.5" /> {savingId === plan.id ? "Saving..." : "Save"}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><Icon className="mb-3 h-5 w-5 text-indigo-400" /><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-bold text-white">{value}</p></div>;
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return <label className="block text-xs font-medium text-zinc-300">{label}<input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-400 focus:border-indigo-400/50" /></label>;
}

function MoneyInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return <label className="text-xs text-white/60">{label}<input type="number" value={Math.round(value / 100)} onChange={(e) => onChange(Number(e.target.value || 0) * 100)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/10 px-2 py-1.5 text-sm text-white outline-none" /><span className="text-[10px] text-white/40">{taka(value)}</span></label>;
}

function NumberInput({ icon: Icon, label, value, onChange }: { icon: React.ElementType; label: string; value: number; onChange: (v: number) => void }) {
    return <label className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-xs text-zinc-300"><span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value || 0))} className="mt-1 w-full bg-transparent text-sm font-medium text-white outline-none" /></label>;
}
