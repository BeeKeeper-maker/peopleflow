"use client";

/**
 * Data Fetching Hooks
 * 
 * Reusable React Query hooks for common data fetching patterns
 * Features:
 * - Automatic caching
 * - Background refetching
 * - Optimistic updates
 * - Pagination support
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { api, ApiResponse, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";

// ============================================
// Query Keys Factory
// ============================================

export const queryKeys = {
    // Employees
    employees: {
        all: ["employees"] as const,
        lists: () => [...queryKeys.employees.all, "list"] as const,
        list: (filters: Record<string, unknown>) => [...queryKeys.employees.lists(), filters] as const,
        details: () => [...queryKeys.employees.all, "detail"] as const,
        detail: (id: string) => [...queryKeys.employees.details(), id] as const,
    },
    // Departments
    departments: {
        all: ["departments"] as const,
        lists: () => [...queryKeys.departments.all, "list"] as const,
        list: (filters?: Record<string, unknown>) => [...queryKeys.departments.lists(), filters] as const,
        detail: (id: string) => [...queryKeys.departments.all, "detail", id] as const,
    },
    // Designations
    designations: {
        all: ["designations"] as const,
        list: (filters?: Record<string, unknown>) => [...queryKeys.designations.all, "list", filters] as const,
    },
    // Leaves
    leaves: {
        all: ["leaves"] as const,
        applications: (filters?: Record<string, unknown>) => [...queryKeys.leaves.all, "applications", filters] as const,
        types: () => [...queryKeys.leaves.all, "types"] as const,
        balance: (employeeId: string) => [...queryKeys.leaves.all, "balance", employeeId] as const,
    },
    // Attendance
    attendance: {
        all: ["attendance"] as const,
        list: (filters: Record<string, unknown>) => [...queryKeys.attendance.all, "list", filters] as const,
        today: (employeeId: string) => [...queryKeys.attendance.all, "today", employeeId] as const,
    },
    // Payroll
    payroll: {
        all: ["payroll"] as const,
        structures: () => [...queryKeys.payroll.all, "structures"] as const,
        slips: (filters?: Record<string, unknown>) => [...queryKeys.payroll.all, "slips", filters] as const,
    },
    // Search
    search: (query: string) => ["search", query] as const,
    // Notifications
    notifications: {
        all: ["notifications"] as const,
        unread: () => [...queryKeys.notifications.all, "unread"] as const,
    },
};

// ============================================
// Generic Hooks
// ============================================

/**
 * Hook for fetching a single resource
 */
export function useResource<T>(
    queryKey: readonly unknown[],
    endpoint: string,
    options?: Omit<UseQueryOptions<ApiResponse<T>, ApiError>, "queryKey" | "queryFn">
) {
    return useQuery<ApiResponse<T>, ApiError>({
        queryKey,
        queryFn: () => api.get<T>(endpoint),
        ...options,
    });
}

/**
 * Hook for fetching a list of resources with pagination
 */
export function useResourceList<T>(
    queryKey: readonly unknown[],
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: Omit<UseQueryOptions<ApiResponse<T[]>, ApiError>, "queryKey" | "queryFn">
) {
    return useQuery<ApiResponse<T[]>, ApiError>({
        queryKey,
        queryFn: () => api.get<T[]>(endpoint, params),
        ...options,
    });
}

/**
 * Hook for creating a resource
 */
export function useCreateResource<TData, TVariables>(
    endpoint: string,
    options?: {
        invalidateKeys?: readonly unknown[][];
        successMessage?: string;
        errorMessage?: string;
    }
) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<TData>, ApiError, TVariables>({
        mutationFn: (data) => api.post<TData>(endpoint, data),
        onSuccess: () => {
            if (options?.invalidateKeys) {
                options.invalidateKeys.forEach((key) => {
                    queryClient.invalidateQueries({ queryKey: key });
                });
            }
            if (options?.successMessage) {
                addToast({ title: options.successMessage, type: "success" });
            }
        },
        onError: (error) => {
            addToast({ title: options?.errorMessage || error.message, type: "error" });
        },
    });
}

