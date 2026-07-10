"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseFetchOptions {
    /** Skip the initial fetch (useful for conditional fetches) */
    skip?: boolean;
    /** Dependencies that trigger a refetch when changed */
    deps?: unknown[];
}

interface UseFetchResult<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * useFetch — a hook that fetches data with proper loading/error states.
 *
 * This replaces the common pattern of:
 *   const [data, setData] = useState(null)
 *   const [loading, setLoading] = useState(true)
 *   useEffect(() => {
 *       fetch(url).then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false))
 *   }, [])
 *
 * With:
 *   const { data, loading, error, refetch } = useFetch(url)
 *
 * The key improvement: `error` is a string (not swallowed by console.error),
 * so the UI can show an error state instead of silently rendering an empty list.
 *
 * Usage in pages:
 *   const { data, loading, error, refetch } = useFetch("/api/employees")
 *   if (loading) return <Skeleton />
 *   if (error) return <ErrorState message={error} onRetry={refetch} />
 *   if (!data || data.length === 0) return <EmptyState />
 *   return <List data={data} />
 */
export function useFetch<T = unknown>(url: string | null, options: UseFetchOptions = {}): UseFetchResult<T> {
    const { skip = false, deps = [] } = options;
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(!skip);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const fetchData = useCallback(async () => {
        if (!url) {
            setLoading(false);
            return;
        }

        // Cancel previous request
        if (abortRef.current) {
            abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(url, { signal: controller.signal });

            if (!res.ok) {
                // Try to parse error message
                let message = `Request failed (${res.status})`;
                try {
                    const errData = await res.json();
                    message = errData.error || errData.message || message;
                } catch {
                    // Response is not JSON
                }
                setError(message);
                setData(null);
            } else {
                const json = await res.json();
                // Handle both { data: [...] } and raw array/object responses
                setData(json.data !== undefined ? json.data : json);
            }
        } catch (err) {
            // Don't set error if aborted (component unmounted or refetch called)
            if (err instanceof DOMException && err.name === "AbortError") return;

            const message = err instanceof Error ? err.message : "Network error. Please check your connection.";
            setError(message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [url]);

    useEffect(() => {
        if (!skip) {
            fetchData();
        } else {
            setLoading(false);
        }

        return () => {
            if (abortRef.current) {
                abortRef.current.abort();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, skip, ...deps]);

    const refetch = useCallback(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch };
}
