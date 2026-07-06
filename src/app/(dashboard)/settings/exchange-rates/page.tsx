"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Save, RefreshCw, AlertTriangle } from "lucide-react";

interface ExchangeRateEntry {
    code: string;
    name: string;
    symbol: string;
    rate: number | null;
    fetchedAt: string | null;
    source: string | null;
    isStale: boolean;
}

export default function ExchangeRatesPage() {
    const { addToast } = useToast();
    const [rates, setRates] = useState<ExchangeRateEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingRates, setEditingRates] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState<string | null>(null);

    const fetchRates = useCallback(async () => {
        try {
            const res = await fetch("/api/settings/exchange-rates");
            if (res.ok) {
                const data = await res.json();
                setRates(data.data || []);
            }
        } catch {
            addToast({ title: "Error", description: "Failed to load rates", type: "error" });
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchRates();
    }, [fetchRates]);

    const handleSave = async (currency: string) => {
        const rateStr = editingRates[currency];
        if (!rateStr) return;

        const rate = parseFloat(rateStr);
        if (isNaN(rate) || rate <= 0) {
            addToast({ title: "Error", description: "Rate must be a positive number", type: "error" });
            return;
        }

        setSaving(currency);
        try {
            const res = await fetch("/api/settings/exchange-rates", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quoteCurrency: currency, rate }),
            });
            if (res.ok) {
                addToast({ title: `${currency} rate updated`, type: "success" });
                setEditingRates({ ...editingRates, [currency]: "" });
                fetchRates();
            }
        } catch {
            addToast({ title: "Error", description: "Failed to update", type: "error" });
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading...</div>;
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-display font-bold flex items-center gap-2">
                        <DollarSign className="h-6 w-6" />
                        Exchange Rates
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Currency conversion rates for multi-currency expense claims. 1 unit of foreign currency = X BDT.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">How it works</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                    <p>• When an employee submits an expense in a foreign currency, the system converts it to BDT using the cached rate.</p>
                    <p>• Rates should be updated regularly. Stale rates (&gt; 7 days) are flagged with a warning.</p>
                    <p>• All payroll, reports, and reimbursement calculations use the BDT equivalent (amountInBDT).</p>
                    <p>• BDT is always 1.0 and doesn't need a rate entry.</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Currency Rates ({rates.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {/* BDT header (always 1.0) */}
                        <div className="flex items-center justify-between py-2 px-3 bg-green-500/10 rounded-md">
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-mono">৳</span>
                                <div>
                                    <div className="font-medium text-sm">BDT — Bangladeshi Taka</div>
                                    <div className="text-xs text-muted-foreground">Base currency</div>
                                </div>
                            </div>
                            <Badge className="bg-green-500/20 text-green-400">1.00 (base)</Badge>
                        </div>

                        {rates.map((entry) => (
                            <div
                                key={entry.code}
                                className={`flex items-center justify-between py-2 px-3 rounded-md ${
                                    entry.isStale ? "bg-yellow-500/5" : "hover:bg-hover/30"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-mono w-8">{entry.symbol}</span>
                                    <div>
                                        <div className="font-medium text-sm flex items-center gap-2">
                                            {entry.code} — {entry.name}
                                            {entry.isStale && (
                                                <Badge variant="outline" className="text-xs text-yellow-400 border-yellow-400/30">
                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                    Stale
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {entry.rate !== null
                                                ? `1 ${entry.code} = ৳${entry.rate} (updated ${entry.fetchedAt ? new Date(entry.fetchedAt).toLocaleDateString() : "unknown"})`
                                                : "No rate set — foreign currency claims will be rejected"}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder={entry.rate?.toString() || "0.00"}
                                        value={editingRates[entry.code] || ""}
                                        onChange={(e) =>
                                            setEditingRates({ ...editingRates, [entry.code]: e.target.value })
                                        }
                                        className="w-32 bg-hover border-card-border text-right"
                                    />
                                    <Button
                                        size="sm"
                                        onClick={() => handleSave(entry.code)}
                                        disabled={!editingRates[entry.code] || saving === entry.code}
                                        className="bg-blue-600 hover:bg-blue-700"
                                    >
                                        <Save className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
