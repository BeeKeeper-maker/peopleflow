"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BillingError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-lg font-display font-semibold text-white mb-2">
                Failed to load billing data
            </h2>
            <p className="text-sm text-zinc-500 text-center max-w-sm mb-6">
                {error.message || "An unexpected error occurred while fetching invoices."}
            </p>
            <Button onClick={reset} variant="default">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try again
            </Button>
        </div>
    );
}
