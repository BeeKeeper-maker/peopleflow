/**
 * PeopleFlow Event Bus — Asynchronous BullMQ Pipeline
 *
 * Refactored from synchronous execution to BullMQ offloading:
 *   - `emit()` enqueues to Redis → returns immediately (< 5ms)
 *   - Worker process (src/workers/event-worker.ts) handles:
 *     → In-app notification creation (Prisma)
 *     → Email dispatch (sendTemplateEmail)
 *   - 5 retries with exponential backoff (10s–160s)
 *   - Dead events are preserved in DLQ for analysis
 *
 * The public API is unchanged: `await emit("leave.approved", { ... })`
 */

import { eventPipelineQueue } from "@/lib/queue";
import { eventLogger } from "@/lib/logger";

// ════════════════════════════════════════════════════════════════════════
// Event Type Definitions (unchanged — shared with worker)
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
// Core Emit — Fire-and-Forget BullMQ Dispatch
// ════════════════════════════════════════════════════════════════════════

/**
 * Enqueue an event into the BullMQ pipeline. Returns immediately.
 * The worker process handles notification creation and email dispatch.
 */
export async function emit<T extends EventName>(
    event: T,
    payload: EventMap[T]
): Promise<void> {
    try {
        await eventPipelineQueue.add(event, { event, payload }, {
            jobId: `${event}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
        eventLogger.info({ event }, `Event enqueued: ${event}`);
    } catch (error) {
        // NEVER throw — if Redis is down, log and swallow
        eventLogger.error({ err: error, event }, `Failed to enqueue event: ${event}`);
    }
}