/**
 * Hook for updating a resource
 */
export function useUpdateResource<TData, TVariables>(
    endpoint: string,
    options?: {
        invalidateKeys?: readonly unknown[][];
        successMessage?: string;
        errorMessage?: string;
    }
) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<TData>, ApiError, { id: string; data: TVariables }>({
        mutationFn: ({ id, data }) => api.put<TData>(`${endpoint}/${id}`, data),
        onSuccess: () => {
            if (options?.invalidateKeys) {
                options.invalidateKeys.forEach((key) => {
                    queryClient.invalidateQueries({ queryKey: key });
                });
            }
            if (options?.successMessage) {
                addToast({ title: options.successMessage, type: "success" });
            }
        },
        onError: (error) => {
            addToast({ title: options?.errorMessage || error.message, type: "error" });
        },
    });
}

/**
 * Hook for deleting a resource
 */
export function useDeleteResource(
    endpoint: string,
    options?: {
        invalidateKeys?: readonly unknown[][];
        successMessage?: string;
        errorMessage?: string;
    }
) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<void>, ApiError, string>({
        mutationFn: (id) => api.delete<void>(`${endpoint}/${id}`),
        onSuccess: () => {
            if (options?.invalidateKeys) {
                options.invalidateKeys.forEach((key) => {
                    queryClient.invalidateQueries({ queryKey: key });
                });
            }
            if (options?.successMessage) {
                addToast({ title: options.successMessage, type: "success" });
            }
        },
        onError: (error) => {
            addToast({ title: options?.errorMessage || error.message, type: "error" });
        },
    });
}

// ============================================
// Optimistic Mutation Hooks
// ============================================

/**
 * Optimistic create: instantly appends to a list cache, rolls back on error.
 */
export function useOptimisticCreate<TData, TVariables>(
    endpoint: string,
    options: {
        listQueryKey: readonly unknown[];
        invalidateKeys?: readonly unknown[][];
        successMessage?: string;
        errorMessage?: string;
        /** Transform variables into the optimistic cache entry */
        optimisticEntry?: (variables: TVariables) => Partial<TData>;
    }
) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<TData>, ApiError, TVariables, { previousData: unknown }>({
        mutationFn: (data) => api.post<TData>(endpoint, data),

        onMutate: async (variables) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: options.listQueryKey });

            // Snapshot previous value
            const previousData = queryClient.getQueryData(options.listQueryKey);

            // Optimistically add to list
            if (options.optimisticEntry) {
                queryClient.setQueryData(options.listQueryKey, (old: any) => {
                    if (!old) return old;
                    const entry = {
                        id: `temp-${Date.now()}`,
                        ...options.optimisticEntry!(variables),
                        _optimistic: true,
                    };
                    // Handle paginated vs flat responses
                    if (old?.data && Array.isArray(old.data)) {
                        return { ...old, data: [entry, ...old.data] };
                    }
                    if (Array.isArray(old)) {
                        return [entry, ...old];
                    }
                    return old;
                });
            }

            return { previousData };
        },

        onError: (_error, _variables, context) => {
            // Rollback to snapshot
            if (context?.previousData) {
                queryClient.setQueryData(options.listQueryKey, context.previousData);
            }
            addToast({ title: options.errorMessage || _error.message, type: "error" });
        },

        onSuccess: () => {
            if (options.successMessage) {
                addToast({ title: options.successMessage, type: "success" });
            }
        },

        onSettled: () => {
            // Always refetch for server truth
            queryClient.invalidateQueries({ queryKey: options.listQueryKey });
            options.invalidateKeys?.forEach((key) => {
                queryClient.invalidateQueries({ queryKey: key });
            });
        },
    });
}

/**
 * Optimistic update: instantly mutates an item in cache, rolls back on error.
 */
