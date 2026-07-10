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
import type { RegisterResult, FormCode } from "@/lib/statutory-registers";

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
    // ESS (Employee Self-Service) — current employee's own data
    ess: {
        all: ["ess"] as const,
        leaveBalances: () => [...queryKeys.ess.all, "leave-balances"] as const,
        leaveApplications: (filters?: Record<string, unknown>) => [...queryKeys.ess.all, "leave-applications", filters] as const,
        attendance: (filters?: Record<string, unknown>) => [...queryKeys.ess.all, "attendance", filters] as const,
        todayAttendance: () => [...queryKeys.ess.all, "attendance-today"] as const,
        payslips: () => [...queryKeys.ess.all, "payslips"] as const,
        loans: () => [...queryKeys.ess.all, "loans"] as const,
        expenses: (filters?: Record<string, unknown>) => [...queryKeys.ess.all, "expenses", filters] as const,
        documents: () => [...queryKeys.ess.all, "documents"] as const,
        announcements: () => [...queryKeys.ess.all, "announcements"] as const,
        profile: () => [...queryKeys.ess.all, "profile"] as const,
        performanceGoals: (filters?: Record<string, unknown>) => [...queryKeys.ess.all, "performance-goals", filters] as const,
    },
    // Manager portal — scoped to the signed-in manager's direct reportees
    manager: {
        all: ["manager"] as const,
        team: () => [...queryKeys.manager.all, "team"] as const,
        approvals: (filters?: Record<string, unknown>) => [...queryKeys.manager.all, "approvals", filters] as const,
        leaves: (filters?: Record<string, unknown>) => [...queryKeys.manager.all, "leaves", filters] as const,
        attendance: (filters?: Record<string, unknown>) => [...queryKeys.manager.all, "attendance", filters] as const,
        reviews: () => [...queryKeys.manager.all, "reviews"] as const,
    },
    // Settings — org-wide configuration pages (rarely change)
    settings: {
        all: ["settings"] as const,
        org: () => [...queryKeys.settings.all, "org"] as const,
        customFields: (filters?: Record<string, unknown>) => [...queryKeys.settings.all, "custom-fields", filters] as const,
        exchangeRates: () => [...queryKeys.settings.all, "exchange-rates"] as const,
        notificationPreferences: () => [...queryKeys.settings.all, "notification-preferences"] as const,
    },
    // RBAC — roles, permissions catalog, and time-bounded delegations
    rbac: {
        all: ["rbac"] as const,
        roles: () => [...queryKeys.rbac.all, "roles"] as const,
        permissions: () => [...queryKeys.rbac.all, "permissions"] as const,
        delegations: () => [...queryKeys.rbac.all, "delegations"] as const,
    },
    // Policies — late deduction tiers, etc.
    policies: {
        all: ["policies"] as const,
        lateDeduction: () => [...queryKeys.policies.all, "late-deduction"] as const,
    },
    // Access — user login & role governance (/api/access/users)
    access: {
        all: ["access"] as const,
        users: () => [...queryKeys.access.all, "users"] as const,
    },
    // Recruitment — job postings, candidates, and applications (pipeline)
    recruitment: {
        all: ["recruitment"] as const,
        jobs: {
            lists: () => [...queryKeys.recruitment.all, "jobs", "list"] as const,
            list: (filters: Record<string, unknown>) => [...queryKeys.recruitment.jobs.lists(), filters] as const,
            details: () => [...queryKeys.recruitment.all, "jobs", "detail"] as const,
            detail: (id: string) => [...queryKeys.recruitment.jobs.details(), id] as const,
        },
        candidates: {
            lists: () => [...queryKeys.recruitment.all, "candidates", "list"] as const,
            list: (filters: Record<string, unknown>) => [...queryKeys.recruitment.candidates.lists(), filters] as const,
        },
        applications: {
            lists: () => [...queryKeys.recruitment.all, "applications", "list"] as const,
            list: (filters: Record<string, unknown>) => [...queryKeys.recruitment.applications.lists(), filters] as const,
        },
    },
    // Reports — saved custom reports + statutory (BLA 2006) + attendance overview
    reports: {
        all: ["reports"] as const,
        saved: () => [...queryKeys.reports.all, "saved"] as const,
        statutory: (form: string | null, month: number, year: number) =>
            [...queryKeys.reports.all, "statutory", form, month, year] as const,
        attendance: (filters?: Record<string, unknown>) =>
            [...queryKeys.reports.all, "attendance", filters] as const,
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
export function useDepartments(includeInactive = false) {
    return useQuery<unknown[], ApiError>({
        queryKey: queryKeys.departments.list({ all: includeInactive }),
        queryFn: async () => {
            const url = `/api/departments${includeInactive ? "?all=true" : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "DEPARTMENTS_FETCH_ERROR"),
                    String(err.error || "Failed to load departments"),
                    res.status
                );
            }
            const json = await res.json();
            // /api/departments returns array directly, not { data: [...] }
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — departments change rarely
    });
}

/**
 * Fetch designations
 */
export function useDesignations(includeInactive = false) {
    return useQuery<unknown[], ApiError>({
        queryKey: queryKeys.designations.list({ all: includeInactive }),
        queryFn: async () => {
            const url = `/api/designations${includeInactive ? "?all=true" : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "DESIGNATIONS_FETCH_ERROR"),
                    String(err.error || "Failed to load designations"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — designations change rarely
    });
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
    // Payment metadata — populated after a slip is marked paid or disbursed
    // via bKash/Nagad/bank_transfer. Used by the payroll UI to decide whether
    // to show the "Disburse via bKash" action.
    paymentMode?: string | null;
    transactionRef?: string | null;
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

/**
 * Attendance regularization requests
 *
 * Returns the requests array from { requests: [...] } envelope.
 * Used by the Attendance page's Regularization tab.
 */
export interface RegularizationRequestRecord {
    id: string;
    date: string;
    reason: string;
    requestedCheckIn?: string;
    requestedCheckOut?: string;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
    employee: {
        firstName: string;
        lastName: string;
        employeeCode: string;
        department?: { name: string };
    };
    approvedBy?: {
        firstName: string;
        lastName: string;
    };
}

export function useRegularizationRequests(statusFilter: "all" | "pending" | "approved" | "rejected" = "all", enabled = true) {
    return useQuery<RegularizationRequestRecord[], ApiError>({
        queryKey: [...queryKeys.attendance.all, "regularization", { status: statusFilter }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter !== "all") params.set("status", statusFilter);
            const url = `/api/attendance/regularization${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "REGULARIZATION_FETCH_ERROR"),
                    String(err.error || "Failed to load regularization requests"),
                    res.status
                );
            }
            const json = await res.json();
            return json.requests || [];
        },
        enabled,
        staleTime: 60 * 1000, // 1 minute — requests change frequently
    });
}

/**
 * Loans list
 *
 * Returns the array directly from /api/loans (no envelope).
 */
export interface LoanRecord {
    id: string;
    type: string;
    amount: number;
    interestRate: number;
    tenure: number;
    emiAmount: number;
    disbursedAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    reason?: string | null;
    createdAt: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
    };
}

export function useLoans() {
    return useQuery<LoanRecord[], ApiError>({
        queryKey: ["loans", "list"],
        queryFn: async () => {
            const res = await fetch("/api/loans", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "LOANS_FETCH_ERROR"),
                    String(err.error || "Failed to load loans"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || json.loans || []);
        },
        staleTime: 60 * 1000, // 1 minute — loan status changes frequently
    });
}

/**
 * Notifications list
 *
 * Returns the notifications array from { notifications: [...] } envelope.
 */
export interface NotificationRecord {
    id: string;
    type: string;
    title: string;
    message?: string;
    isRead: boolean;
    createdAt: string;
    link?: string;
}

export function useNotifications(limit?: number, unreadOnly = false) {
    return useQuery<NotificationRecord[], ApiError>({
        queryKey: [...queryKeys.notifications.all, { limit, unread: unreadOnly }],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (limit) params.set("limit", String(limit));
            if (unreadOnly) params.set("unread", "true");
            const url = `/api/notifications${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "NOTIFICATIONS_FETCH_ERROR"),
                    String(err.error || "Failed to load notifications"),
                    res.status
                );
            }
            const json = await res.json();
            return json.notifications || json.data || (Array.isArray(json) ? json : []);
        },
        staleTime: 30 * 1000, // 30 seconds — notifications should feel real-time
    });
}

/**
 * Biometric devices list
 *
 * Returns the array from /api/biometric-devices (no envelope).
 */
export interface BiometricDeviceRecord {
    id: string;
    name: string;
    serialNumber: string | null;
    model: string;
    ip: string;
    port: number;
    connectionType: string;
    connectionMode: string;
    cloudProtocol: string | null;
    cloudStatus: string;
    lastSeenAt: string | null;
    firmwareVersion: string | null;
    timezone: string;
    setupNotes: string | null;
    location: string | null;
    isActive: boolean;
    isOnline: boolean;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    syncInterval: number;
    branchId: string | null;
    branch: { id: string; name: string; code: string } | null;
    _count?: { syncLogs: number };
    createdAt: string;
}

export function useBiometricDevices() {
    return useQuery<BiometricDeviceRecord[], ApiError>({
        queryKey: ["biometric-devices", "list"],
        queryFn: async () => {
            const res = await fetch("/api/biometric-devices", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "DEVICES_FETCH_ERROR"),
                    String(err.error || "Failed to load biometric devices"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || json.devices || []);
        },
        staleTime: 60 * 1000, // 1 minute — device status changes periodically
    });
}

/**
 * Device events (cloud event log)
 *
 * Returns the array from /api/biometric-devices/events (no envelope).
 */
export interface DeviceEventRecord {
    id: string;
    serialNumber: string | null;
    eventType: string;
    method: string;
    status: string;
    recordsReceived: number;
    recordsSynced: number;
    recordsSkipped: number;
    unmappedUserIds: string[];
    errorMessage: string | null;
    remoteIp: string | null;
    createdAt: string;
    device: {
        id: string;
        name: string;
        location: string | null;
        cloudStatus: string;
        lastSeenAt: string | null;
        branch: { name: string; code: string } | null;
    } | null;
}

export function useDeviceEvents(filters?: {
    status?: string;
    eventType?: string;
    search?: string;
    limit?: number;
}) {
    return useQuery<DeviceEventRecord[], ApiError>({
        queryKey: ["biometric-devices", "events", filters || {}],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("limit", String(filters?.limit ?? 120));
            if (filters?.status && filters.status !== "all") params.set("status", filters.status);
            if (filters?.eventType && filters.eventType !== "all") params.set("eventType", filters.eventType);
            if (filters?.search?.trim()) params.set("serial", filters.search.trim());
            const url = `/api/biometric-devices/events?${params.toString()}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "DEVICE_EVENTS_FETCH_ERROR"),
                    String(err.error || "Failed to load device events"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || json.events || []);
        },
        staleTime: 30 * 1000, // 30 seconds — events should feel real-time
    });
}

// ============================================
// ESS (Employee Self-Service) Hooks
// ============================================
//
// These hooks fetch the *current employee's* own data — the API routes rely
// on the authenticated session (auth.employeeId) so no explicit employeeId
// needs to be passed. Each hook mirrors the response shape of its API route
// (some return arrays directly, some return wrapped objects).

// ── a) Leave balances ───────────────────────────────────────────────────────
// /api/leaves/allocations returns an array directly (NextResponse.json(result)).
export interface EssLeaveBalance {
    leaveType: {
        id: string;
        name: string;
        nameBn?: string;
        code: string;
        color?: string;
    };
    allocatedDays: number;
    usedDays: number;
    carriedForward: number;
    remainingDays: number;
}

export function useEssLeaveBalances() {
    return useQuery<EssLeaveBalance[], ApiError>({
        queryKey: queryKeys.ess.leaveBalances(),
        queryFn: async () => {
            const res = await fetch("/api/leaves/allocations", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_LEAVE_BALANCE_ERROR"),
                    String(err.error || "Failed to load leave balances"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 60 * 1000, // 1 minute — balances change with each application
    });
}

// ── b) Leave applications (ESS scope: current employee only) ─────────────────
// /api/leaves/applications returns { data, pagination }.
export interface EssLeaveApplication {
    id: string;
    leaveType: {
        id: string;
        name: string;
        code: string;
        color?: string;
    };
    fromDate: string;
    toDate: string;
    totalDays: number;
    reason: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    createdAt: string;
    approvedBy?: {
        firstName: string;
        lastName: string;
    };
    rejectionReason?: string;
}

export function useEssLeaveApplications(filters?: {
    status?: string;
    year?: number;
    month?: number;
    page?: number;
    limit?: number;
}) {
    return useQuery<EssLeaveApplication[], ApiError>({
        queryKey: queryKeys.ess.leaveApplications(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
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
                    String(err.code || "ESS_LEAVE_APPLICATIONS_ERROR"),
                    String(err.error || "Failed to load leave applications"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 60 * 1000, // 1 minute — applications change frequently
    });
}

// ── c) Attendance records (date range or year/month) ───────────────────────
// /api/attendance returns an array directly (NextResponse.json(attendances.map)).
export interface EssAttendanceRecord {
    id: string;
    date: string;
    status?: string;
    checkInTime?: string;
    checkOutTime?: string;
    totalMinutes?: number;
    lateMinutes?: number;
    earlyLeaveMinutes?: number;
    overtimeMinutes?: number;
    employee?: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
    };
}

export function useEssAttendance(filters?: {
    startDate?: string;
    endDate?: string;
    year?: number;
    month?: number;
    date?: string;
}) {
    return useQuery<EssAttendanceRecord[], ApiError>({
        queryKey: queryKeys.ess.attendance(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.startDate) params.set("startDate", filters.startDate);
            if (filters?.endDate) params.set("endDate", filters.endDate);
            if (filters?.year) params.set("year", String(filters.year));
            if (filters?.month) params.set("month", String(filters.month));
            if (filters?.date) params.set("date", filters.date);

            const url = `/api/attendance${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_ATTENDANCE_ERROR"),
                    String(err.error || "Failed to load attendance records"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 30 * 1000, // 30 seconds — attendance is real-time
    });
}

// ── d) Payslips ────────────────────────────────────────────────────────────
// /api/payroll/payslips returns { data: [...], total }.
export interface EssPayslip {
    id: string;
    month: number;
    year: number;
    basicSalary: number;
    houseRent: number;
    medicalAllowance: number;
    conveyance: number;
    specialAllowance?: number;
    overtime?: number;
    bonus?: number;
    festivalBonus?: number;
    arrears?: number;
    otherEarnings: number;
    pfEmployee: number;
    pfEmployer?: number;
    incomeTax: number;
    loanDeduction?: number;
    absentDeduction?: number;
    lateDeduction?: number;
    otherDeductions: number;
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    status: "draft" | "approved" | "paid" | "reversed";
    paymentDate?: string;
    paymentMode?: string;
    presentDays?: number;
    absentDays?: number;
    leaveDays?: number;
    totalWorkingDays?: number;
}

export function useEssPayslips() {
    return useQuery<EssPayslip[], ApiError>({
        queryKey: queryKeys.ess.payslips(),
        queryFn: async () => {
            const res = await fetch("/api/payroll/payslips", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_PAYSLIPS_ERROR"),
                    String(err.error || "Failed to load payslips"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 5 * 60 * 1000, // 5 minutes — payslips change rarely
    });
}

// ── e) Loans ────────────────────────────────────────────────────────────────
// /api/loans returns an array directly. Includes nested repayments + approver.
export interface EssLoanRepayment {
    id: string;
    installmentNo: number;
    amount: number;
    principalPart: number;
    interestPart: number;
    paidDate: string;
    method: string;
}

export interface EssLoan {
    id: string;
    type: string;
    amount: number;
    interestRate: number;
    tenure: number;
    emiAmount: number;
    disbursedAmount: number;
    paidAmount: number;
    remainingAmount: number;
    reason?: string | null;
    status: string;
    approvedAt?: string;
    disbursedAt?: string;
    createdAt: string;
    approver?: { firstName: string; lastName: string } | null;
    repayments: EssLoanRepayment[];
}

export function useEssLoans() {
    return useQuery<EssLoan[], ApiError>({
        queryKey: queryKeys.ess.loans(),
        queryFn: async () => {
            const res = await fetch("/api/loans", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_LOANS_ERROR"),
                    String(err.error || "Failed to load loans"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || json.loans || []);
        },
        staleTime: 60 * 1000, // 1 minute — loan status changes periodically
    });
}

// ── f) Expense claims ───────────────────────────────────────────────────────
// /api/expenses/claims returns an array directly.
export interface EssExpenseClaim {
    id: string;
    claimNumber: string;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    date: string;
    expenseDate?: string;
    status: "draft" | "submitted" | "pending" | "approved" | "rejected" | "reimbursed";
    receiptUrl?: string;
    receiptName?: string;
    category?: { name?: string } | string;
    createdAt: string;
}

export function useEssExpenses(filters?: {
    status?: string;
    pending?: boolean;
}) {
    return useQuery<EssExpenseClaim[], ApiError>({
        queryKey: queryKeys.ess.expenses(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.set("status", filters.status);
            if (filters?.pending) params.set("pending", "true");

            const url = `/api/expenses/claims${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_EXPENSES_ERROR"),
                    String(err.error || "Failed to load expense claims"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || json.claims || []);
        },
        staleTime: 60 * 1000, // 1 minute — claim status changes frequently
    });
}

// ── g) Document requests ────────────────────────────────────────────────────
// The ESS documents page fetches from /api/ess/document-request (NOT
// /api/employee-documents, which is admin-only). The endpoint returns an
// array directly.
export interface EssDocumentRequest {
    id: string;
    type: string;
    status: string;
    documentUrl?: string;
    rejectionNote?: string;
    createdAt: string;
    processedAt?: string;
}

export function useEssDocuments() {
    return useQuery<EssDocumentRequest[], ApiError>({
        queryKey: queryKeys.ess.documents(),
        queryFn: async () => {
            const res = await fetch("/api/ess/document-request", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_DOCUMENTS_ERROR"),
                    String(err.error || "Failed to load document requests"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || json.requests || []);
        },
        staleTime: 60 * 1000, // 1 minute — document status changes infrequently
    });
}

// ── h) Announcements (active only) ─────────────────────────────────────────
// /api/announcements?active=true returns an array directly.
export interface EssAnnouncementAuthor {
    id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string;
}

export interface EssAnnouncement {
    id: string;
    title: string;
    content: string;
    type: string;
    priority: string;
    isPinned: boolean;
    isActive: boolean;
    publishDate: string;
    expiryDate?: string;
    createdAt: string;
    author?: EssAnnouncementAuthor | null;
}

export function useEssAnnouncements() {
    return useQuery<EssAnnouncement[], ApiError>({
        queryKey: queryKeys.ess.announcements(),
        queryFn: async () => {
            const res = await fetch("/api/announcements?active=true", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_ANNOUNCEMENTS_ERROR"),
                    String(err.error || "Failed to load announcements"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || json.announcements || []);
        },
        staleTime: 60 * 1000, // 1 minute — announcements change infrequently
    });
}

// ── i) Profile (current employee) ───────────────────────────────────────────
// /api/employees/me returns { data: { id, name, email, role, employee, organization } }.
export interface EssEmployeeProfile {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    personalEmail?: string;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
    maritalStatus?: string;
    nationality?: string;
    nidNumber?: string;
    photoUrl?: string;
    department?: { name: string };
    designation?: { name: string };
    joiningDate?: string;
    employmentType?: string;
    reportingManager?: { firstName: string; lastName: string };
    shift?: { name: string };
    branch?: { name: string };
    presentAddress?: string;
    permanentAddress?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankRoutingNumber?: string;
}

export interface EssProfileResponse {
    id: string;
    name?: string;
    email?: string;
    role?: string;
    employee: EssEmployeeProfile | null;
    organization?: { name: string; industry?: string } | null;
}

export function useEssProfile() {
    return useQuery<EssEmployeeProfile | null, ApiError>({
        queryKey: queryKeys.ess.profile(),
        queryFn: async () => {
            const res = await fetch("/api/employees/me", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_PROFILE_ERROR"),
                    String(err.error || "Failed to load profile"),
                    res.status
                );
            }
            const json = await res.json();
            // /api/employees/me returns { data: { employee: {...}, ... } }
            // or (when no employee record linked) { data: { ..., employee: null } }
            const data = json?.data?.employee !== undefined
                ? json.data.employee
                : (json?.data?.employee ?? json?.employee ?? json?.data ?? null);
            return data || null;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — profile data changes rarely
    });
}

// ── j) Today's attendance ───────────────────────────────────────────────────
// /api/attendance/today returns { attendance, shift }.
export interface EssTodayShift {
    id: string;
    name: string;
    startTime?: string;
    endTime?: string;
    gracePeriodMinutes?: number;
    lateThresholdMinutes?: number;
    workingHours?: number;
}

export interface EssTodayAttendanceResponse {
    attendance: {
        id: string;
        date: string;
        checkIn: string | null;
        checkOut: string | null;
        status?: string;
        lateMinutes?: number;
        earlyLeaveMinutes?: number;
        overtimeMinutes?: number;
        totalMinutes?: number;
    } | null;
    shift: EssTodayShift | null;
}

export function useEssTodayAttendance() {
    return useQuery<EssTodayAttendanceResponse, ApiError>({
        queryKey: queryKeys.ess.todayAttendance(),
        queryFn: async () => {
            const res = await fetch("/api/attendance/today", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_TODAY_ATTENDANCE_ERROR"),
                    String(err.error || "Failed to load today's attendance"),
                    res.status
                );
            }
            const json = await res.json();
            // The endpoint always returns { attendance, shift } — fall back to
            // a safe empty payload if the shape is unexpected.
            if (json && typeof json === "object" && "attendance" in json) {
                return json as EssTodayAttendanceResponse;
            }
            return { attendance: null, shift: null };
        },
        staleTime: 30 * 1000, // 30 seconds — attendance should feel real-time
    });
}

// ── k) Performance goals (ESS scope: current employee) ──────────────────────
// /api/performance/goals?my=true returns { data: [...] } (successResponse wrapper)
// or an array. Used by the ESS performance page.
export interface EssKeyResult {
    id: string;
    title: string;
    targetValue: number;
    currentValue: number;
    unit?: string;
    status: string;
}

export interface EssPerformanceGoal {
    id: string;
    title: string;
    description?: string;
    type: string;
    priority: string;
    status: string;
    progress: number;
    startDate?: string;
    dueDate?: string;
    completedAt?: string;
    keyResults: EssKeyResult[];
}

export function useEssPerformanceGoals(filters?: { status?: string; my?: boolean }) {
    return useQuery<EssPerformanceGoal[], ApiError>({
        queryKey: queryKeys.ess.performanceGoals(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            // ESS scope: always request only "my" goals
            params.set("my", "true");
            if (filters?.status) params.set("status", filters.status);

            const url = `/api/performance/goals?${params.toString()}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ESS_PERFORMANCE_ERROR"),
                    String(err.error || "Failed to load performance goals"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || json.goals || []);
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — goals change infrequently
    });
}

// ============================================
// Manager Portal Hooks
// ============================================
//
// The /api/manager/* and /api/leaves/applications + /api/attendance + /api/performance/reviews
// endpoints auto-scope to the signed-in manager's direct reportees when the caller's role is
// "manager". Admin/HR roles see the org-wide result set. These hooks wrap those endpoints with
// the manager-namespaced query keys so manager-portal caches are isolated from ESS caches.

/**
 * Manager's team — direct reportees
 *
 * Returns the array from /api/manager/team { data: [...] } envelope.
 */
export interface ManagerTeamMember {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    photoUrl?: string | null;
    joiningDate?: string | null;
    employmentStatus?: string;
    employeeCode?: string;
    department?: { name: string } | null;
    designation?: { name: string } | null;
    reportingManager?: { id: string; firstName: string; lastName: string } | null;
}

export function useManagerTeam() {
    return useQuery<ManagerTeamMember[], ApiError>({
        queryKey: queryKeys.manager.team(),
        queryFn: async () => {
            const res = await fetch("/api/manager/team", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "MANAGER_TEAM_FETCH_ERROR"),
                    String(err.error || "Failed to load team members"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 60 * 1000, // 1 minute — team membership changes occasionally
    });
}

/**
 * Pending approvals for the manager — combined leaves + expenses
 *
 * Issues two parallel requests:
 *   - /api/leaves/applications?status=<status>&limit=100
 *   - /api/expenses/claims?pending=true
 *
 * The /api/leaves/applications and /api/expenses/claims endpoints auto-scope
 * to the manager's direct reportees when the caller's role is "manager".
 */
export interface ManagerLeaveApproval {
    id: string;
    employeeId?: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        photoUrl?: string | null;
        designation?: { name: string } | null;
    };
    leaveType: { name: string; code?: string | null };
    fromDate: string;
    toDate: string;
    totalDays: number;
    reason: string | null;
    status: string;
    createdAt: string;
    appliedAt?: string | null;
}

export interface ManagerExpenseApproval {
    id: string;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        photoUrl?: string | null;
        designation?: { name: string } | null;
    };
    title?: string | null;
    category: string | { name?: string | null } | null;
    amount: number;
    description: string | null;
    status: string;
    createdAt: string;
}

export interface ManagerApprovalsResult {
    leaves: ManagerLeaveApproval[];
    expenses: ManagerExpenseApproval[];
}

export function useManagerApprovals(status: string = "pending") {
    return useQuery<ManagerApprovalsResult, ApiError>({
        queryKey: queryKeys.manager.approvals({ status }),
        queryFn: async () => {
            const [leavesRes, expensesRes] = await Promise.all([
                fetch(`/api/leaves/applications?status=${encodeURIComponent(status)}&limit=100`, { credentials: "include" }),
                fetch("/api/expenses/claims?pending=true", { credentials: "include" }),
            ]);

            let leaves: ManagerLeaveApproval[] = [];
            let expenses: ManagerExpenseApproval[] = [];

            if (leavesRes.ok) {
                const data = await leavesRes.json();
                leaves = Array.isArray(data) ? data : (data.data || []);
            }

            if (expensesRes.ok) {
                const data = await expensesRes.json();
                expenses = Array.isArray(data) ? data : (data.data || data.claims || []);
            }

            return { leaves, expenses };
        },
        staleTime: 30 * 1000, // 30 seconds — approvals are time-sensitive
    });
}

/**
 * Leave applications for the manager's team
 *
 * Wraps /api/leaves/applications (which auto-scopes to direct reportees for
 * managers) with a manager-namespaced cache key.
 */
export function useManagerLeaves(filters?: {
    status?: string;
    year?: number;
    month?: number;
    limit?: number;
}) {
    return useQuery<ManagerLeaveApproval[], ApiError>({
        queryKey: queryKeys.manager.leaves(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.set("status", filters.status);
            if (filters?.year) params.set("year", String(filters.year));
            if (filters?.month) params.set("month", String(filters.month));
            if (filters?.limit) params.set("limit", String(filters.limit));
            const url = `/api/leaves/applications${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "MANAGER_LEAVES_FETCH_ERROR"),
                    String(err.error || "Failed to load team leaves"),
                    res.status
                );
            }
            const data = await res.json();
            return Array.isArray(data) ? data : (data.data || []);
        },
        staleTime: 60 * 1000, // 1 minute — leaves change frequently
    });
}

/**
 * Attendance records for the manager's team
 *
 * The /api/attendance endpoint auto-scopes to the manager's direct reportees
 * when the caller is a manager. Returns the array directly (no envelope).
 *
 * Pass `{ date: "YYYY-MM-DD" }` for a single day, or `{ year, month }` for a
 * calendar month, or `{ startDate, endDate }` for an arbitrary range.
 */
export interface ManagerAttendanceRecord {
    id: string;
    employeeId: string;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    status: string;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    source: string | null;
    totalMinutes: number;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode?: string;
        department?: { name: string } | null;
        designation?: { name: string } | null;
    };
}

export function useManagerAttendance(filters?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    year?: number;
    month?: number;
    limit?: number;
}) {
    return useQuery<ManagerAttendanceRecord[], ApiError>({
        queryKey: queryKeys.manager.attendance(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.date) params.set("date", filters.date);
            if (filters?.startDate) params.set("startDate", filters.startDate);
            if (filters?.endDate) params.set("endDate", filters.endDate);
            if (filters?.year) params.set("year", String(filters.year));
            if (filters?.month) params.set("month", String(filters.month));
            if (filters?.limit) params.set("limit", String(filters.limit));
            const url = `/api/attendance${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "MANAGER_ATTENDANCE_FETCH_ERROR"),
                    String(err.error || "Failed to load team attendance"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 60 * 1000, // 1 minute — attendance updates throughout the day
    });
}

/**
 * Performance reviews for the manager's team
 *
 * The /api/performance/reviews endpoint auto-scopes to the manager's direct
 * reportees (plus their own self-reviews) when the caller is a manager.
 */
export interface ManagerReviewRecord {
    id: string;
    status: string;
    selfRating: number | null;
    selfComments: string | null;
    managerRating: number | null;
    managerComments: string | null;
    overallRating: number | null;
    strengths: string | null;
    improvements: string | null;
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
        photoUrl?: string | null;
        designation?: { name: string } | null;
        department?: { name: string } | null;
    };
    reviewer?: { id: string; firstName: string; lastName: string } | null;
    reviewCycle: { id: string; name: string; type: string; status?: string };
}

export function useManagerReviews() {
    return useQuery<ManagerReviewRecord[], ApiError>({
        queryKey: queryKeys.manager.reviews(),
        queryFn: async () => {
            const res = await fetch("/api/performance/reviews", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "MANAGER_REVIEWS_FETCH_ERROR"),
                    String(err.error || "Failed to load team reviews"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 60 * 1000, // 1 minute — review status changes occasionally
    });
}

// ============================================
// Settings Subpage Hooks
// ============================================
//
// These hooks power the /settings/* admin pages. Settings change rarely so
// staleTime is set to 2-5 minutes — much higher than the dashboard/ESS hooks.

// ── a) General organization settings ────────────────────────────────────────
// /api/settings returns { organization: { ...org, currency, dateFormat, workWeekStart, documents } }
export interface SettingsDocuments {
    orgAddress?: string;
    letterheadTitle?: string;
    legalName?: string;
    tradeLicenseNo?: string;
    taxId?: string;
    officePhone?: string;
    officeEmail?: string;
    website?: string;
    signatoryName?: string;
    signatoryDesignation?: string;
    signatureImageUrl?: string;
    companySealUrl?: string;
    footerNote?: string;
    [key: string]: unknown;
}

export interface OrgSettingsResponse {
    organization: {
        id: string;
        name: string;
        logoUrl: string | null;
        industry: string | null;
        employeeCountRange?: string | null;
        fiscalYearStart: number;
        currencyCode: string;
        currency: string;
        timezone: string;
        settings?: unknown;
        dateFormat: string;
        workWeekStart: number;
        documents: SettingsDocuments;
        binNumber?: string | null;
        tinNumber?: string | null;
        vatNumber?: string | null;
        tradeLicenseNumber?: string | null;
        tradeLicenseExpiry?: string | null;
        binExpiry?: string | null;
        [key: string]: unknown;
    };
}

export function useSettings() {
    return useQuery<OrgSettingsResponse, ApiError>({
        queryKey: queryKeys.settings.org(),
        queryFn: async () => {
            const res = await fetch("/api/settings", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "SETTINGS_FETCH_ERROR"),
                    String(err.error || "Failed to load organization settings"),
                    res.status
                );
            }
            const json = await res.json();
            return json as OrgSettingsResponse;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — settings change rarely
    });
}

// ── b) Custom fields builder ────────────────────────────────────────────────
// /api/settings/custom-fields returns { data: [...], total: N }.
export interface CustomFieldRecord {
    id: string;
    label: string;
    key: string;
    entityType: string;
    fieldType: string;
    options: string[];
    isRequired: boolean;
    isFilterable: boolean;
    isSearchable: boolean;
    defaultValue: string | null;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    organizationId?: string;
    [key: string]: unknown;
}

export function useCustomFields(filters?: {
    entityType?: string;
    active?: boolean;
}) {
    return useQuery<CustomFieldRecord[], ApiError>({
        queryKey: queryKeys.settings.customFields(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.entityType) params.set("entityType", filters.entityType);
            if (filters?.active === true) params.set("active", "true");
            if (filters?.active === false) params.set("active", "false");
            const url = `/api/settings/custom-fields${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "CUSTOM_FIELDS_FETCH_ERROR"),
                    String(err.error || "Failed to load custom fields"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — field definitions change rarely
    });
}

// ── c) RBAC roles (system + custom) ─────────────────────────────────────────
// /api/rbac/roles returns { data: [...], total: N }.
export interface RbacPermissionSummary {
    id: string;
    key: string;
    module: string;
    action: string;
    description: string | null;
    isDangerous: boolean;
}

export interface RbacRolePermission {
    id: string;
    permissionId: string;
    scope: string;
    permission: RbacPermissionSummary;
}

export interface RbacRoleRecord {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isSystem: boolean;
    isDefault: boolean;
    color: string | null;
    sortOrder: number;
    rolePermissions: RbacRolePermission[];
    _count: { userAssignments: number };
    [key: string]: unknown;
}

export function useRoles() {
    return useQuery<RbacRoleRecord[], ApiError>({
        queryKey: queryKeys.rbac.roles(),
        queryFn: async () => {
            const res = await fetch("/api/rbac/roles", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ROLES_FETCH_ERROR"),
                    String(err.error || "Failed to load roles"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — roles change rarely
    });
}

// ── d) RBAC permission catalog ──────────────────────────────────────────────
// /api/rbac/permissions returns { data: [...], byModule: {...}, total: N }.
export interface RbacPermissionCatalogResponse {
    data: RbacPermissionSummary[];
    byModule: Record<string, RbacPermissionSummary[]>;
    total: number;
}

export function usePermissions() {
    return useQuery<RbacPermissionCatalogResponse, ApiError>({
        queryKey: queryKeys.rbac.permissions(),
        queryFn: async () => {
            const res = await fetch("/api/rbac/permissions", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "PERMISSIONS_FETCH_ERROR"),
                    String(err.error || "Failed to load permission catalog"),
                    res.status
                );
            }
            const json = await res.json();
            // Defensive — fall back to an empty catalog if shape is unexpected
            if (json && typeof json === "object" && "data" in json) {
                return json as RbacPermissionCatalogResponse;
            }
            return {
                data: Array.isArray(json) ? json : [],
                byModule: {},
                total: Array.isArray(json) ? json.length : 0,
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes — the catalog is system-defined and never changes at runtime
    });
}

// ── e) RBAC delegations ─────────────────────────────────────────────────────
// /api/rbac/delegations returns { data: { delegated: [...], received: [...] } }.
export interface RbacDelegationRecord {
    id: string;
    userId: string;
    organizationId: string;
    permission: string;
    scope: string;
    departmentIds: string[] | null;
    validFrom: string;
    validUntil: string | null;
    isActive: boolean;
    createdAt: string;
    user?: { name: string | null; email: string };
    [key: string]: unknown;
}

export interface RbacDelegationsResponse {
    delegated: RbacDelegationRecord[];
    received: RbacDelegationRecord[];
}

export function useDelegations() {
    return useQuery<RbacDelegationsResponse, ApiError>({
        queryKey: queryKeys.rbac.delegations(),
        queryFn: async () => {
            const res = await fetch("/api/rbac/delegations", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "DELEGATIONS_FETCH_ERROR"),
                    String(err.error || "Failed to load delegations"),
                    res.status
                );
            }
            const json = await res.json();
            // The endpoint wraps the result as { data: { delegated, received } }.
            const payload = (json?.data ?? json) as Partial<RbacDelegationsResponse> | undefined;
            return {
                delegated: payload?.delegated || [],
                received: payload?.received || [],
            };
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — delegations are time-bounded and change rarely
    });
}

// ── f) Exchange rates ───────────────────────────────────────────────────────
// /api/settings/exchange-rates returns { data: [...], total, ratesCount }.
export interface ExchangeRateEntry {
    code: string;
    name: string;
    symbol: string;
    rate: number | null;
    fetchedAt: string | null;
    source: string | null;
    isStale: boolean;
    [key: string]: unknown;
}

export function useExchangeRates() {
    return useQuery<ExchangeRateEntry[], ApiError>({
        queryKey: queryKeys.settings.exchangeRates(),
        queryFn: async () => {
            const res = await fetch("/api/settings/exchange-rates", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "EXCHANGE_RATES_FETCH_ERROR"),
                    String(err.error || "Failed to load exchange rates"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 5 * 60 * 1000, // 5 minutes — rates are auto-refreshed by a cron job
    });
}

// ── g) Late deduction policy ────────────────────────────────────────────────
// /api/policies/late-deduction returns { data: [...] } with nested tiers.
export interface LateDeductionTierRecord {
    id: string;
    tierOrder: number;
    name: string;
    fromCount: number;
    toCount: number;
    deductionType: string;
    deductionValue: number;
    issueWarning: boolean;
    warningLevel: string;
}

export interface LateDeductionPolicyRecord {
    id: string;
    name: string;
    lateThresholdMinutes: number;
    isActive: boolean;
    createdAt: string;
    tiers: LateDeductionTierRecord[];
    [key: string]: unknown;
}

export function useLateDeductionPolicy() {
    return useQuery<LateDeductionPolicyRecord[], ApiError>({
        queryKey: queryKeys.policies.lateDeduction(),
        queryFn: async () => {
            const res = await fetch("/api/policies/late-deduction", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "LATE_DEDUCTION_FETCH_ERROR"),
                    String(err.error || "Failed to load late deduction policy"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — policies change rarely
    });
}

// ── h) Notification preferences (current user) ──────────────────────────────
// /api/notifications/preferences returns the preference object directly (no envelope).
export interface NotificationPreferenceRecord {
    id: string;
    userId: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    pushEnabled: boolean;
    digestMode: string;
    quietHoursStart: string | null;
    quietHoursEnd: string | null;
    categoryOverrides: Record<string, { inApp?: boolean; email?: boolean; push?: boolean }> | null;
    [key: string]: unknown;
}

export function useNotificationPreferences() {
    return useQuery<NotificationPreferenceRecord, ApiError>({
        queryKey: queryKeys.settings.notificationPreferences(),
        queryFn: async () => {
            const res = await fetch("/api/notifications/preferences", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "NOTIFICATION_PREFS_FETCH_ERROR"),
                    String(err.error || "Failed to load notification preferences"),
                    res.status
                );
            }
            const json = await res.json();
            return json as NotificationPreferenceRecord;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — preferences change rarely
    });
}

// ── i) Access users ─────────────────────────────────────────────────────────
// /api/access/users returns { data: [...], summary: {...} }.
export interface AccessUserEmployee {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    employmentStatus: string;
    branch: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
    designation: { id: string; name: string } | null;
    reportingManager: { id: string; firstName: string; lastName: string; employeeCode: string } | null;
    _count: { reportees: number };
}

export interface AccessUserRecord {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isActive: boolean;
    emailVerified: string | null;
    lastLogin: string | null;
    createdAt: string;
    twoFactorEnabled: boolean;
    employee: AccessUserEmployee | null;
}

export interface AccessUsersSummary {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    hrAdmins: number;
    managers: number;
    employees: number;
    unlinked: number;
    managersWithoutReportees: number;
    setupPending: number;
}

export interface AccessUsersResponse {
    data: AccessUserRecord[];
    summary: AccessUsersSummary;
}

export function useAccessUsers() {
    return useQuery<AccessUsersResponse, ApiError>({
        queryKey: queryKeys.access.users(),
        queryFn: async () => {
            const res = await fetch("/api/access/users", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ACCESS_USERS_FETCH_ERROR"),
                    String(err.error || "Failed to load access users"),
                    res.status
                );
            }
            const json = await res.json();
            // Endpoint returns { data, summary } — fall back to a safe empty
            // summary so consuming components never have to defend against null.
            const emptySummary: AccessUsersSummary = {
                total: 0,
                active: 0,
                inactive: 0,
                admins: 0,
                hrAdmins: 0,
                managers: 0,
                employees: 0,
                unlinked: 0,
                managersWithoutReportees: 0,
                setupPending: 0,
            };
            return {
                data: Array.isArray(json) ? json : (json.data || []),
                summary: (json?.summary ?? emptySummary) as AccessUsersSummary,
            };
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — access changes rarely
    });
}

// ============================================
// Recruitment Hooks
// ============================================

// ── a) Recruitment — job postings list ─────────────────────────────────────
// /api/recruitment/jobs returns { data: [...] } via successResponse wrapper;
// defensive handling for both wrapped and raw-array shapes.
export interface JobPostingRecord {
    id: string;
    title: string;
    description: string;
    employmentType: string;
    experience?: string | null;
    location?: string | null;
    isRemote: boolean;
    status: string;
    openings: number;
    salaryMin?: number | null;
    salaryMax?: number | null;
    showSalary: boolean;
    postedAt?: string | null;
    closesAt?: string | null;
    createdAt: string;
    department?: { id: string; name: string } | null;
    designation?: { id: string; name: string } | null;
    _count: { applications: number };
    [key: string]: unknown;
}

export function useJobPostings(filters?: {
    status?: string;
    departmentId?: string;
}) {
    return useQuery<JobPostingRecord[], ApiError>({
        queryKey: queryKeys.recruitment.jobs.list(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.status) params.set("status", filters.status);
            if (filters?.departmentId) params.set("departmentId", filters.departmentId);

            const url = `/api/recruitment/jobs${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "JOBS_FETCH_ERROR"),
                    String(err.error || "Failed to load job postings"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — job postings change rarely
    });
}

// ── b) Recruitment — single job posting ───────────────────────────────────
// /api/recruitment/jobs/[id] returns the raw job object (NextResponse.json(job)).
export interface JobPostingApplicationSummary {
    id: string;
    stage: string;
    status: string;
    appliedAt: string;
    candidate: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface JobPostingDetailRecord extends JobPostingRecord {
    applications: JobPostingApplicationSummary[];
    [key: string]: unknown;
}

export function useJobPosting(id: string) {
    return useQuery<JobPostingDetailRecord, ApiError>({
        queryKey: queryKeys.recruitment.jobs.detail(id),
        queryFn: async () => {
            const res = await fetch(`/api/recruitment/jobs/${id}`, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "JOB_FETCH_ERROR"),
                    String(err.error || "Failed to load job posting"),
                    res.status
                );
            }
            return res.json();
        },
        enabled: !!id,
        staleTime: 2 * 60 * 1000, // 2 minutes
    });
}

// ── c) Recruitment — candidates list ──────────────────────────────────────
// /api/recruitment/candidates returns { data: candidates, total: N }.
export interface CandidateApplicationSummary {
    id: string;
    stage: string;
    status: string;
    jobPosting: {
        id: string;
        title: string;
        department: { name: string } | null;
    };
    [key: string]: unknown;
}

export interface CandidateRecord {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    resumeUrl: string | null;
    portfolioUrl: string | null;
    linkedinUrl: string | null;
    currentCompany: string | null;
    currentTitle: string | null;
    yearsOfExp: number | null;
    expectedSalary: number | null;
    noticePeriod: string | null;
    skills: string | null;
    education: string | null;
    source: string | null;
    notes: string | null;
    applications: CandidateApplicationSummary[];
    [key: string]: unknown;
}

export function useCandidates(filters?: {
    search?: string;
    source?: string;
    limit?: number;
}) {
    return useQuery<CandidateRecord[], ApiError>({
        queryKey: queryKeys.recruitment.candidates.list(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.search) params.set("search", filters.search);
            if (filters?.source) params.set("source", filters.source);
            if (filters?.limit) params.set("limit", String(filters.limit));

            const url = `/api/recruitment/candidates${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "CANDIDATES_FETCH_ERROR"),
                    String(err.error || "Failed to load candidates"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 60 * 1000, // 1 minute — candidate pool changes frequently
    });
}

// ── d) Recruitment — applications (pipeline view) ─────────────────────────
// /api/recruitment/applications returns { data, byStage, total }.
export interface ApplicationCandidate {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    resumeUrl: string | null;
    yearsOfExp: number | null;
    currentTitle: string | null;
    currentCompany: string | null;
    [key: string]: unknown;
}

export interface ApplicationJobPosting {
    id: string;
    title: string;
    department: { name: string } | null;
    designation: { name: string } | null;
    [key: string]: unknown;
}

export interface ApplicationRecord {
    id: string;
    stage: string;
    status: string;
    rating: number | null;
    interviewDate: string | null;
    offerSalary: number | null;
    candidate: ApplicationCandidate;
    jobPosting: ApplicationJobPosting;
    [key: string]: unknown;
}

export interface ApplicationsResponse {
    data: ApplicationRecord[];
    byStage: Record<string, ApplicationRecord[]>;
    total: number;
}

export function useApplications(filters?: {
    jobPostingId?: string;
    stage?: string;
    status?: string;
}) {
    return useQuery<ApplicationsResponse, ApiError>({
        queryKey: queryKeys.recruitment.applications.list(filters || {}),
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.jobPostingId) params.set("jobPostingId", filters.jobPostingId);
            if (filters?.stage) params.set("stage", filters.stage);
            if (filters?.status) params.set("status", filters.status);

            const url = `/api/recruitment/applications${params.toString() ? `?${params.toString()}` : ""}`;
            const res = await fetch(url, { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "APPLICATIONS_FETCH_ERROR"),
                    String(err.error || "Failed to load applications"),
                    res.status
                );
            }
            const json = await res.json();
            const data: ApplicationRecord[] = Array.isArray(json) ? json : (json.data || []);
            return {
                data,
                byStage: (json?.byStage ?? {}) as Record<string, ApplicationRecord[]>,
                total: typeof json?.total === "number" ? json.total : data.length,
            };
        },
        staleTime: 60 * 1000, // 1 minute — pipeline moves often
    });
}

// ============================================
// Reports Hooks
// ============================================

// ── e) Reports — saved custom reports ─────────────────────────────────────
// /api/reports/custom returns { data: [...], total: N } (plus optional meta
// when includeMeta=true — consumers needing meta should call the API directly).
export interface SavedReportRecord {
    id: string;
    name: string;
    description: string | null;
    dataSource: string;
    fields: string[];
    filters: Record<string, unknown>;
    groupBy: string | null;
    chartType: string | null;
    isShared: boolean;
    createdBy: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
    _count?: { schedules: number };
    [key: string]: unknown;
}

export function useSavedReports() {
    return useQuery<SavedReportRecord[], ApiError>({
        queryKey: queryKeys.reports.saved(),
        queryFn: async () => {
            const res = await fetch("/api/reports/custom", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "SAVED_REPORTS_FETCH_ERROR"),
                    String(err.error || "Failed to load saved reports"),
                    res.status
                );
            }
            const json = await res.json();
            return Array.isArray(json) ? json : (json.data || []);
        },
        staleTime: 5 * 60 * 1000, // 5 minutes — reports change rarely
    });
}

// ── f) Reports — statutory (BLA 2006 forms) ───────────────────────────────
// /api/reports/statutory?form=A&month=7&year=2026 returns the RegisterResult
// directly (NextResponse.json(result)). The form parameter is required by the
// API; the hook only fires the query when `form` is non-null and `enabled`
// is true (used to gate the query until the user opens the dialog).
export function useStatutoryReports(
    form: FormCode | null,
    month: number,
    year: number,
    enabled: boolean = true,
) {
    return useQuery<RegisterResult, ApiError>({
        queryKey: queryKeys.reports.statutory(form, month, year),
        queryFn: async () => {
            const params = new URLSearchParams({ form: form as string });
            params.set("month", String(month));
            params.set("year", String(year));

            const res = await fetch(`/api/reports/statutory?${params.toString()}`, {
                credentials: "include",
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "STATUTORY_REPORT_FETCH_ERROR"),
                    String(err.error || "Failed to load statutory register"),
                    res.status
                );
            }
            return res.json();
        },
        enabled: enabled && form !== null,
        staleTime: 5 * 60 * 1000, // 5 minutes — registers don't change within a session
    });
}

// ── g) Reports — attendance overview ──────────────────────────────────────
// /api/reports/attendance returns { daily, monthly, offenders } directly.
export interface AttendanceReportTrend {
    date: string;
    present: number;
    late: number;
    absent: number;
    half_day: number;
    [key: string]: number | string;
}

export interface AttendanceReportOffender {
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        employeeCode: string;
        photoUrl: string | null;
        department: { name: string } | null;
        [key: string]: unknown;
    };
    lateCount: number;
    earlyLeaveCount: number;
    totalLateMinutes: number;
    [key: string]: unknown;
}

export interface AttendanceReportResponse {
    daily: Record<string, number>;
    monthly: AttendanceReportTrend[];
    offenders: AttendanceReportOffender[];
}

export function useAttendanceReport(filters?: Record<string, unknown>) {
    return useQuery<AttendanceReportResponse, ApiError>({
        queryKey: queryKeys.reports.attendance(filters || {}),
        queryFn: async () => {
            const res = await fetch("/api/reports/attendance", { credentials: "include" });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new ApiError(
                    String(err.code || "ATTENDANCE_REPORT_FETCH_ERROR"),
                    String(err.error || "Failed to load attendance report"),
                    res.status
                );
            }
            const json = await res.json();
            return {
                daily: (json?.daily ?? {}) as Record<string, number>,
                monthly: Array.isArray(json?.monthly) ? json.monthly : [],
                offenders: Array.isArray(json?.offenders) ? json.offenders : [],
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes — reports change rarely
    });
}
