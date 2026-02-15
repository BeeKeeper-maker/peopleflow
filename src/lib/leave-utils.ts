/**
 * Leave Management Utilities
 * 
 * Industry-grade utility functions for leave calculations,
 * validations, and workflow automation.
 * 
 * Key features:
 * - Working days calculation (excludes weekends + holidays)
 * - Overlapping leave detection
 * - Minimum service days eligibility check
 * - Gender-based leave eligibility check
 * - In-app notification creation for leave events
 */

import { eachDayOfInterval, isWeekend, differenceInDays } from "date-fns";

// ============================================
// Types
// ============================================

interface Holiday {
    date: Date | string;
}

interface OrganizationSettings {
    weekendDays?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
}

// Default weekend for Bangladesh: Friday (5) + Saturday (6)
const DEFAULT_WEEKEND_DAYS = [5, 6];

// ============================================
// Working Days Calculation
// ============================================

/**
 * Calculate the number of working days between two dates (inclusive),
 * excluding weekends and public holidays.
 * 
 * This is the INDUSTRY-STANDARD approach:
 * 1. Enumerate every day in the range
 * 2. Exclude days that fall on configured weekend days
 * 3. Exclude days that match any holiday in the active holiday list
 * 
 * @param startDate - Leave start date
 * @param endDate - Leave end date
 * @param holidays - Array of holiday objects with date field
 * @param weekendDays - Array of day-of-week numbers (0=Sun to 6=Sat)
 * @returns Number of working days
 */
export function calculateWorkingDays(
    startDate: Date,
    endDate: Date,
    holidays: Holiday[] = [],
    weekendDays: number[] = DEFAULT_WEEKEND_DAYS
): number {
    // Normalize dates to midnight to avoid timezone edge cases
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    if (end < start) return 0;

    // Get all days in the range inclusive
    const allDays = eachDayOfInterval({ start, end });

    // Build a Set of holiday date strings for O(1) lookup
    const holidaySet = new Set(
        holidays.map((h) => {
            const d = new Date(h.date);
            d.setHours(0, 0, 0, 0);
            return d.toISOString().split("T")[0];
        })
    );

    // Count only working days
    let workingDays = 0;
    for (const day of allDays) {
        const dayOfWeek = day.getDay(); // 0=Sun, 6=Sat
        const dateStr = day.toISOString().split("T")[0];

        // Skip if it's a weekend day
        if (weekendDays.includes(dayOfWeek)) continue;

        // Skip if it's a holiday
        if (holidaySet.has(dateStr)) continue;

        workingDays++;
    }

    return workingDays;
}

// ============================================
// Overlapping Leave Check
// ============================================

/**
 * Check for overlapping leave applications for an employee.
 * 
 * Two date ranges overlap when: rangeA.start <= rangeB.end AND rangeA.end >= rangeB.start
 * 
 * Only considers pending and approved leaves (not rejected/cancelled).
 * 
 * @param prisma - Prisma client instance
 * @param employeeId - The employee to check
 * @param startDate - Proposed leave start date
 * @param endDate - Proposed leave end date
 * @param excludeApplicationId - Optional, exclude a specific application (for edits)
 * @returns Array of conflicting leave applications (empty if no conflicts)
 */
export async function checkOverlappingLeaves(
    prisma: any,
    employeeId: string,
    startDate: Date,
    endDate: Date,
    excludeApplicationId?: string
): Promise<any[]> {
    const where: any = {
        employeeId,
        status: { in: ["pending", "approved"] },
        // Overlap condition: existing.fromDate <= newEnd AND existing.toDate >= newStart
        fromDate: { lte: endDate },
        toDate: { gte: startDate },
    };

    // Exclude specific application (useful when editing existing leave)
    if (excludeApplicationId) {
        where.id = { not: excludeApplicationId };
    }

    const overlapping = await prisma.leaveApplication.findMany({
        where,
        include: {
            leaveType: { select: { name: true, code: true } },
        },
        orderBy: { fromDate: "asc" },
    });

    return overlapping;
}

// ============================================
// Minimum Service Days Check
// ============================================

/**
 * Check if an employee has fulfilled the minimum service days requirement
 * for a specific leave type.
 * 
 * @param joiningDate - Employee's date of joining
 * @param minServiceDays - Minimum service days required (from LeaveType)
 * @returns Object with eligible boolean and details
 */
