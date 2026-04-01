/**
 * Impersonation Cleanup Worker
 *
 * Runs every 15 minutes to:
 * - Expire active impersonation sessions that have passed their expiresAt
 * - Log expired sessions for audit trail
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { redisConnection, type ImpersonationJobData } from "@/lib/queue";

const worker = new Worker<ImpersonationJobData>(
    "impersonation-cleanup",
    async (job) => {
        console.log(
            `[WORKER:impersonation] Processing: ${job.data.type} (Job ${job.id})`
        );

        const now = new Date();

        // Find all active sessions that have expired
        const expiredSessions = await prisma.impersonationSession.findMany({
            where: {
                status: "active",
                expiresAt: { lt: now },
            },
            include: {
                platformAdmin: {
                    select: { name: true, email: true },
                },
            },
        });

        if (expiredSessions.length === 0) {
            console.log("[WORKER:impersonation] No expired sessions found");
            return;
        }

        console.log(
            `[WORKER:impersonation] Found ${expiredSessions.length} expired sessions`
        );

        // Batch update all expired sessions
        await prisma.impersonationSession.updateMany({
            where: {
                id: { in: expiredSessions.map((s) => s.id) },
            },
            data: {
                status: "expired",
                endedAt: now,
            },
        });

        // Create audit logs for each expired session
        for (const session of expiredSessions) {
            await prisma.platformAuditLog.create({
                data: {
                    action: "impersonation.auto_expired",
                    targetType: "impersonation_session",
                    targetId: session.id,
                    /* eslint-disable @typescript-eslint/no-explicit-any */
                    metadata: {
                        targetOrganizationId: session.targetOrganizationId,
                        targetUserId: session.targetUserId,
                        reason: session.reason,
                        adminName: session.platformAdmin.name,
                        expiredAt: now.toISOString(),
                        originalExpiry: session.expiresAt.toISOString(),
                    } as any,
                    /* eslint-enable @typescript-eslint/no-explicit-any */
                    platformAdminId: session.platformAdminId,
                },
            });
        }

        console.log(
            `[WORKER:impersonation] Expired ${expiredSessions.length} sessions with audit logs`
        );
    },
    {
        connection: redisConnection,
        concurrency: 1, // Only one cleanup job at a time
    }
);

worker.on("completed", (job) => {
    console.log(
        `[WORKER:impersonation] Job ${job.id} completed`
    );
});

worker.on("failed", (job, err) => {
    console.error(
        `[WORKER:impersonation] Job ${job?.id} failed:`,
        err.message
    );
});

export default worker;
