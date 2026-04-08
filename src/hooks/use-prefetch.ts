"use client";

/**
 * Prefetch Hook — Maximum Aggression
 *
 * Returns onMouseEnter/onFocus handlers that trigger TanStack Query
 * prefetch for a given endpoint. Data is warm in cache before click.
 */

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

interface PrefetchConfig {
    /** TanStack Query key for the data */
    queryKey: readonly unknown[];
    /** API endpoint to prefetch */
    endpoint: string;
    /** Stale time in ms (default 30s — avoids re-fetching on rapid hovers) */
    staleTime?: number;
}

/**
 * Returns event handlers for aggressive route prefetching.
 *
 * @example
 * ```tsx
 * const prefetch = usePrefetch({
 *     queryKey: queryKeys.employees.lists(),
 *     endpoint: "/api/employees",
 * });
 *
 * <Link href="/employees" {...prefetch}>Employees</Link>
 * ```
 */
export function usePrefetch(config: PrefetchConfig) {
    const queryClient = useQueryClient();

    const triggerPrefetch = useCallback(() => {
        queryClient.prefetchQuery({
            queryKey: config.queryKey,
            queryFn: () => api.get(config.endpoint),
            staleTime: config.staleTime ?? 30_000,
        });
    }, [queryClient, config.queryKey, config.endpoint, config.staleTime]);

    return {
        onMouseEnter: triggerPrefetch,
        onFocus: triggerPrefetch,
    };
}

/**
 * Batch prefetch multiple routes at once.
 * Useful for prefetching when the sidebar mounts.
 */
export function useBatchPrefetch(configs: PrefetchConfig[]) {
    const queryClient = useQueryClient();

    const triggerAll = useCallback(() => {
        configs.forEach((config) => {
            queryClient.prefetchQuery({
                queryKey: config.queryKey,
                queryFn: () => api.get(config.endpoint),
                staleTime: config.staleTime ?? 30_000,
            });
        });
    }, [queryClient, configs]);

    return triggerAll;
}

/**
 * Pre-built prefetch configs for all major routes.
 * Import these in the sidebar for one-liner prefetch binding.
 */
export const PREFETCH_CONFIGS: Record<string, PrefetchConfig> = {
    "/employees": {
        queryKey: ["employees", "list"],
        endpoint: "/api/employees?limit=20",
    },
    "/departments": {
        queryKey: ["departments", "list"],
        endpoint: "/api/departments",
    },
    "/designations": {
        queryKey: ["designations", "list"],
        endpoint: "/api/designations",
    },
    "/leaves": {
        queryKey: ["leaves", "applications"],
        endpoint: "/api/leaves/applications",
    },
    "/attendance": {
        queryKey: ["attendance", "list"],
        endpoint: "/api/attendance",
    },
    "/payroll": {
        queryKey: ["payroll", "structures"],
        endpoint: "/api/payroll/structures",
    },
    "/recruitment": {
        queryKey: ["recruitment", "jobs"],
        endpoint: "/api/recruitment/jobs",
    },
    "/expenses": {
        queryKey: ["expenses", "claims"],
        endpoint: "/api/expenses/claims",
    },
    "/performance": {
        queryKey: ["performance", "goals"],
        endpoint: "/api/performance/goals",
    },
    "/notifications": {
        queryKey: ["notifications"],
        endpoint: "/api/notifications",
    },
};
