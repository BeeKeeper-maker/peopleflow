/**
 * PeopleFlow Event Bus — Universal Notification Pipeline
 *
 * Central event dispatcher that:
 *  1. Creates in-app notifications via Prisma
 *  2. Sends email notifications via the email service
 *  3. Logs all events for audit trail
 *
 * Architecture:
 *  - Fire-and-forget: emitted events never block the caller
 *  - Fail-safe: notification failures are logged, never thrown
 *  - Extensible: add new event types by extending the EventMap
 *
 * Usage:
 *  import { emit } from "@/lib/event-bus";
 *  await emit("leave.approved", { ... });
 */

import { prisma } from "@/lib/prisma";
import { sendTemplateEmail } from "@/lib/email";

// ════════════════════════════════════════════════════════════════════════
// Event Type Definitions
// ════════════════════════════════════════════════════════════════════════

export interface EventMap {
    // ── Leave Events ──
    "leave.applied": {
        organizationId: string;
        employeeName: string;
        employeeEmail?: string;
        leaveType: string;
        fromDate: string;
        toDate: string;
        totalDays: number;
        applicationId: string;
    };
    "leave.approved": {
        userId: string;
        employeeName: string;
        employeeEmail?: string;
        leaveType: string;
        fromDate: string;
        toDate: string;
        totalDays: number;
    };
    "leave.rejected": {
        userId: string;
        employeeName: string;
        employeeEmail?: string;
        leaveType: string;
        fromDate: string;
        toDate: string;
        reason?: string;
    };

    // ── Payroll Events ──
    "payroll.processed": {
        organizationId: string;
        month: number;
        year: number;
        processedCount: number;
        employeeResults: Array<{
            employeeId: string;
            userId?: string;
            name: string;
            email?: string;
            netSalary: number;
        }>;
    };

    // ── Expense Events ──
    "expense.approved": {
        userId: string;
        employeeName: string;
        employeeEmail?: string;
        title: string;
        amount: number;
        currency?: string;
    };
    "expense.rejected": {
        userId: string;
        employeeName: string;
        employeeEmail?: string;
        title: string;
        amount: number;
        reason?: string;
    };
    "expense.reimbursed": {
        userId: string;
        employeeName: string;
        employeeEmail?: string;
        title: string;
        amount: number;
    };

    // ── Attendance Events ──
    "attendance.regularization.approved": {
        userId: string;
        employeeName: string;
        date: string;
    };
    "attendance.regularization.rejected": {
        userId: string;
        employeeName: string;
        date: string;
    };
    "attendance.auto_absent.completed": {
        organizationId: string;
        organizationName: string;
        date: string;
        markedAbsent: number;
        skipped: number;
    };

    // ── Approval Events ──
    "approval.assigned": {
        userId: string;
        approverName: string;
        entityType: string;
        entityDescription: string;
        requesterName: string;
        dueDate?: string;
    };
    "approval.escalated": {
        userId: string;
        approverName: string;
        entityType: string;
        entityDescription: string;
        originalApprover: string;
    };

    // ── Loan Events ──
    "loan.approved": {
        userId: string;
        employeeName: string;
        amount: number;
        loanType: string;
    };
    "loan.rejected": {
        userId: string;
        employeeName: string;
        amount: number;
        loanType: string;
        reason?: string;
    };

    // ── Device Events ──
    "device.offline": {
        organizationId: string;
        deviceName: string;
        serialNumber: string;
        lastSeen: string;
    };

    // ── System Events ──
    "cron.auto_absent.completed": {
        totalOrgs: number;
        totalMarked: number;
        totalSkipped: number;
        errors: string[];
    };
    "cron.leave_allocation.completed": {
        organizationId: string;
        year: number;
        employeesProcessed: number;
        allocationsCreated: number;
    };
}

export type EventName = keyof EventMap;

