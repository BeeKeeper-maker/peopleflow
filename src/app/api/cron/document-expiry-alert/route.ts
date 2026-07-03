import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createBulkNotifications } from "@/lib/notifications";
import { apiLogger } from "@/lib/logger";

/**
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
 */
export async function POST(req: Request) {
    // Authenticate via CRON_SECRET
    const authResult = verifyCronAuth(req);
    if (authResult) return authResult;

    try {
        const now = new Date();
        const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const next1Day = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Find documents expiring in the alert windows
        // Only alert for non-deleted documents with expiry dates set
        const expiringDocs = await prisma.employeeDocument.findMany({
            where: {
                deletedAt: null,
                expiryDate: {
                    gte: now,
                    lte: next30Days,
                },
                // Don't re-alert on the same day (check via a simple heuristic:
                // we alert on 30, 7, 1, and 0 day marks)
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
        });

        // Also find documents that expired in the last 24 hours (already expired today)
        const expiredToday = await prisma.employeeDocument.findMany({
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
        });

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
            // Find HR/admin users in this org to notify
            const recipients = await prisma.user.findMany({
                where: {
                    organizationId: orgId,
                    role: { in: ["admin", "hr_admin", "super_admin"] },
                    isActive: true,
                },
                select: { id: true },
            });

            if (recipients.length === 0) continue;

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

            // Send notifications to all HR/admin recipients
            for (const notif of notifications) {
                await createBulkNotifications(
                    recipients.map((r) => r.id),
                    notif,
                );
                totalAlerts++;
            }
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
