/**
 * PeopleFlow Configurable Approval Workflow Engine
 *
 * Manages multi-level approval workflows for leaves, expenses, loans,
 * and attendance regularization requests.
 * 
 * ✅ Audit fixes applied:
 *  - Self-approval prevention
 *  - ExpenseClaim rejection now sets rejectedAt timestamp
 *  - Approval notes saved on approve (not just reject)
 */

import prisma from "@/lib/prisma";

// ============================================
// Types
// ============================================

export type ApprovalEntityType = "leave" | "expense" | "loan" | "attendance_regularize";

export interface WorkflowStep {
    level: number;
    approverRole: "manager" | "hr_admin" | "admin";
    approverEmployeeId?: string; // Optional specific person
}

export interface ApprovalResult {
    success: boolean;
    message: string;
    nextApprover?: {
        level: number;
        role: string;
        name?: string;
    };
}

// ============================================
// Get Next Approver
// ============================================

/**
 * Determine the next approver for a given entity type and current level.
 * Uses the configured workflow, falling back to a default workflow if none exists.
 */
export async function getNextApprover(
    entityType: ApprovalEntityType,
    currentLevel: number,
    employeeId: string,
    organizationId: string
): Promise<{ approverRole: string; approverEmployeeId?: string; level: number } | null> {
    // Try to find configured workflow
    const workflow = await prisma.approvalWorkflow.findFirst({
        where: {
            organizationId,
            entityType,
            isActive: true,
        },
    });

    let steps: WorkflowStep[];

    if (workflow) {
        try {
            steps = JSON.parse(workflow.steps) as WorkflowStep[];
        } catch {
            steps = getDefaultWorkflow(entityType);
        }
    } else {
        steps = getDefaultWorkflow(entityType);
    }

    // Sort by level
    steps.sort((a, b) => a.level - b.level);

    // Find the next step after current level
    const nextStep = steps.find(s => s.level > currentLevel);

    if (!nextStep) return null; // All levels approved

    // If specific person required, return that
    if (nextStep.approverEmployeeId) {
        return {
            approverRole: nextStep.approverRole,
            approverEmployeeId: nextStep.approverEmployeeId,
            level: nextStep.level,
        };
    }

    // Otherwise determine by role
    if (nextStep.approverRole === "manager") {
        // Get reporting manager
        const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { reportingManagerId: true },
        });

        return {
            approverRole: "manager",
            approverEmployeeId: employee?.reportingManagerId || undefined,
            level: nextStep.level,
        };
    }

    return {
        approverRole: nextStep.approverRole,
        level: nextStep.level,
    };
}

// ============================================
// Process Approval
// ============================================

/**
 * Process an approval action (approve/reject) for a given entity.
 * Handles multi-level workflows — if more levels remain, moves to next approver.
 */
export async function processApproval(
    entityType: ApprovalEntityType,
    entityId: string,
    approverId: string,
    action: "approve" | "reject",
    currentLevel: number,
    organizationId: string,
    employeeId: string,
    notes?: string
): Promise<ApprovalResult> {
    // ✅ Self-approval prevention
    if (approverId === employeeId) {
        return {
            success: false,
            message: "You cannot approve/reject your own request.",
        };
    }

    if (action === "reject") {
        // Rejection at any level rejects the entire request
        await updateEntityStatus(entityType, entityId, "rejected", approverId, notes);

        return {
            success: true,
            message: `${formatEntityType(entityType)} request rejected.`,
        };
    }

    // Check if there's a next level
    const nextApprover = await getNextApprover(entityType, currentLevel, employeeId, organizationId);

    if (!nextApprover) {
        // Final approval — mark as approved
        await updateEntityStatus(entityType, entityId, "approved", approverId, notes);

        return {
            success: true,
            message: `${formatEntityType(entityType)} request approved.`,
        };
    }

    // Move to next level
    return {
        success: true,
        message: `Approved at level ${currentLevel}. Forwarded to ${nextApprover.approverRole} (level ${nextApprover.level}).`,
        nextApprover: {
            level: nextApprover.level,
            role: nextApprover.approverRole,
        },
    };
}

// ============================================
// Default Workflows
// ============================================

function getDefaultWorkflow(entityType: ApprovalEntityType): WorkflowStep[] {
    switch (entityType) {
        case "leave":
            return [
                { level: 1, approverRole: "manager" },
                { level: 2, approverRole: "hr_admin" },
            ];
        case "expense":
            return [
                { level: 1, approverRole: "manager" },
                { level: 2, approverRole: "hr_admin" },
                { level: 3, approverRole: "admin" },
            ];
        case "loan":
            return [
                { level: 1, approverRole: "hr_admin" },
                { level: 2, approverRole: "admin" },
            ];
        case "attendance_regularize":
            return [
                { level: 1, approverRole: "manager" },
            ];
        default:
            return [
                { level: 1, approverRole: "manager" },
            ];
    }
}

// ============================================
// Helpers
// ============================================

async function updateEntityStatus(
    entityType: ApprovalEntityType,
    entityId: string,
    status: "approved" | "rejected",
    approverId: string,
    notes?: string
): Promise<void> {
    const now = new Date();

    switch (entityType) {
        case "leave":
            await prisma.leaveApplication.update({
                where: { id: entityId },
                data: {
                    status,
                    approvedAt: status === "approved" ? now : undefined,
                    approverId,
                    rejectionReason: status === "rejected" ? notes : undefined,
                },
            });
            break;
        case "expense":
            await prisma.expenseClaim.update({
                where: { id: entityId },
                data: {
                    status,
                    approvedAt: status === "approved" ? now : undefined,
                    rejectedAt: status === "rejected" ? now : undefined, // ✅ FIXED: Set rejectedAt timestamp
                    approverId,
                    approverNotes: notes || undefined,  // ✅ Save notes for both approve and reject
                },
            });
            break;
        case "loan":
            await prisma.loan.update({
                where: { id: entityId },
                data: {
                    status,
                    approvedAt: status === "approved" ? now : undefined,
                    approverId,
                },
            });
            break;
        case "attendance_regularize":
            await prisma.attendance.update({
                where: { id: entityId },
                data: {
                    notes: `[${status.toUpperCase()}] by ${approverId}. ${notes || ""}`.trim(),
                },
            });
            break;
    }
}

function formatEntityType(type: ApprovalEntityType): string {
    const labels: Record<ApprovalEntityType, string> = {
        leave: "Leave",
        expense: "Expense",
        loan: "Loan",
        attendance_regularize: "Attendance Regularization",
    };
    return labels[type] || type;
}
