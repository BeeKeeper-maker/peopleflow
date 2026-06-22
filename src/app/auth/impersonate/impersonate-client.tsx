"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export function ImpersonateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function exchangeToken() {
      const token = searchParams.get("token");
      if (!token) {
        setError("Missing impersonation token.");
        return;
      }

      const result = await signIn("impersonation", {
        token,
        redirect: false,
      });

      if (cancelled) return;
      if (result?.error) {
        setError(result.error);
        return;
      }

      router.replace("/dashboard");
    }

    exchangeToken().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Failed to start impersonation.");
    });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="min-h-screen bg-[#0b0b12] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-center text-indigo-300">
          🔐
        </div>
        <h1 className="text-xl font-semibold">Starting support session</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {error || "Verifying secure impersonation token..."}
        </p>
        {error && (
          <button
            onClick={() => router.replace("/platform/tenants")}
            className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
          >
            Back to platform
          </button>
        )}
      </div>
    </main>
  );
}
