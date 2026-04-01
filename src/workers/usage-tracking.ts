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

const worker = new Worker<UsageTrackingJobData>(
    "usage-tracking",
    async (job) => {
        const { type, organizationId } = job.data;

        console.log(
            `[WORKER:usage] Processing: ${type} (Job ${job.id})`
        );

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

    console.log(
        `[WORKER:usage] Snapshotting ${activeOrgs.length} organizations`
    );

    let processed = 0;

    for (const org of activeOrgs) {
        await snapshotOrganization(org.id);
        processed++;
    }

    console.log(
        `[WORKER:usage] Completed ${processed}/${activeOrgs.length} snapshots`
    );
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
        console.error(
            `[WORKER:usage] Failed to snapshot org ${orgId}:`,
            error
        );
    }
}

worker.on("completed", (job) => {
    console.log(
        `[WORKER:usage] Job ${job.id} completed`
    );
});

worker.on("failed", (job, err) => {
    console.error(
        `[WORKER:usage] Job ${job?.id} failed:`,
        err.message
    );
});

export default worker;
