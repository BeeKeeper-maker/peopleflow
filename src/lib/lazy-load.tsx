"use client";

/**
 * Lazy Loading Utilities
 * 
 * Dynamic imports for code splitting heavy components
 * Features:
 * - SSR-safe lazy loading
 * - Loading fallbacks
 * - Error boundaries
 */

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================
// Loading Components
// ============================================

function ChartLoadingFallback() {
    return (
        <div className="w-full h-64 rounded-xl bg-white/5 animate-pulse flex items-center justify-center">
            <div className="text-white/40 text-sm">Loading chart...</div>
        </div>
    );
}

function TableLoadingFallback() {
    return (
        <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
            ))}
        </div>
    );
}

function PDFLoadingFallback() {
    return (
        <div className="w-full h-96 rounded-xl bg-white/5 animate-pulse flex items-center justify-center">
            <div className="text-white/40 text-sm">Generating PDF...</div>
        </div>
    );
}

function CalendarLoadingFallback() {
    return (
        <div className="w-full aspect-square max-w-md rounded-xl bg-white/5 animate-pulse flex items-center justify-center">
            <div className="text-white/40 text-sm">Loading calendar...</div>
        </div>
    );
}

// ============================================
// Lazy Loaded Components
// ============================================

/**
 * Recharts Components - Large library, lazy load
 */
export const LazyAreaChart = dynamic(
    () => import("recharts").then((mod) => ({ default: mod.AreaChart })),
    { loading: ChartLoadingFallback, ssr: false }
);

export const LazyBarChart = dynamic(
    () => import("recharts").then((mod) => ({ default: mod.BarChart })),
    { loading: ChartLoadingFallback, ssr: false }
);

export const LazyLineChart = dynamic(
    () => import("recharts").then((mod) => ({ default: mod.LineChart })),
    { loading: ChartLoadingFallback, ssr: false }
);

export const LazyPieChart = dynamic(
    () => import("recharts").then((mod) => ({ default: mod.PieChart })),
    { loading: ChartLoadingFallback, ssr: false }
);

/**
 * PDF Renderer - Very large library, always lazy load
 */
export const LazyPDFViewer = dynamic(
    () => import("@react-pdf/renderer").then((mod) => ({ default: mod.PDFViewer })),
    { loading: PDFLoadingFallback, ssr: false }
);

/**
 * Calendar Component - Moderate size
 */
export const LazyLeaveCalendar = dynamic(
    () => import("@/components/leaves/calendar/leave-calendar").then((mod) => ({ default: mod.LeaveCalendar })),
    { loading: CalendarLoadingFallback, ssr: false }
);

/**
 * Data Table - Can be large with many rows
 */
export const LazyDataTable = dynamic(
    () => import("@/components/ui/data-table").then((mod) => ({ default: mod.DataTable })),
    { loading: TableLoadingFallback, ssr: false }
);

/**
 * Report Charts
 */
export const LazyAttendanceCharts = dynamic(
    () => import("@/components/reports/attendance-charts").then((mod) => mod.AttendanceCharts),
    { loading: ChartLoadingFallback, ssr: false }
);

// ============================================
// Utility Functions
// ============================================

/**
 * Preload a component before it's needed
 * Useful for hover prefetching
 */
export function preloadComponent(importFn: () => Promise<unknown>): void {
    importFn();
}
