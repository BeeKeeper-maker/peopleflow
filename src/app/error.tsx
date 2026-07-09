"use client";

import { ErrorFallback } from "@/components/error-fallback";

/**
 * Root error boundary.
 *
 * Catches uncaught errors thrown from any route segment below `app/`.
 * The actual fallback UI is shared with every route-level `error.tsx` via
 * `@/components/error-fallback` so the visual treatment stays consistent
 * across the app (single source of truth for the ErrorFallback component).
 */
export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return <ErrorFallback error={error} reset={reset} module="Application" />;
}