export function useOptimisticUpdate<TData, TVariables>(
    endpoint: string,
    options: {
        listQueryKey: readonly unknown[];
        invalidateKeys?: readonly unknown[][];
        successMessage?: string;
        errorMessage?: string;
        /** How to apply the update optimistically */
        applyUpdate?: (existing: TData, variables: TVariables) => TData;
    }
) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<TData>, ApiError, { id: string; data: TVariables }, { previousData: unknown }>({
        mutationFn: ({ id, data }) => api.put<TData>(`${endpoint}/${id}`, data),

        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: options.listQueryKey });
            const previousData = queryClient.getQueryData(options.listQueryKey);

            if (options.applyUpdate) {
                queryClient.setQueryData(options.listQueryKey, (old: any) => {
                    if (!old) return old;
                    const items = old?.data && Array.isArray(old.data) ? old.data : Array.isArray(old) ? old : null;
                    if (!items) return old;

                    const updated = items.map((item: any) =>
                        item.id === id ? options.applyUpdate!(item, data) : item
                    );

                    if (old?.data) return { ...old, data: updated };
                    return updated;
                });
            }

            return { previousData };
        },

        onError: (_error, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(options.listQueryKey, context.previousData);
            }
            addToast({ title: options.errorMessage || _error.message, type: "error" });
        },

        onSuccess: () => {
            if (options.successMessage) addToast({ title: options.successMessage, type: "success" });
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: options.listQueryKey });
            options.invalidateKeys?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
        },
    });
}

/**
 * Optimistic delete: instantly removes from list, rolls back on error.
 */
export function useOptimisticDelete(
    endpoint: string,
    options: {
        listQueryKey: readonly unknown[];
        invalidateKeys?: readonly unknown[][];
        successMessage?: string;
        errorMessage?: string;
    }
) {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<void>, ApiError, string, { previousData: unknown }>({
        mutationFn: (id) => api.delete<void>(`${endpoint}/${id}`),

        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: options.listQueryKey });
            const previousData = queryClient.getQueryData(options.listQueryKey);

            queryClient.setQueryData(options.listQueryKey, (old: any) => {
                if (!old) return old;
                const items = old?.data && Array.isArray(old.data) ? old.data : Array.isArray(old) ? old : null;
                if (!items) return old;
                const filtered = items.filter((item: any) => item.id !== id);
                if (old?.data) return { ...old, data: filtered };
                return filtered;
            });

            return { previousData };
        },

        onError: (_error, _id, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(options.listQueryKey, context.previousData);
            }
            addToast({ title: options.errorMessage || _error.message, type: "error" });
        },

        onSuccess: () => {
            if (options.successMessage) addToast({ title: options.successMessage, type: "success" });
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: options.listQueryKey });
            options.invalidateKeys?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
        },
    });
}

// ============================================
// Specific Hooks
// ============================================

/**
 * Fetch employees with filters
 */
export function useEmployees(filters?: {
    page?: number;
    limit?: number;
    departmentId?: string;
    status?: string;
    search?: string;
}) {
    return useResourceList(
        queryKeys.employees.list(filters || {}),
        "/api/employees",
        filters ? {
            page: filters.page,
            limit: filters.limit,
            departmentId: filters.departmentId,
            status: filters.status,
            search: filters.search,
        } : undefined
    );
}

/**
 * Fetch single employee
 */
export function useEmployee(id: string) {
    return useResource(
        queryKeys.employees.detail(id),
        `/api/employees/${id}`,
        { enabled: !!id }
    );
}

/**
 * Fetch departments
 */
export function useDepartments() {
    return useResourceList(
        queryKeys.departments.lists(),
        "/api/departments"
    );
}

/**
 * Fetch designations
 */
export function useDesignations() {
    return useResourceList(
        queryKeys.designations.list(),
        "/api/designations"
    );
}

/**
 * Global search
 */
export function useSearch(query: string) {
    return useQuery({
        queryKey: queryKeys.search(query),
        queryFn: () => api.get("/api/search", { q: query }),
        enabled: query.length >= 2,
        staleTime: 60 * 1000, // 1 minute
    });
}

/**
 * Leave types
 */
