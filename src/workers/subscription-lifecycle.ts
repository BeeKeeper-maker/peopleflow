/**
 * Subscription Lifecycle Worker
 *
 * Handles all subscription-related background jobs:
 * - Trial expiry detection + notification
 * - Payment failure → suspension cascade enforcement
 * - Daily payment reminder emails for past_due accounts
 * - Plan limit auditing (safety net)
 * - Deactivated tenant data cleanup (30+ days)
 */

import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma";
import {
    redisConnection,
    notificationQueue,
    type SubscriptionJobData,
} from "@/lib/queue";
import { invalidateOrgStatus, invalidateSubscription } from "@/lib/redis";
import { subscriptionLogger } from "@/lib/logger";

const worker = new Worker<SubscriptionJobData>(
    "subscription-lifecycle",
    async (job) => {
        const { type } = job.data;

        subscriptionLogger.info({ jobType: type, jobId: job.id }, `Processing: ${type}`);

        switch (type) {
            case "check-trial-expiry":
                await handleTrialExpiry();
                break;

            case "enforce-suspensions":
                await handleEnforceSuspensions();
                break;

            case "send-payment-reminders":
                await handlePaymentReminders();
                break;

            case "audit-plan-limits":
                await handlePlanLimitAudit();
                break;

            case "cleanup-deactivated-tenants":
                await handleCleanupDeactivated();
                break;

            default:
                subscriptionLogger.warn(`Unknown job type: ${type as string}`);
        }
    },
    {
        connection: redisConnection,
        concurrency: 2,
        limiter: { max: 5, duration: 60000 }, // Max 5 jobs per minute
    }
);

// ── Job Handlers ──

/**
 * Finds trials expiring in the next 3 days and queues notification emails.
 */
async function handleTrialExpiry(): Promise<void> {
    const now = new Date();
    const threeDaysFromNow = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000
    );

    const expiringTrials = await prisma.subscription.findMany({
        where: {
            status: "trialing",
            trialEnd: {
                gte: now,
                lte: threeDaysFromNow,
            },
        },
        include: {
            organization: { select: { id: true, name: true } },
            plan: { select: { name: true } },
        },
    });

    subscriptionLogger.info({ count: expiringTrials.length }, `Found ${expiringTrials.length} trials expiring soon`);

    for (const sub of expiringTrials) {
        // Find the org admin to notify
        const admin = await prisma.user.findFirst({
            where: {
                organizationId: sub.organizationId,
                role: "admin",
            },
            select: { email: true },
        });

        if (admin) {
            await notificationQueue.add("trial-ending", {
                type: "trial-ending",
                to: admin.email,
                organizationId: sub.organizationId,
                data: {
                    organizationName: sub.organization.name,
                    planName: sub.plan.name,
                    trialEnd: sub.trialEnd?.toISOString(),
                    daysLeft: Math.ceil(
                        ((sub.trialEnd?.getTime() || 0) - now.getTime()) /
                            (1000 * 60 * 60 * 24)
                    ),
                },
            });
        }
    }

    // Also handle trials that have already expired
    const expiredTrials = await prisma.subscription.findMany({
        where: {
            status: "trialing",
            trialEnd: { lt: now },
        },
    });

    for (const sub of expiredTrials) {
        await prisma.$transaction([
            prisma.subscription.update({
                where: { id: sub.id },
                data: { status: "expired" },
            }),
            prisma.organization.update({
                where: { id: sub.organizationId },
                data: {
                    status: "suspended",
                    suspendedAt: now,
                    suspendedReason: "trial_expired",
                },
            }),
        ]);

        await invalidateOrgStatus(sub.organizationId);
        await invalidateSubscription(sub.organizationId);
    }

    subscriptionLogger.info({ count: expiredTrials.length }, `Expired ${expiredTrials.length} overdue trials`);
}

/**
 * Enforces suspension for accounts past_due for more than 7 days.
 */
async function handleEnforceSuspensions(): Promise<void> {
    const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
    );

    // Find past_due subscriptions older than 7 days
    const pastDueSubs = await prisma.subscription.findMany({
        where: {
            status: "past_due",
            updatedAt: { lt: sevenDaysAgo },
        },
        include: {
            organization: { select: { id: true, name: true, status: true } },
        },
    });

    let suspended = 0;

    for (const sub of pastDueSubs) {
        if (sub.organization.status === "suspended") continue; // Already suspended

        await prisma.$transaction([
            prisma.subscription.update({
                where: { id: sub.id },
                data: { status: "suspended" },
            }),
            prisma.organization.update({
                where: { id: sub.organizationId },
                data: {
                    status: "suspended",
                    suspendedAt: new Date(),
                    suspendedReason: "payment_failed",
                },
            }),
        ]);

        await invalidateOrgStatus(sub.organizationId);
        await invalidateSubscription(sub.organizationId);
        suspended++;

        // Queue notification
        const admin = await prisma.user.findFirst({
            where: {
                organizationId: sub.organizationId,
                role: "admin",
            },
            select: { email: true },
        });

        if (admin) {
            await notificationQueue.add("account-suspended", {
                type: "account-suspended",
                to: admin.email,
                organizationId: sub.organizationId,
                data: {
                    organizationName: sub.organization.name,
                    reason: "payment_failed",
                },
            });
        }
    }

    subscriptionLogger.info({ suspended }, `Suspended ${suspended} past-due accounts`);
}

