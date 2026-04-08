"use client";

/**
 * Leave Mutations — Optimistic TanStack Query Hooks
 *
 * Apply leave → instant list insert, rollback on 4xx
 * Approve/Reject → instant status flip + badge decrement
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiResponse, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { queryKeys } from "@/hooks/use-data";

interface LeaveApplication {
    id: string;
    employeeName: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    totalDays: number;
    reason: string;
    status: string;
}

interface ApplyLeaveInput {
    leaveTypeId: string;
    leaveTypeName?: string;
    fromDate: string;
    toDate: string;
    totalDays: number;
    reason: string;
}

export function useApplyLeave() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<LeaveApplication>, ApiError, ApplyLeaveInput, { previousData: unknown }>({
        mutationFn: (data) => api.post<LeaveApplication>("/api/leaves/applications", data),

        onMutate: async (variables) => {
            const queryKey = queryKeys.leaves.applications();
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);

            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old) return old;
                const optimistic = {
                    id: `temp-${Date.now()}`,
                    leaveType: variables.leaveTypeName || "Leave",
                    fromDate: variables.fromDate,
                    toDate: variables.toDate,
                    totalDays: variables.totalDays,
                    reason: variables.reason,
                    status: "pending",
                    _optimistic: true,
                    createdAt: new Date().toISOString(),
                };
                if (old?.data && Array.isArray(old.data)) {
                    return { ...old, data: [optimistic, ...old.data] };
                }
                return old;
            });

            return { previousData };
        },

        onError: (error, _vars, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(queryKeys.leaves.applications(), context.previousData);
            }
            addToast({ title: error.message || "Failed to apply leave", type: "error" });
        },

        onSuccess: () => {
            addToast({ title: "Leave application submitted", type: "success" });
        },

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
        },
    });
}

export function useApproveLeave() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<any>, ApiError, string, { previousData: unknown }>({
        mutationFn: (id) => api.put(`/api/leaves/applications/${id}`, { action: "approve" }),

        onMutate: async (id) => {
            const queryKey = queryKeys.leaves.applications();
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);

            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: old.data.map((item: any) =>
                        item.id === id ? { ...item, status: "approved" } : item
                    ),
                };
            });

            return { previousData };
        },

        onError: (error, _id, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(queryKeys.leaves.applications(), context.previousData);
            }
            addToast({ title: error.message || "Failed to approve leave", type: "error" });
        },

        onSuccess: () => addToast({ title: "Leave approved ✅", type: "success" }),

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
        },
    });
}

export function useRejectLeave() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<any>, ApiError, { id: string; reason?: string }, { previousData: unknown }>({
        mutationFn: ({ id, reason }) => api.put(`/api/leaves/applications/${id}`, { action: "reject", reason }),

        onMutate: async ({ id }) => {
            const queryKey = queryKeys.leaves.applications();
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);

            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: old.data.map((item: any) =>
                        item.id === id ? { ...item, status: "rejected" } : item
                    ),
                };
            });

            return { previousData };
        },

        onError: (error, _vars, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(queryKeys.leaves.applications(), context.previousData);
            }
            addToast({ title: error.message || "Failed to reject leave", type: "error" });
        },

        onSuccess: () => addToast({ title: "Leave rejected", type: "success" }),

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
        },
    });
}
