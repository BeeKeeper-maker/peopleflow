/**
 * API Client Utilities
 * 
 * Centralized fetch wrapper with:
 * - Error handling
 * - Type safety
 * - Base URL configuration
 * - Request/response interceptors
 */

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    message?: string;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
}

// API Error Class
export class ApiError extends Error {
    constructor(
        public code: string,
        message: string,
        public status: number,
        public details?: unknown
    ) {
        super(message);
        this.name = "ApiError";
    }
}

// Request options
interface RequestOptions extends Omit<RequestInit, "body"> {
    body?: unknown;
    params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(endpoint, window.location.origin);

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.append(key, String(value));
            }
        });
    }

    return url.toString();
}

/**
 * Main fetch wrapper
 */
export async function apiFetch<T>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<ApiResponse<T>> {
    const { body, params, headers: customHeaders, ...fetchOptions } = options;

    const url = buildUrl(endpoint, params);

    const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...customHeaders,
    };

    const config: RequestInit = {
        ...fetchOptions,
        headers,
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new ApiError(
                data.error?.code || "UNKNOWN_ERROR",
                data.error?.message || "An unexpected error occurred",
                response.status,
                data.error?.details
            );
        }

        return data as ApiResponse<T>;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        // Network or parsing error
        throw new ApiError(
            "NETWORK_ERROR",
            error instanceof Error ? error.message : "Network error occurred",
            0
        );
    }
}

// Convenience methods
export const api = {
    get: <T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) =>
        apiFetch<T>(endpoint, { method: "GET", params }),

    post: <T>(endpoint: string, body?: unknown) =>
        apiFetch<T>(endpoint, { method: "POST", body }),

    put: <T>(endpoint: string, body?: unknown) =>
        apiFetch<T>(endpoint, { method: "PUT", body }),

    patch: <T>(endpoint: string, body?: unknown) =>
        apiFetch<T>(endpoint, { method: "PATCH", body }),

    delete: <T>(endpoint: string) =>
        apiFetch<T>(endpoint, { method: "DELETE" }),
};
