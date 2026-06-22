import { Suspense } from "react";
import { ImpersonateClient } from "./impersonate-client";

function ImpersonateFallback() {
  return (
    <main className="min-h-screen bg-[#0b0b12] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-center text-indigo-300">
          🔐
        </div>
        <h1 className="text-xl font-semibold">Starting support session</h1>
        <p className="mt-2 text-sm text-zinc-400">Preparing secure impersonation flow...</p>
      </div>
    </main>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense fallback={<ImpersonateFallback />}>
      <ImpersonateClient />
    </Suspense>
  );
}
