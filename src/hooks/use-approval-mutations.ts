"use client";

/**
 * Approval Mutations — Optimistic Approve/Reject
 *
 * Instant status flip on the approval list + notification badge decrement
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiResponse, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { queryKeys } from "@/hooks/use-data";

const approvalKeys = {
    all: ["approvals"] as const,
    pending: () => [...approvalKeys.all, "pending"] as const,
};

export function useApproveRequest() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<any>, ApiError, { id: string; entityType: string }, { previousData: unknown }>({
        mutationFn: ({ id, entityType }) =>
            api.put(`/api/approval-workflows/${id}`, { action: "approve", entityType }),

        onMutate: async ({ id }) => {
            const queryKey = approvalKeys.pending();
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);

            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: old.data.map((item: any) =>
                        item.id === id ? { ...item, status: "approved", _optimistic: true } : item
                    ),
                };
            });

            return { previousData };
        },

        onError: (error, _vars, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(approvalKeys.pending(), context.previousData);
            }
            addToast({ title: error.message || "Approval failed", type: "error" });
        },

        onSuccess: () => addToast({ title: "Request approved ✅", type: "success" }),

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: approvalKeys.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.leaves.all });
        },
    });
}

export function useRejectRequest() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<any>, ApiError, { id: string; entityType: string; reason?: string }, { previousData: unknown }>({
        mutationFn: ({ id, entityType, reason }) =>
            api.put(`/api/approval-workflows/${id}`, { action: "reject", entityType, reason }),

        onMutate: async ({ id }) => {
            const queryKey = approvalKeys.pending();
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);

            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old?.data) return old;
                return {
                    ...old,
                    data: old.data.map((item: any) =>
                        item.id === id ? { ...item, status: "rejected", _optimistic: true } : item
                    ),
                };
            });

            return { previousData };
        },

        onError: (error, _vars, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(approvalKeys.pending(), context.previousData);
            }
            addToast({ title: error.message || "Rejection failed", type: "error" });
        },

        onSuccess: () => addToast({ title: "Request rejected", type: "success" }),

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: approvalKeys.all });
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
        },
    });
}