export function useLeaveTypes() {
    return useResourceList(
        queryKeys.leaves.types(),
        "/api/leaves/types"
    );
}

/**
 * Leave applications (with optional filters)
 *
 * Returns a flat array of LeaveApplication records (not wrapped in ApiResponse)
 * because the /api/leaves/applications endpoint returns { data, pagination }
 * directly, not the standard ApiResponse envelope.
 */
export interface LeaveApplicationRecord {
    id: string;
    leaveType: { name: string; color: string; code: string };
    employee: {
        firstName: string;
        lastName: string;
        photoUrl: string | null;
        designation?: { name: string };
    };
    fromDate: string;
    toDate: string;
    totalDays: number;
    status: string;
    reason: string | null;
    createdAt: string;
}

export function useLeaveApplications(filters?: {
    employeeId?: string;
    status?: string;
    year?: number;
    month?: number;
    page?: number;
    limit?: number;
}) {
    return useQuery<LeaveApplicationRecord[], ApiError>({
        queryKey: queryKeys.leaves.applications(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.employeeId) params.set("employeeId", filters.employeeId);
            if (filters?.status) params.set("status", filters.status);
            if (filters?.year) params.set("year", String(filters.year));
            if (filters?.month) params.set("month", String(filters.month));
            if (filters?.page) params.set("page", String(filters.page));
            if (filters?.limit) params.set("limit", String(filters.limit));

            const url = `/api/leaves/applications${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "LEAVE_FETCH_ERROR"),
                    String(err.error || "Failed to load leave applications"),
                    res.status
                );
            }
            const json = await res.json();
            // API returns { data, pagination } — extract the data array
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 60 * 1000, // 1 minute — leaves change frequently
    });
}

/**
 * Payroll structures
 */
export function usePayrollStructures() {
    return useResourceList(
        queryKeys.payroll.structures(),
        "/api/payroll/structures"
    );
}

/**
 * Active payroll assignments (employees with salary structures)
 *
 * Returns a flat array — the /api/payroll/assignments endpoint returns
 * the array directly (or wrapped in {data: [...]}, both shapes handled).
 */
export interface PayrollAssignmentRecord {
    id: string;
    grossSalary: number;
    effectiveFrom: string;
    isActive: boolean;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
        designation?: { name: string };
    };
    salaryStructure: { id: string; name: string };
    breakdown: {
        basic: number;
        houseRent: number;
        medical: number;
        conveyance: number;
        totalEarnings: number;
        pfEmployee: number;
        netSalary: number;
    };
}

export function usePayrollAssignments(activeOnly = true) {
    return useQuery<PayrollAssignmentRecord[], ApiError>({
        queryKey: [...queryKeys.payroll.all, "assignments", { active: activeOnly }],
        queryFn: async () => {
            const url = `/api/payroll/assignments${activeOnly ? "?active=true" : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ASSIGNMENT_FETCH_ERROR"),
                    String(err.error || "Failed to load payroll assignments"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — assignments change rarely
    });
}

/**
 * Salary slips for a given month/year
 *
 * Returns a flat array — the /api/payroll/process endpoint returns
 * the array directly (or wrapped in {slips: [...], data: [...]}, both handled).
 */
export interface SalarySlipRecord {
    id: string;
    month: number;
    year: number;
    grossSalary: number;
    netSalary: number;
    totalDeductions: number;
    status: string;
    isLocked?: boolean;
    isReversed?: boolean;
    employee: {
        firstName: string;
        lastName: string;
        employeeCode: string;
        department?: { name: string };
    };
}

export function useSalarySlips(month: number, year: number) {
    return useQuery<SalarySlipRecord[], ApiError>({
        queryKey: [...queryKeys.payroll.all, "slips", { month, year }],
        queryFn: async () => {
            const url = `/api/payroll/process?month=${month}&year=${year}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "SLIPS_FETCH_ERROR"),
                    String(err.error || "Failed to load salary slips"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || json.slips || []);
        },
        staleTime: 60 * 1000, // 1 minute — slips change during payroll processing
    });
}