export function checkMinServiceEligibility(
    joiningDate: Date,
    minServiceDays: number | null | undefined
): { eligible: boolean; serviceDays: number; required: number } {
    // If no minimum is set, everyone is eligible
    if (!minServiceDays || minServiceDays <= 0) {
        return { eligible: true, serviceDays: 0, required: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const joining = new Date(joiningDate);
    joining.setHours(0, 0, 0, 0);

    const serviceDays = differenceInDays(today, joining);

    return {
        eligible: serviceDays >= minServiceDays,
        serviceDays,
        required: minServiceDays,
    };
}

// ============================================
// Gender Eligibility Check
// ============================================

/**
 * Check if an employee's gender matches the leave type's gender requirement.
 * 
 * @param employeeGender - Employee's gender (male, female, other)
 * @param applicableGender - Leave type's applicable gender (male, female, all, null)
 * @returns true if eligible, false if not
 */
export function checkGenderEligibility(
    employeeGender: string | null | undefined,
    applicableGender: string | null | undefined
): boolean {
    // If no gender restriction, all employees are eligible
    if (!applicableGender || applicableGender === "all") {
        return true;
    }

    // If employee gender is not set, deny access to gender-specific leaves
    if (!employeeGender) {
        return false;
    }

    return employeeGender.toLowerCase() === applicableGender.toLowerCase();
}

// ============================================
// Notification Helper
// ============================================

type LeaveNotificationType =
    | "leave_applied"
    | "leave_approved"
    | "leave_rejected"
    | "leave_cancelled";

interface LeaveNotificationData {
    applicantName: string;
    leaveTypeName: string;
    fromDate: string;
    toDate: string;
    totalDays: number;
    reason?: string;
    rejectionReason?: string;
}

/**
 * Create an in-app notification for leave workflow events.
 * 
 * @param prisma - Prisma client instance
 * @param type - Notification event type
 * @param recipientUserId - User ID of the notification recipient
 * @param data - Leave application data for the notification message
 * @param applicationId - Leave application ID (for the link)
 */
export async function createLeaveNotification(
    prisma: any,
    type: LeaveNotificationType,
    recipientUserId: string,
    data: LeaveNotificationData,
    applicationId: string
): Promise<void> {
    const { applicantName, leaveTypeName, fromDate, toDate, totalDays, rejectionReason } = data;

    let title = "";
    let message = "";

    switch (type) {
        case "leave_applied":
            title = "New Leave Request";
            message = `${applicantName} has applied for ${leaveTypeName} (${totalDays} day${totalDays !== 1 ? "s" : ""}) from ${fromDate} to ${toDate}. Please review.`;
            break;

        case "leave_approved":
            title = "Leave Approved ✅";
            message = `Your ${leaveTypeName} request (${fromDate} to ${toDate}, ${totalDays} day${totalDays !== 1 ? "s" : ""}) has been approved.`;
            break;

        case "leave_rejected":
            title = "Leave Rejected ❌";
            message = `Your ${leaveTypeName} request (${fromDate} to ${toDate}) has been rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`;
            break;

        case "leave_cancelled":
            title = "Leave Cancelled";
            message = `${applicantName} has cancelled their ${leaveTypeName} leave (${fromDate} to ${toDate}).`;
            break;
    }

    try {
        await prisma.notification.create({
            data: {
                userId: recipientUserId,
                title,
                message,
                type: "leave_approval",
                link: `/leaves`,
            },
        });
    } catch (error) {
        // Don't fail the main operation if notification fails
        console.error("LEAVE_NOTIFICATION_ERROR:", error);
    }
}

// ============================================
// Organization Weekend Config Helper
// ============================================

/**
 * Parse weekend days from the organization's settings JSON.
 * Falls back to BD defaults (Fri + Sat) if not configured.
 * 
 * @param settingsJson - Organization settings JSON string
 * @returns Array of weekend day numbers (0-6)
 */
export function getWeekendDays(settingsJson: string | null | undefined): number[] {
    if (!settingsJson) return DEFAULT_WEEKEND_DAYS;

    try {
        const settings: OrganizationSettings = JSON.parse(settingsJson);
        if (Array.isArray(settings.weekendDays) && settings.weekendDays.length > 0) {
            // Validate all values are 0-6
            const valid = settings.weekendDays.every((d) => d >= 0 && d <= 6);
            if (valid) return settings.weekendDays;
        }
    } catch {
        // Invalid JSON, use defaults
    }

    return DEFAULT_WEEKEND_DAYS;
}

// ============================================
// Fetch Holidays Helper
// ============================================

/**
 * Fetch all holidays for an organization for a specific year.
 * 
 * @param prisma - Prisma client instance
 * @param organizationId - Organization ID
 * @param year - Year to fetch holidays for
 * @returns Array of holiday objects
 */
export async function fetchHolidays(
    prisma: any,
    organizationId: string,
    year: number
): Promise<Holiday[]> {
    const holidayList = await prisma.holidayList.findFirst({
        where: {
            organizationId,
            year,
            isActive: true,
        },
        include: {
            holidays: { select: { date: true } },
        },
    });

    return holidayList?.holidays || [];
}
