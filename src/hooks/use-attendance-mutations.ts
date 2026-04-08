"use client";

/**
 * Attendance Mutations — Optimistic Clock-In/Out
 *
 * Clock-in → instant status flip + timer start
 * Clock-out → instant total hours calculation
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiResponse, ApiError } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { queryKeys } from "@/hooks/use-data";

interface AttendanceRecord {
    id: string;
    checkIn: string;
    checkOut?: string;
    status: string;
    totalHours?: number;
}

export function useClockIn() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<AttendanceRecord>, ApiError, { latitude?: number; longitude?: number }, { previousData: unknown }>({
        mutationFn: (data) => api.post<AttendanceRecord>("/api/attendance/check-in", data),

        onMutate: async () => {
            const queryKey = queryKeys.attendance.all;
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);

            // Optimistically set "checked in" status
            queryClient.setQueriesData({ queryKey }, (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    todayStatus: "checked_in",
                    checkIn: new Date().toISOString(),
                    _optimistic: true,
                };
            });

            return { previousData };
        },

        onError: (error, _vars, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(queryKeys.attendance.all, context.previousData);
            }
            addToast({ title: error.message || "Clock-in failed", type: "error" });
        },

        onSuccess: () => addToast({ title: "Clocked in successfully ✅", type: "success" }),

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
        },
    });
}

export function useClockOut() {
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    return useMutation<ApiResponse<AttendanceRecord>, ApiError, { latitude?: number; longitude?: number }, { previousData: unknown }>({
        mutationFn: (data) => api.post<AttendanceRecord>("/api/attendance/check-out", data),

        onMutate: async () => {
            const queryKey = queryKeys.attendance.all;
            await queryClient.cancelQueries({ queryKey });
            const previousData = queryClient.getQueryData(queryKey);

            queryClient.setQueriesData({ queryKey }, (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    todayStatus: "checked_out",
                    checkOut: new Date().toISOString(),
                    _optimistic: true,
                };
            });

            return { previousData };
        },

        onError: (error, _vars, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(queryKeys.attendance.all, context.previousData);
            }
            addToast({ title: error.message || "Clock-out failed", type: "error" });
        },

        onSuccess: () => addToast({ title: "Clocked out. Good work today! 👋", type: "success" }),

        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.attendance.all });
        },
    });
}