// ════════════════════════════════════════════════════════════════════════
// Event Handlers — Maps events → in-app notifications + emails
// ════════════════════════════════════════════════════════════════════════

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/**
 * Core emit function — fire-and-forget event dispatcher.
 * Creates in-app notifications and sends emails based on event type.
 */
export async function emit<T extends EventName>(
    event: T,
    payload: EventMap[T]
): Promise<void> {
    try {
        console.log(`[EVENT] ${event}`, JSON.stringify(payload).substring(0, 200));
        await handleEvent(event, payload);
    } catch (error) {
        // NEVER throw — notification failures must not break business logic
        console.error(`[EVENT_ERROR] ${event}:`, error);
    }
}

// ════════════════════════════════════════════════════════════════════════
// Internal Handler Dispatch
// ════════════════════════════════════════════════════════════════════════

async function handleEvent<T extends EventName>(
    event: T,
    payload: EventMap[T]
): Promise<void> {
    switch (event) {
        // ── Leave Events ──
        case "leave.approved":
            await handleLeaveApproved(payload as EventMap["leave.approved"]);
            break;
        case "leave.rejected":
            await handleLeaveRejected(payload as EventMap["leave.rejected"]);
            break;

        // ── Payroll Events ──
        case "payroll.processed":
            await handlePayrollProcessed(payload as EventMap["payroll.processed"]);
            break;

        // ── Expense Events ──
        case "expense.approved":
            await handleExpenseApproved(payload as EventMap["expense.approved"]);
            break;
        case "expense.rejected":
            await handleExpenseRejected(payload as EventMap["expense.rejected"]);
            break;
        case "expense.reimbursed":
            await handleExpenseReimbursed(payload as EventMap["expense.reimbursed"]);
            break;

        // ── Attendance Events ──
        case "attendance.regularization.approved":
            await handleRegularizationApproved(
                payload as EventMap["attendance.regularization.approved"]
            );
            break;
        case "attendance.regularization.rejected":
            await handleRegularizationRejected(
                payload as EventMap["attendance.regularization.rejected"]
            );
            break;
        case "attendance.auto_absent.completed":
            await handleAutoAbsentCompleted(
                payload as EventMap["attendance.auto_absent.completed"]
            );
            break;

        // ── Approval Events ──
        case "approval.assigned":
            await handleApprovalAssigned(payload as EventMap["approval.assigned"]);
            break;
        case "approval.escalated":
            await handleApprovalEscalated(payload as EventMap["approval.escalated"]);
            break;

        // ── Loan Events ──
        case "loan.approved":
            await handleLoanApproved(payload as EventMap["loan.approved"]);
            break;
        case "loan.rejected":
            await handleLoanRejected(payload as EventMap["loan.rejected"]);
            break;

        // ── Device Events ──
        case "device.offline":
            await handleDeviceOffline(payload as EventMap["device.offline"]);
            break;

        default:
            console.log(`[EVENT] No handler for: ${event}`);
    }
}

// ════════════════════════════════════════════════════════════════════════
// Notification Creators (in-app + email)
// ════════════════════════════════════════════════════════════════════════

// ── Leave Handlers ──

async function handleLeaveApproved(p: EventMap["leave.approved"]) {
    await createNotificationSafe(
        p.userId,
        "Leave Approved ✅",
        `Your ${p.leaveType} leave (${p.fromDate} to ${p.toDate}, ${p.totalDays} day${p.totalDays !== 1 ? "s" : ""}) has been approved.`,
        "leave_approval",
        "/leaves"
    );

    if (p.employeeEmail) {
        await sendTemplateEmail(p.employeeEmail, "leaveApproved", {
            employeeName: p.employeeName,
            leaveType: p.leaveType,
            dates: `${p.fromDate} to ${p.toDate}`,
        });
    }
}

