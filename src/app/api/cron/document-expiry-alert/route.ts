/**
 * CRON: Document Expiry Alert
 *
 * POST /api/cron/document-expiry-alert
 *
 * Runs daily (e.g., via Coolify cron or BullMQ scheduled job).
 * Sends alerts for employee documents that are expiring soon:
 *   - 30 days before expiry (early warning)
 *   - 7 days before expiry (urgent)
 *   - 1 day before expiry (final reminder)
 *   - On expiry day (expired)
 *
 * Documents tracked: NID, passport, driving license, work permit,
 * contract, visa, professional certification, etc.
 *
 * Auth: CRON_SECRET header (same as other cron endpoints)
 *
 * RLS note (P0-BACKEND): Cross-tenant "find all expiring docs" uses
 * `withPlatform()` (rls_bypass=true). Per-org work (find HR recipients +
 * create notifications) is wrapped in `withTenant(orgId, …)` so the
 * Notification rows pass the tenant_isolation RLS policy (which checks
 * that the userId belongs to the current tenant).
 */

import { NextResponse } from "next/server";
import { withPlatform, withTenant } from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { apiLogger } from "@/lib/logger";

export async function POST(req: Request) {
    // Authenticate via CRON_SECRET
    const authResult = verifyCronAuth(req);
    if (authResult) return authResult;

    try {
        const now = new Date();
        const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Find documents expiring in the alert windows (cross-tenant → RLS bypass)
        const [expiringDocs, expiredToday] = await withPlatform((db) =>
            Promise.all([
                // Documents expiring in the next 30 days
                db.employeeDocument.findMany({
                    where: {
                        deletedAt: null,
                        expiryDate: {
                            gte: now,
                            lte: next30Days,
                        },
                    },
                    include: {
                        employee: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                organizationId: true,
                                user: { select: { id: true } },
                            },
                        },
                    },
                }),
                // Documents that expired in the last 24 hours (already expired today)
                db.employeeDocument.findMany({
                    where: {
                        deletedAt: null,
                        expiryDate: {
                            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                            lt: now,
                        },
                    },
                    include: {
                        employee: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                organizationId: true,
                                user: { select: { id: true } },
                            },
                        },
                    },
                }),
            ]),
        );

        const allDocs = [...expiringDocs, ...expiredToday];

        // Group by organization + employee for batched notifications
        const alertsByOrg = new Map<
            string,
            Array<{
                employeeId: string;
                employeeName: string;
                docName: string;
                docType: string;
                expiryDate: Date;
                daysUntilExpiry: number;
                severity: "info" | "warning" | "urgent" | "expired";
            }>
        >();

        for (const doc of allDocs) {
            const daysUntilExpiry = Math.ceil(
                (doc.expiryDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
            );

            // Determine severity
            let severity: "info" | "warning" | "urgent" | "expired";
            if (daysUntilExpiry < 0) severity = "expired";
            else if (daysUntilExpiry <= 1) severity = "urgent";
            else if (daysUntilExpiry <= 7) severity = "warning";
            else if (daysUntilExpiry <= 30) severity = "info";
            else continue; // > 30 days, no alert yet

            // Only alert at specific thresholds to avoid daily spam:
            // 30, 7, 1, 0 days. Use modulo to approximate.
            const shouldAlert =
                daysUntilExpiry === 30 ||
                daysUntilExpiry === 7 ||
                daysUntilExpiry === 1 ||
                daysUntilExpiry === 0 ||
                daysUntilExpiry < 0; // already expired

            if (!shouldAlert) continue;

            const orgId = doc.employee.organizationId;
            if (!alertsByOrg.has(orgId)) alertsByOrg.set(orgId, []);
            alertsByOrg.get(orgId)!.push({
                employeeId: doc.employee.id,
                employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`,
                docName: doc.name,
                docType: doc.type,
                expiryDate: doc.expiryDate!,
                daysUntilExpiry,
                severity,
            });
        }

        let totalAlerts = 0;

        for (const [orgId, alerts] of alertsByOrg.entries()) {
            // Per-org: find HR/admin recipients AND create notifications inside
            // the tenant RLS context so the Notification rows satisfy the
            // tenant_isolation policy (which checks userId → User.organizationId).
            await withTenant(orgId, async (db) => {
                const recipients = await db.user.findMany({
                    where: {
                        organizationId: orgId,
                        role: { in: ["admin", "hr_admin", "super_admin"] },
                        isActive: true,
                    },
                    select: { id: true },
                });

                if (recipients.length === 0) return;

                const recipientIds = recipients.map((r) => r.id);

                // Group alerts by severity for cleaner notifications
                const expired = alerts.filter((a) => a.severity === "expired");
                const urgent = alerts.filter((a) => a.severity === "urgent");
                const warning = alerts.filter((a) => a.severity === "warning");
                const info = alerts.filter((a) => a.severity === "info");

                const notifications: Array<{ title: string; message: string; type: "alert"; link: string }> = [];

                if (expired.length > 0) {
                    notifications.push({
                        title: "🔴 Documents Expired",
                        message: `${expired.length} document(s) have expired: ${expired
                            .slice(0, 5)
                            .map((a) => `${a.employeeName} (${a.docType})`)
                            .join(", ")}${expired.length > 5 ? ` and ${expired.length - 5} more` : ""}.`,
                        type: "alert",
                        link: "/documents",
                    });
                }

                if (urgent.length > 0) {
                    notifications.push({
                        title: "⚠️ Documents Expiring Tomorrow",
                        message: `${urgent.length} document(s) expire in 1 day: ${urgent
                            .slice(0, 5)
                            .map((a) => `${a.employeeName} (${a.docType})`)
                            .join(", ")}${urgent.length > 5 ? ` and ${urgent.length - 5} more` : ""}.`,
                        type: "alert",
                        link: "/documents",
                    });
                }

                if (warning.length > 0) {
                    notifications.push({
                        title: "📄 Documents Expiring This Week",
                        message: `${warning.length} document(s) expire within 7 days: ${warning
                            .slice(0, 3)
                            .map((a) => `${a.employeeName} (${a.docType})`)
                            .join(", ")}${warning.length > 3 ? ` and ${warning.length - 3} more` : ""}.`,
                        type: "alert",
                        link: "/documents",
                    });
                }

                if (info.length > 0) {
                    notifications.push({
                        title: "📋 Documents Expiring This Month",
                        message: `${info.length} document(s) expire within 30 days. Review them in the Documents section.`,
                        type: "alert",
                        link: "/documents",
                    });
                }

                // Bulk-insert notifications for all recipients at once (RLS-scoped).
                for (const notif of notifications) {
                    await db.notification.createMany({
                        data: recipientIds.map((userId) => ({
                            userId,
                            title: notif.title,
                            message: notif.message,
                            type: notif.type,
                            link: notif.link,
                        })),
                    });
                    totalAlerts++;
                }
            });
        }

        apiLogger.info(
            { totalAlerts, orgsAffected: alertsByOrg.size, docsChecked: allDocs.length },
            "Document expiry alert cron complete",
        );

        return NextResponse.json({
            success: true,
            docsChecked: allDocs.length,
            orgsAffected: alertsByOrg.size,
            notificationsSent: totalAlerts,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "DOCUMENT_EXPIRY_ALERT_CRON_ERROR");
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
