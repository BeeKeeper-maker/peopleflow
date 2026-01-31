import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Format currency in BDT
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("bn-BD", {
        style: "currency",
        currency: "BDT",
        minimumFractionDigits: 0,
    }).format(amount);
}

/**
 * Format date in Bengali locale
 */
export function formatDate(date: Date | string, format: "short" | "long" | "full" = "short"): string {
    const d = typeof date === "string" ? new Date(date) : date;

    const optionsMap: Record<"short" | "long" | "full", Intl.DateTimeFormatOptions> = {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
        full: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
    };

    return d.toLocaleDateString("en-BD", optionsMap[format]);
}

/**
 * Format time
 */
export function formatTime(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleTimeString("en-BD", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

/**
 * Calculate working days between two dates
 */
export function getWorkingDays(startDate: Date, endDate: Date, holidays: Date[] = []): number {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday, Saturday in BD
        const isHoliday = holidays.some(
            (h) => h.toDateString() === current.toDateString()
        );

        if (!isWeekend && !isHoliday) {
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

/**
 * Generate employee code
 */
export function generateEmployeeCode(prefix: string, sequence: number): string {
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${sequence.toString().padStart(4, "0")}`;
}

/**
 * Calculate Bangladesh income tax
 */
export function calculateBangladeshTax(
    annualIncome: number,
    category: "male" | "female" | "senior" = "male"
): number {
    const slabs = {
        male: [
            { threshold: 375000, rate: 0 },
            { threshold: 475000, rate: 0.05 },
            { threshold: 775000, rate: 0.10 },
            { threshold: 1175000, rate: 0.15 },
            { threshold: 1675000, rate: 0.20 },
            { threshold: Infinity, rate: 0.25 },
        ],
        female: [
            { threshold: 425000, rate: 0 },
            { threshold: 525000, rate: 0.05 },
            { threshold: 825000, rate: 0.10 },
            { threshold: 1225000, rate: 0.15 },
            { threshold: 1725000, rate: 0.20 },
            { threshold: Infinity, rate: 0.25 },
        ],
        senior: [
            { threshold: 425000, rate: 0 },
            { threshold: 525000, rate: 0.05 },
            { threshold: 825000, rate: 0.10 },
            { threshold: 1225000, rate: 0.15 },
            { threshold: 1725000, rate: 0.20 },
            { threshold: Infinity, rate: 0.25 },
        ],
    };

    let tax = 0;
    let remaining = annualIncome;
    let previousThreshold = 0;

    for (const slab of slabs[category]) {
        const taxableInSlab = Math.min(remaining, slab.threshold - previousThreshold);
        if (taxableInSlab <= 0) break;
        tax += taxableInSlab * slab.rate;
        remaining -= taxableInSlab;
        previousThreshold = slab.threshold;
    }

    return Math.round(tax);
}

/**
 * Calculate gratuity (after 5 years of service)
 */
export function calculateGratuity(basicSalary: number, yearsOfService: number): number {
    if (yearsOfService < 5) return 0;
    return basicSalary * yearsOfService;
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, length: number): string {
    if (text.length <= length) return text;
    return text.slice(0, length) + "...";
}

/**
 * Slugify text
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/--+/g, "-")
        .trim();
}

/**
 * Parse JSON safely
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}