async function handleLeaveRejected(p: EventMap["leave.rejected"]) {
    await createNotificationSafe(
        p.userId,
        "Leave Rejected ❌",
        `Your ${p.leaveType} leave (${p.fromDate} to ${p.toDate}) has been rejected.${p.reason ? ` Reason: ${p.reason}` : ""}`,
        "leave_approval",
        "/leaves"
    );

    if (p.employeeEmail) {
        await sendTemplateEmail(p.employeeEmail, "leaveRejected", {
            employeeName: p.employeeName,
            leaveType: p.leaveType,
            dates: `${p.fromDate} to ${p.toDate}`,
            reason: p.reason,
        });
    }
}

// ── Payroll Handlers ──

async function handlePayrollProcessed(p: EventMap["payroll.processed"]) {
    const monthName = MONTH_NAMES[p.month - 1] || `Month ${p.month}`;

    // Bulk create in-app notifications for all processed employees
    const userNotifications = p.employeeResults
        .filter((e) => e.userId)
        .map((e) => ({
            userId: e.userId!,
            title: "Salary Slip Generated 💰",
            message: `Your salary slip for ${monthName} ${p.year} is ready. Net salary: ৳${e.netSalary.toLocaleString()}`,
            type: "payroll",
            link: "/ess/payslips",
        }));

    if (userNotifications.length > 0) {
        await prisma.notification.createMany({
            data: userNotifications,
            skipDuplicates: true,
        });
    }

    // Send email to each employee (non-blocking)
    for (const emp of p.employeeResults) {
        if (emp.email) {
            sendTemplateEmail(emp.email, "payslipReady", {
                employeeName: emp.name,
                month: monthName,
                year: p.year,
            }).catch((err) => console.error(`[EMAIL_FAIL] payslip → ${emp.email}:`, err));
        }
    }

    // Notify HR admins about payroll completion
    const admins = await prisma.user.findMany({
        where: {
            organizationId: p.organizationId,
            role: { in: ["admin", "hr_admin", "superadmin"] },
        },
        select: { id: true },
    });

    if (admins.length > 0) {
        await prisma.notification.createMany({
            data: admins.map((a) => ({
                userId: a.id,
                title: "Payroll Processing Complete ✓",
                message: `${monthName} ${p.year} payroll processed for ${p.processedCount} employee${p.processedCount !== 1 ? "s" : ""}.`,
                type: "payroll",
                link: "/payroll",
            })),
            skipDuplicates: true,
        });
    }
}

// ── Expense Handlers ──

async function handleExpenseApproved(p: EventMap["expense.approved"]) {
    await createNotificationSafe(
        p.userId,
        "Expense Approved ✅",
        `Your expense claim "${p.title}" for ৳${p.amount.toLocaleString()} has been approved.`,
        "alert",
        "/ess/expenses"
    );

    if (p.employeeEmail) {
        await sendTemplateEmail(p.employeeEmail, "expenseApproved", {
            employeeName: p.employeeName,
            title: p.title,
            amount: `৳${p.amount.toLocaleString()}`,
        });
    }
}

async function handleExpenseRejected(p: EventMap["expense.rejected"]) {
    await createNotificationSafe(
        p.userId,
        "Expense Rejected ❌",
        `Your expense claim "${p.title}" for ৳${p.amount.toLocaleString()} has been rejected.${p.reason ? ` Reason: ${p.reason}` : ""}`,
        "alert",
        "/ess/expenses"
    );
}

async function handleExpenseReimbursed(p: EventMap["expense.reimbursed"]) {
    await createNotificationSafe(
        p.userId,
        "Expense Reimbursed 💵",
        `Your expense claim "${p.title}" for ৳${p.amount.toLocaleString()} has been reimbursed.`,
        "alert",
        "/ess/expenses"
    );
}

// ── Attendance Handlers ──

async function handleRegularizationApproved(
    p: EventMap["attendance.regularization.approved"]
) {
    await createNotificationSafe(
        p.userId,
        "Regularization Approved ✅",
        `Your attendance regularization request for ${p.date} has been approved.`,
        "attendance",
        "/ess/attendance"
    );
}

