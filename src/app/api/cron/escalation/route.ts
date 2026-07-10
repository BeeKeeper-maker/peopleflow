/**
 * CRON: Approval Escalation Engine
 * 
 * Endpoint: GET /api/cron/escalation
 * Schedule: Every hour
 * 
 * Scans all in-progress ApprovalRequests with a dueDate that has passed.
 * For overdue requests:
 *  1. Marks the current step as "escalated"
 *  2. Advances to the next approver in the chain (if configured)
 *  3. Notifies the escalated approver
 *  4. Logs the escalation in ApprovalStepLog
 *
 * RLS note (P0-BACKEND): Cross-tenant "find all overdue requests" uses
 * `withPlatform()` (rls_bypass=true). Per-request work is executed inside
 * `withTenant(request.organizationId, …)` so each organization's data stays
 * isolated while still allowing the cron to process all tenants.
 */

import { verifyCronAuth, cronResponse } from "@/lib/cron-auth";
import { emit } from "@/lib/event-bus";
import { withPlatform, withTenant } from "@/lib/prisma";
import { cronLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
    // ── Auth ──
    const authError = verifyCronAuth(req);
    if (authError) return authError;

    const startTime = Date.now();

    try {
        const now = new Date();

        // Find all in-progress approval requests that are past their due date.
        // Cross-tenant query → must use RLS bypass.
        const overdueRequests = await withPlatform((db) =>
            db.approvalRequest.findMany({
                where: {
                    status: "in_progress",
                    dueDate: { lt: now },
                },
                include: {
                    requester: {
                        select: {
                            firstName: true,
                            lastName: true,
                            user: { select: { id: true } },
                        },
                    },
                    organization: {
                        select: { name: true },
                    },
                    steps: {
                        where: { status: "pending" },
                        orderBy: { stepNumber: "asc" },
                        take: 1,
                        select: {
                            id: true,
                            stepNumber: true,
                            stepName: true,
                            assignedToId: true,
                            assignedRole: true,
                        },
                    },
                },
            }),
        );

        let escalated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (const request of overdueRequests) {
            try {
                // All per-request work is scoped to the request's organization.
                const escalation = await withTenant(request.organizationId, async (db) => {
                    // Get current approver info via currentApproverId
                    let currentApproverName = "previous approver";
                    let escalateToId: string | null = null;
                    let escalateToName = "HR Admin";

                    if (request.currentApproverId) {
                        const currentApprover = await db.employee.findUnique({
                            where: { id: request.currentApproverId },
                            select: {
                                firstName: true,
                                lastName: true,
                                reportingManagerId: true,
                            },
                        });

                        if (currentApprover) {
                            currentApproverName = `${currentApprover.firstName} ${currentApprover.lastName}`;

                            // Find the skip-level manager for escalation
                            if (currentApprover.reportingManagerId) {
                                const skipLevelManager = await db.employee.findUnique({
                                    where: { id: currentApprover.reportingManagerId },
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        user: { select: { id: true } },
                                    },
                                });

                                if (skipLevelManager?.user?.id) {
                                    escalateToId = skipLevelManager.user.id;
                                    escalateToName = `${skipLevelManager.firstName} ${skipLevelManager.lastName}`;
                                }
                            }
                        }
                    }

                    // If no skip-level manager, escalate to any HR admin in the org
                    if (!escalateToId) {
                        const hrAdmin = await db.user.findFirst({
                            where: {
                                organizationId: request.organizationId,
                                role: { in: ["admin", "hr_admin"] },
                            },
                            select: { id: true, name: true },
                        });

                        if (hrAdmin) {
                            escalateToId = hrAdmin.id;
                            escalateToName = hrAdmin.name || "HR Admin";
                        }
                    }

                    if (!escalateToId) {
                        return { escalated: false, escalateToId: null, escalateToName: "", currentApproverName };
                    }

                    // Get current pending step info
                    const currentPendingStep = request.steps[0];
                    const nextStepNumber = currentPendingStep
                        ? currentPendingStep.stepNumber + 1
                        : request.currentStep + 1;

                    // Mark current step as escalated if it exists
                    if (currentPendingStep) {
                        await db.approvalStepLog.update({
                            where: { id: currentPendingStep.id },
                            data: {
                                status: "escalated",
                                notes: `Auto-escalated: SLA breached (due: ${request.dueDate?.toISOString()}). Escalated from ${currentApproverName} to ${escalateToName}.`,
                                actedAt: now,
                            },
                        });
                    }

                    // Update the request's current step
                    await db.approvalRequest.update({
                        where: { id: request.id },
                        data: {
                            currentStep: nextStepNumber,
                        },
                    });

                    return { escalated: true, escalateToId, escalateToName, currentApproverName };
                });

                if (!escalation.escalated || !escalation.escalateToId) {
                    skipped++;
                    continue;
                }

                // Notify the escalated approver (events are platform-level, not DB-scoped)
                await emit("approval.escalated", {
                    userId: escalation.escalateToId,
                    approverName: escalation.escalateToName,
                    entityType: request.entityType,
                    entityDescription: `${request.entityType} request from ${request.requester.firstName} ${request.requester.lastName}`,
                    originalApprover: escalation.currentApproverName,
                });

                // Also notify the requester that their request was escalated
                if (request.requester.user?.id) {
                    await emit("approval.assigned", {
                        userId: request.requester.user.id,
                        approverName: escalation.escalateToName,
                        entityType: request.entityType,
                        entityDescription: `Your ${request.entityType} request has been escalated to ${escalation.escalateToName} due to SLA breach.`,
                        requesterName: `${request.requester.firstName} ${request.requester.lastName}`,
                    });
                }

                escalated++;
            } catch (reqError) {
                const msg = reqError instanceof Error ? reqError.message : String(reqError);
                errors.push(`Request ${request.id}: ${msg}`);
            }
        }

        return cronResponse(
            {
                job: "approval-escalation",
                overdueFound: overdueRequests.length,
                escalated,
                skipped,
                errorCount: errors.length,
                durationMs: Date.now() - startTime,
                errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
            },
            errors.length > 0 ? "partial" : "success"
        );
    } catch (error) {
        cronLogger.error({ err: error }, "[CRON] escalation FATAL:");
        return cronResponse(
            {
                job: "approval-escalation",
                error: error instanceof Error ? error.message : "Unknown error",
                durationMs: Date.now() - startTime,
            },
            "error"
        );
    }
}