/**
 * Sends payment reminder emails to past_due accounts.
 */
async function handlePaymentReminders(): Promise<void> {
    const pastDueSubs = await prisma.subscription.findMany({
        where: { status: "past_due" },
        include: {
            organization: { select: { id: true, name: true } },
            plan: { select: { name: true, priceMonthly: true } },
        },
    });

    for (const sub of pastDueSubs) {
        const admin = await prisma.user.findFirst({
            where: {
                organizationId: sub.organizationId,
                role: "admin",
            },
            select: { email: true },
        });

        if (admin) {
            await notificationQueue.add("payment-failed", {
                type: "payment-failed",
                to: admin.email,
                organizationId: sub.organizationId,
                data: {
                    organizationName: sub.organization.name,
                    planName: sub.plan.name,
                    amount: sub.plan.priceMonthly,
                },
            });
        }
    }

    subscriptionLogger.info({ count: pastDueSubs.length }, `Queued ${pastDueSubs.length} payment reminders`);
}

/**
 * Safety net: Audits all orgs for plan limit violations.
 * Flags violations but does NOT auto-enforce (to avoid data loss).
 */
async function handlePlanLimitAudit(): Promise<void> {
    const activeOrgs = await prisma.organization.findMany({
        where: { status: "active" },
        include: {
            subscription: {
                include: { plan: true },
            },
            _count: {
                select: {
                    employees: true,
                    users: true,
                    branches: true,
                },
            },
        },
    });

    let violations = 0;

    for (const org of activeOrgs) {
        if (!org.subscription?.plan) continue;

        const plan = org.subscription.plan;
        const overrides = org.subscription;

        const limits = {
            employees: overrides.maxEmployeesOverride ?? plan.maxEmployees,
            admins: plan.maxAdmins,
            branches: plan.maxBranches,
        };

        const checks = [
            {
                resource: "employees",
                current: org._count.employees,
                limit: limits.employees,
            },
            {
                resource: "admins",
                current: org._count.users,
                limit: limits.admins,
            },
            {
                resource: "branches",
                current: org._count.branches,
                limit: limits.branches,
            },
        ];

        for (const check of checks) {
            if (check.limit !== -1 && check.current > check.limit) {
                violations++;
                subscriptionLogger.warn({ orgId: org.id, orgName: org.name, resource: check.resource, current: check.current, limit: check.limit }, "Plan limit violation detected");

                // Record the violation as a usage record
                await prisma.usageRecord.create({
                    data: {
                        metric: `violation_${check.resource}`,
                        value: check.current - check.limit,
                        organizationId: org.id,
                    },
                });
            }
        }
    }

    subscriptionLogger.info({ violations }, `Plan limit audit complete. ${violations} violations found.`);
}

/**
 * Cleans up deactivated tenants older than 30 days.
 * Logs the action but does NOT delete data — marks for manual review.
 */
async function handleCleanupDeactivated(): Promise<void> {
    const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
    );

    const candidates = await prisma.organization.findMany({
        where: {
            status: "deactivated",
            suspendedAt: { lt: thirtyDaysAgo },
        },
        select: {
            id: true,
            name: true,
            suspendedAt: true,
            _count: { select: { employees: true } },
        },
    });

    subscriptionLogger.info({ count: candidates.length }, `Found ${candidates.length} deactivated tenants older than 30 days`);

    // Log candidates for platform admin review
    // In production, this would send a digest email to platform admins
    for (const org of candidates) {
        subscriptionLogger.info({ orgId: org.id, orgName: org.name, suspendedAt: org.suspendedAt?.toISOString(), employees: org._count.employees }, "Cleanup candidate identified");

        await prisma.usageRecord.create({
            data: {
                metric: "cleanup_candidate",
                value: 1,
                organizationId: org.id,
            },
        });
    }
}

// ── Worker Event Handlers ──

worker.on("completed", (job) => {
    subscriptionLogger.debug({ jobId: job.id, jobName: job.name }, "Job completed");
});

worker.on("failed", (job, err) => {
    subscriptionLogger.error({ jobId: job?.id, jobName: job?.name, err }, "Job failed");
});

export default worker;
