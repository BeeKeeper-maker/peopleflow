"use client";

/**
 * React Query Provider
 * 
 * Centralized query configuration with:
 * - Smart caching (5 min stale time)
 * - Automatic refetch on focus
 * - Retry logic with backoff
 * - Error handling
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

const defaultQueryOptions = {
    queries: {
        // Data is fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        // Keep cached data for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Refetch on window focus
        refetchOnWindowFocus: true,
        // Retry failed requests 3 times with exponential backoff
        retry: 3,
        retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Don't refetch on mount if data is fresh
        refetchOnMount: true,
    },
    mutations: {
        // Retry mutations once
        retry: 1,
    },
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
    // Create client inside component to avoid sharing state between requests
    const [queryClient] = useState(
        () => new QueryClient({
            defaultOptions: defaultQueryOptions,
        })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {process.env.NODE_ENV === "development" && (
                <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
            )}
        </QueryClientProvider>
    );
}
