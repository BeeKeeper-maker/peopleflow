/**
 * Usage Tracking Worker
 *
 * Periodically snapshots resource usage for all active tenants.
 * Data feeds into the Platform Analytics dashboard and
 * enables historical trending for capacity planning.
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import { redisConnection, type UsageTrackingJobData } from "@/lib/queue";
import { log } from "@/lib/logger";

const usageLogger = log.child({ domain: "usage-tracking" });

const worker = new Worker<UsageTrackingJobData>(
    "usage-tracking",
    async (job) => {
        const { type, organizationId } = job.data;

        usageLogger.info({ type, jobId: job.id }, `Processing: ${type}`);

        if (type === "snapshot-org" && organizationId) {
            await snapshotOrganization(organizationId);
        } else {
            await snapshotAll();
        }
    },
    {
        connection: redisConnection,
        concurrency: 3, // Process multiple orgs in parallel
    }
);

/**
 * Snapshot usage metrics for all active organizations.
 */
async function snapshotAll(): Promise<void> {
    const activeOrgs = await prisma.organization.findMany({
        where: { status: "active" },
        select: { id: true },
    });

    usageLogger.info({ count: activeOrgs.length }, `Snapshotting ${activeOrgs.length} organizations`);

    let processed = 0;

    for (const org of activeOrgs) {
        await snapshotOrganization(org.id);
        processed++;
    }

    usageLogger.info({ processed, total: activeOrgs.length }, "Snapshots completed");
}

/**
 * Snapshot usage for a single organization.
 */
async function snapshotOrganization(orgId: string): Promise<void> {
    try {
        const [
            employeeCount,
            userCount,
            branchCount,
            departmentCount,
            leaveAppCount,
        ] = await prisma.$transaction([
            prisma.employee.count({ where: { organizationId: orgId } }),
            prisma.user.count({ where: { organizationId: orgId } }),
            prisma.branch.count({ where: { organizationId: orgId } }),
            prisma.department.count({ where: { organizationId: orgId } }),
            prisma.leaveApplication.count({
                where: {
                    employee: { organizationId: orgId },
                    appliedAt: {
                        gte: new Date(
                            Date.now() - 30 * 24 * 60 * 60 * 1000
                        ),
                    },
                },
            }),
        ]);

        // Create usage records
        const now = new Date();
        await prisma.usageRecord.createMany({
            data: [
                {
                    metric: "active_employees",
                    value: employeeCount,
                    organizationId: orgId,
                    recordedAt: now,
                },
                {
                    metric: "active_users",
                    value: userCount,
                    organizationId: orgId,
                    recordedAt: now,
                },
                {
                    metric: "branches",
                    value: branchCount,
                    organizationId: orgId,
                    recordedAt: now,
                },
                {
                    metric: "departments",
                    value: departmentCount,
                    organizationId: orgId,
                    recordedAt: now,
                },
                {
                    metric: "leave_applications_30d",
                    value: leaveAppCount,
                    organizationId: orgId,
                    recordedAt: now,
                },
            ],
        });
    } catch (error) {
        usageLogger.error({ err: error, orgId }, "Failed to snapshot organization");
    }
}

worker.on("completed", (job) => {
    usageLogger.debug({ jobId: job.id }, "Job completed");
});

worker.on("failed", (job, err) => {
    usageLogger.error({ jobId: job?.id, err }, "Job failed");
});

export default worker;
