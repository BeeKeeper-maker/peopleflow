import { Suspense } from "react";
import { SettingsClient } from "./settings-client";

function SettingsFallback() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="h-11 w-full animate-pulse rounded-xl bg-muted/70" />
      <div className="h-96 animate-pulse rounded-2xl border border-card-border bg-card-bg" />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsClient />
    </Suspense>
  );
}
