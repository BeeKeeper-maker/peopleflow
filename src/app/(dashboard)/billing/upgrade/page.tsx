import { Suspense } from "react";
import { UpgradeBillingClient } from "./upgrade-client";

function UpgradeBillingFallback() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-card-border bg-card-bg p-6">
        <div className="h-6 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-muted/70" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-64 animate-pulse rounded-2xl border border-card-border bg-card-bg" />
        ))}
      </div>
    </div>
  );
}

export default function UpgradeBillingPage() {
  return (
    <Suspense fallback={<UpgradeBillingFallback />}>
      <UpgradeBillingClient />
    </Suspense>
  );
}
