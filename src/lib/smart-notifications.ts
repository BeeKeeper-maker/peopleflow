/**
 * PeopleFlow Smart Notification Sender
 *
 * Wraps createNotification / createBulkNotifications with preference-aware
 * delivery:
 *   - Respects per-user channel toggles (in_app, email, push)
 *   - Respects per-category overrides
 *   - Respects quiet hours (no push/email during quiet hours)
 *   - Supports digest mode (daily/weekly summary instead of instant email)
 *
 * Usage:
 *   import { sendSmartNotification } from "@/lib/smart-notifications";
 *   await sendSmartNotification({
 *     userId: "user_...",
 *     title: "Leave Approved",
 *     message: "Your leave request has been approved",
 *     type: "leave_approval",
 *     category: "leave",
 *     link: "/ess/leaves",
 *   });
 */

import { prisma } from "@/lib/prisma";
import { createNotification, createBulkNotifications } from "@/lib/notifications";
import { apiLogger } from "@/lib/logger";

export interface SmartNotificationParams {
    userId: string;
    title: string;
    message: string;
    type: string;
    category?: string; // leave, payroll, attendance, expense, announcement, alert, etc.
    link?: string;
}

export interface SmartNotificationResult {
    inApp: boolean;
    email: boolean;
    push: boolean;
    digested: boolean;
}

/**
 * Check if the current time falls within the user's quiet hours.
 * Quiet hours are in BD local time (Asia/Dhaka, UTC+6).
 */
function isInQuietHours(
    quietStart: string | null,
    quietEnd: string | null,
): boolean {
    if (!quietStart || !quietEnd) return false;

    // Current BD local time
    const now = new Date();
    const bdOffsetMs = 6 * 60 * 60 * 1000;
    const bdTime = new Date(now.getTime() + bdOffsetMs);
    const bdHours = bdTime.getUTCHours();
    const bdMinutes = bdTime.getUTCMinutes();
    const currentMinutes = bdHours * 60 + bdMinutes;

    const [startH, startM] = quietStart.split(":").map(Number);
    const [endH, endM] = quietEnd.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // Handle overnight quiet hours (e.g., 22:00 → 07:00)
    if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
}

/**
 * Resolve the effective channel settings for a user + category.
 * Checks per-category overrides first, then falls back to global defaults.
 */
function resolveChannels(
    prefs: {
        inAppEnabled: boolean;
        emailEnabled: boolean;
        pushEnabled: boolean;
        categoryOverrides: unknown;
    } | null,
    category: string | undefined,
): { inApp: boolean; email: boolean; push: boolean } {
    const defaults = {
        inApp: prefs?.inAppEnabled ?? true,
        email: prefs?.emailEnabled ?? true,
        push: prefs?.pushEnabled ?? false,
    };

    if (!category || !prefs?.categoryOverrides) return defaults;

    const overrides = prefs.categoryOverrides as Record<
        string,
        { inApp?: boolean; email?: boolean; push?: boolean }
    >;

    const catOverride = overrides[category];
    if (!catOverride) return defaults;

    return {
        inApp: catOverride.inApp ?? defaults.inApp,
        email: catOverride.email ?? defaults.email,
        push: catOverride.push ?? defaults.push,
    };
}

/**
 * Send a notification respecting the user's preferences.
 *
 * Always creates an in-app notification (so it shows in the bell icon)
 * unless the user has explicitly disabled in-app for this category.
 * Email and push are sent based on preferences, digest mode, and quiet hours.
 */
export async function sendSmartNotification(
    params: SmartNotificationParams,
): Promise<SmartNotificationResult> {
    const { userId, title, message, type, category, link } = params;

    // Load user preferences (lazy — defaults if none exist)
    const prefs = await prisma.notificationPreference.findUnique({
        where: { userId },
    });

    const channels = resolveChannels(prefs, category);
    const inQuietHours = isInQuietHours(
        prefs?.quietHoursStart ?? null,
        prefs?.quietHoursEnd ?? null,
    );

    const result: SmartNotificationResult = {
        inApp: false,
        email: false,
        push: false,
        digested: false,
    };

    // 1. In-app notification (always, unless explicitly disabled)
    if (channels.inApp) {
        try {
            await createNotification({
                userId,
                title,
                message,
                type: type as "leave_approval" | "payroll" | "announcement" | "alert" | "attendance" | "employee" | "leave_request",
                link,
            });
            result.inApp = true;
        } catch (err) {
            apiLogger.error({ err, userId }, "Failed to create in-app notification");
        }
    }

    // 2. Email — respect digest mode and quiet hours
    const digestMode = prefs?.digestMode ?? "instant";
    if (channels.email) {
        if (digestMode === "instant" && !inQuietHours) {
            // Send immediately via the email worker (event bus → event-worker)
            // For now, we just mark that email should be sent. The actual
            // email sending is handled by the event-worker which reads
            // Notification rows and sends emails.
            result.email = true;
            // TODO: trigger email worker for this notification
        } else if (digestMode === "daily" || digestMode === "weekly") {
            // Queue for digest — the notification is already stored in-app,
            // the digest cron will batch and send.
            result.digested = true;
        }
    }

    // 3. Push — respect quiet hours
    if (channels.push && prefs?.pushSubscription && !inQuietHours) {
        // Web push sending requires the web-push library (VAPID keys).
        // For now, we log — the push worker will be added in a future pass.
        apiLogger.debug({ userId, title }, "Push notification queued (pending push worker)");
        result.push = true;
        // TODO: integrate web-push library with VAPID keys
    }

    return result;
}

/**
 * Send a smart notification to multiple users (bulk).
 * Loads each user's preferences and sends accordingly.
 */
export async function sendSmartBulkNotifications(
    userIds: string[],
    params: Omit<SmartNotificationParams, "userId">,
): Promise<{ sent: number; results: SmartNotificationResult[] }> {
    const results: SmartNotificationResult[] = [];

    for (const userId of userIds) {
        try {
            const result = await sendSmartNotification({ ...params, userId });
            results.push(result);
        } catch (err) {
            apiLogger.error({ err, userId }, "Failed to send bulk notification");
            results.push({ inApp: false, email: false, push: false, digested: false });
        }
    }

    const sent = results.filter((r) => r.inApp || r.email || r.push).length;
    return { sent, results };
}

/**
 * Digest sender — called by a daily/weekly cron job.
 *
 * For each user with digestMode = "daily" or "weekly":
 *   1. Fetch unread notifications created since the last digest
 *   2. Group by category
 *   3. Send a single summary email
 *   4. Mark notifications as "digested" (via a flag — for now, we just
 *      rely on the isRead flag)
 *
 * This is a placeholder — the full implementation will be in the
 * digest-worker.ts when the email infrastructure is fully wired.
 */
export async function sendDigestEmails(mode: "daily" | "weekly"): Promise<void> {
    apiLogger.info({ mode }, "Digest email batch starting");

    const users = await prisma.notificationPreference.findMany({
        where: {
            digestMode: mode,
            emailEnabled: true,
        },
        select: { userId: true },
    });

    apiLogger.info({ mode, userCount: users.length }, "Digest users found");

    // TODO: for each user, fetch unread notifications since last digest,
    // compose a summary email, send it, mark as digested.
    // This will be implemented when the email worker is fully wired.

    apiLogger.info({ mode, sent: 0 }, "Digest email batch complete (no-op pending email worker)");
}