async function handleRegularizationRejected(
    p: EventMap["attendance.regularization.rejected"]
) {
    await createNotificationSafe(
        p.userId,
        "Regularization Rejected ❌",
        `Your attendance regularization request for ${p.date} has been rejected.`,
        "attendance",
        "/ess/attendance"
    );
}

async function handleAutoAbsentCompleted(
    p: EventMap["attendance.auto_absent.completed"]
) {
    if (p.markedAbsent === 0) return; // Don't spam if nobody was absent

    // Notify HR admins
    const admins = await prisma.user.findMany({
        where: {
            organizationId: p.organizationId,
            role: { in: ["admin", "hr_admin", "superadmin"] },
        },
        select: { id: true },
    });

    if (admins.length > 0) {
        await prisma.notification.createMany({
            data: admins.map((a) => ({
                userId: a.id,
                title: "Auto-Absent Report 📋",
                message: `${p.markedAbsent} employee${p.markedAbsent !== 1 ? "s" : ""} marked absent for ${p.date}. ${p.skipped} had check-ins or approved leave.`,
                type: "attendance",
                link: "/attendance",
            })),
            skipDuplicates: true,
        });
    }
}

// ── Approval Handlers ──

async function handleApprovalAssigned(p: EventMap["approval.assigned"]) {
    await createNotificationSafe(
        p.userId,
        `New ${capitalize(p.entityType)} Approval Request`,
        `${p.requesterName} submitted a ${p.entityType} request that requires your approval.${p.dueDate ? ` Due: ${p.dueDate}` : ""}`,
        "alert",
        "/approval-workflows"
    );
}

async function handleApprovalEscalated(p: EventMap["approval.escalated"]) {
    await createNotificationSafe(
        p.userId,
        "⚠️ Escalated Approval Request",
        `A ${p.entityType} request has been escalated to you from ${p.originalApprover}. ${p.entityDescription}`,
        "alert",
        "/approval-workflows"
    );
}

// ── Loan Handlers ──

async function handleLoanApproved(p: EventMap["loan.approved"]) {
    await createNotificationSafe(
        p.userId,
        "Loan Approved ✅",
        `Your ${p.loanType} loan request for ৳${p.amount.toLocaleString()} has been approved.`,
        "alert",
        "/ess/loans"
    );
}

async function handleLoanRejected(p: EventMap["loan.rejected"]) {
    await createNotificationSafe(
        p.userId,
        "Loan Rejected ❌",
        `Your ${p.loanType} loan request for ৳${p.amount.toLocaleString()} has been rejected.${p.reason ? ` Reason: ${p.reason}` : ""}`,
        "alert",
        "/ess/loans"
    );
}

// ── Device Handlers ──

async function handleDeviceOffline(p: EventMap["device.offline"]) {
    const admins = await prisma.user.findMany({
        where: {
            organizationId: p.organizationId,
            role: { in: ["admin", "hr_admin", "superadmin"] },
        },
        select: { id: true },
    });

    if (admins.length > 0) {
        await prisma.notification.createMany({
            data: admins.map((a) => ({
                userId: a.id,
                title: "⚠️ Device Offline",
                message: `Biometric device "${p.deviceName}" (S/N: ${p.serialNumber}) has been offline since ${p.lastSeen}.`,
                type: "alert",
                link: "/devices",
            })),
            skipDuplicates: true,
        });
    }
}

// ════════════════════════════════════════════════════════════════════════
// Utility Functions
// ════════════════════════════════════════════════════════════════════════

/**
 * Create a single notification, swallowing errors.
 */
async function createNotificationSafe(
    userId: string,
    title: string,
    message: string,
    type: string,
    link?: string
): Promise<void> {
    try {
        await prisma.notification.create({
            data: { userId, title, message, type, link },
        });
    } catch (error) {
        console.error(`[NOTIFY_FAIL] ${title} → ${userId}:`, error);
    }
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
