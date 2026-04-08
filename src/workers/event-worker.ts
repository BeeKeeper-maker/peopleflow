/**
 * PeopleFlow Event Worker — BullMQ Consumer
 *
 * Processes events from the `event-pipeline` queue:
 *   - Creates in-app notifications (Prisma)
 *   - Sends email notifications (sendTemplateEmail)
 *   - Logs all processed events for audit trail
 *
 * Retry: 5 attempts with exponential backoff (10s → 160s)
 * DLQ:   Failed events are preserved in Redis for manual inspection
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { sendTemplateEmail } from "@/lib/email";
import { eventLogger } from "@/lib/logger";
import type { EventMap, EventName } from "@/lib/event-bus";

// ════════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════════

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ════════════════════════════════════════════════════════════════════════
// Notification Creator (safe — swallows errors)
// ════════════════════════════════════════════════════════════════════════

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
        eventLogger.error({ err: error, userId, title }, "Failed to create notification");
    }
}

// ════════════════════════════════════════════════════════════════════════
// Event Handlers (moved from event-bus.ts)
// ════════════════════════════════════════════════════════════════════════

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

async function handlePayrollProcessed(p: EventMap["payroll.processed"]) {
    const monthName = MONTH_NAMES[p.month - 1] || `Month ${p.month}`;
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
        await prisma.notification.createMany({ data: userNotifications, skipDuplicates: true });
    }
    for (const emp of p.employeeResults) {
        if (emp.email) {
            sendTemplateEmail(emp.email, "payslipReady", {
                employeeName: emp.name, month: monthName, year: p.year,
            }).catch((err) => eventLogger.error({ err, email: emp.email }, "Failed to send payslip email"));
        }
    }
    const admins = await prisma.user.findMany({
        where: { organizationId: p.organizationId, role: { in: ["admin", "hr_admin", "superadmin"] } },
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

async function handleExpenseApproved(p: EventMap["expense.approved"]) {
    await createNotificationSafe(p.userId, "Expense Approved ✅",
        `Your expense claim "${p.title}" for ৳${p.amount.toLocaleString()} has been approved.`, "alert", "/ess/expenses");
    if (p.employeeEmail) {
        await sendTemplateEmail(p.employeeEmail, "expenseApproved", {
            employeeName: p.employeeName, title: p.title, amount: `৳${p.amount.toLocaleString()}`,
        });
    }
}

async function handleExpenseRejected(p: EventMap["expense.rejected"]) {
    await createNotificationSafe(p.userId, "Expense Rejected ❌",
        `Your expense claim "${p.title}" for ৳${p.amount.toLocaleString()} has been rejected.${p.reason ? ` Reason: ${p.reason}` : ""}`, "alert", "/ess/expenses");
}

async function handleExpenseReimbursed(p: EventMap["expense.reimbursed"]) {
    await createNotificationSafe(p.userId, "Expense Reimbursed 💵",
        `Your expense claim "${p.title}" for ৳${p.amount.toLocaleString()} has been reimbursed.`, "alert", "/ess/expenses");
}

async function handleRegularizationApproved(p: EventMap["attendance.regularization.approved"]) {
    await createNotificationSafe(p.userId, "Regularization Approved ✅",
        `Your attendance regularization request for ${p.date} has been approved.`, "attendance", "/ess/attendance");
}

async function handleRegularizationRejected(p: EventMap["attendance.regularization.rejected"]) {
    await createNotificationSafe(p.userId, "Regularization Rejected ❌",
        `Your attendance regularization request for ${p.date} has been rejected.`, "attendance", "/ess/attendance");
}

async function handleAutoAbsentCompleted(p: EventMap["attendance.auto_absent.completed"]) {
    if (p.markedAbsent === 0) return;
    const admins = await prisma.user.findMany({
        where: { organizationId: p.organizationId, role: { in: ["admin", "hr_admin", "superadmin"] } },
        select: { id: true },
    });
    if (admins.length > 0) {
        await prisma.notification.createMany({
            data: admins.map((a) => ({
                userId: a.id,
                title: "Auto-Absent Report 📋",
                message: `${p.markedAbsent} employee${p.markedAbsent !== 1 ? "s" : ""} marked absent for ${p.date}. ${p.skipped} had check-ins or approved leave.`,
                type: "attendance", link: "/attendance",
            })),
            skipDuplicates: true,
        });
    }
}

async function handleApprovalAssigned(p: EventMap["approval.assigned"]) {
    await createNotificationSafe(p.userId, `New ${capitalize(p.entityType)} Approval Request`,
        `${p.requesterName} submitted a ${p.entityType} request that requires your approval.${p.dueDate ? ` Due: ${p.dueDate}` : ""}`, "alert", "/approval-workflows");
}

async function handleApprovalEscalated(p: EventMap["approval.escalated"]) {
    await createNotificationSafe(p.userId, "⚠️ Escalated Approval Request",
        `A ${p.entityType} request has been escalated to you from ${p.originalApprover}. ${p.entityDescription}`, "alert", "/approval-workflows");
}

async function handleLoanApproved(p: EventMap["loan.approved"]) {
    await createNotificationSafe(p.userId, "Loan Approved ✅",
        `Your ${p.loanType} loan request for ৳${p.amount.toLocaleString()} has been approved.`, "alert", "/ess/loans");
}

async function handleLoanRejected(p: EventMap["loan.rejected"]) {
    await createNotificationSafe(p.userId, "Loan Rejected ❌",
        `Your ${p.loanType} loan request for ৳${p.amount.toLocaleString()} has been rejected.${p.reason ? ` Reason: ${p.reason}` : ""}`, "alert", "/ess/loans");
}

async function handleDeviceOffline(p: EventMap["device.offline"]) {
    const admins = await prisma.user.findMany({
        where: { organizationId: p.organizationId, role: { in: ["admin", "hr_admin", "superadmin"] } },
        select: { id: true },
    });
    if (admins.length > 0) {
        await prisma.notification.createMany({
            data: admins.map((a) => ({
                userId: a.id,
                title: "⚠️ Device Offline",
                message: `Biometric device "${p.deviceName}" (S/N: ${p.serialNumber}) has been offline since ${p.lastSeen}.`,
                type: "alert", link: "/devices",
            })),
            skipDuplicates: true,
        });
    }
}

// ════════════════════════════════════════════════════════════════════════
// Event Dispatcher
// ════════════════════════════════════════════════════════════════════════

async function handleEvent(event: EventName, payload: EventMap[EventName]): Promise<void> {
    switch (event) {
        case "leave.approved": return handleLeaveApproved(payload as EventMap["leave.approved"]);
        case "leave.rejected": return handleLeaveRejected(payload as EventMap["leave.rejected"]);
        case "payroll.processed": return handlePayrollProcessed(payload as EventMap["payroll.processed"]);
        case "expense.approved": return handleExpenseApproved(payload as EventMap["expense.approved"]);
        case "expense.rejected": return handleExpenseRejected(payload as EventMap["expense.rejected"]);
        case "expense.reimbursed": return handleExpenseReimbursed(payload as EventMap["expense.reimbursed"]);
        case "attendance.regularization.approved": return handleRegularizationApproved(payload as EventMap["attendance.regularization.approved"]);
        case "attendance.regularization.rejected": return handleRegularizationRejected(payload as EventMap["attendance.regularization.rejected"]);
        case "attendance.auto_absent.completed": return handleAutoAbsentCompleted(payload as EventMap["attendance.auto_absent.completed"]);
        case "approval.assigned": return handleApprovalAssigned(payload as EventMap["approval.assigned"]);
        case "approval.escalated": return handleApprovalEscalated(payload as EventMap["approval.escalated"]);
        case "loan.approved": return handleLoanApproved(payload as EventMap["loan.approved"]);
        case "loan.rejected": return handleLoanRejected(payload as EventMap["loan.rejected"]);
        case "device.offline": return handleDeviceOffline(payload as EventMap["device.offline"]);
        default:
            eventLogger.debug({ event }, `No handler registered for event: ${event}`);
    }
}

// ════════════════════════════════════════════════════════════════════════
// BullMQ Worker
// ════════════════════════════════════════════════════════════════════════

const worker = new Worker(
    "event-pipeline",
    async (job: Job<{ event: EventName; payload: EventMap[EventName] }>) => {
        const { event, payload } = job.data;
        eventLogger.info({ event, jobId: job.id, attempt: job.attemptsMade + 1 }, `Processing event: ${event}`);

        await handleEvent(event, payload);

        eventLogger.info({ event, jobId: job.id }, `Event processed: ${event}`);
    },
    {
        connection: redisConnection,
        concurrency: 10, // Process up to 10 events in parallel
        limiter: {
            max: 50,
            duration: 1000, // Max 50 jobs/second to avoid email provider rate limits
        },
    }
);

// ── Lifecycle Hooks ──

worker.on("completed", (job) => {
    eventLogger.debug({ jobId: job.id, event: job.data.event }, "Job completed");
});

worker.on("failed", (job, err) => {
    if (job) {
        const isMaxRetry = job.attemptsMade >= (job.opts.attempts ?? 5);
        if (isMaxRetry) {
            eventLogger.error(
                { err, jobId: job.id, event: job.data.event, attempts: job.attemptsMade },
                `🔴 DEAD LETTER: Event exhausted all retries → ${job.data.event}`
            );
        } else {
            eventLogger.warn(
                { err, jobId: job.id, event: job.data.event, attempt: job.attemptsMade },
                `Event retry scheduled: ${job.data.event}`
            );
        }
    }
});

worker.on("error", (err) => {
    eventLogger.error({ err }, "Event worker error");
});

eventLogger.info("🚀 Event pipeline worker started (concurrency: 10)");

export { worker as eventWorker };
