/**
 * PeopleFlow Web Push Helper
 *
 * Thin wrapper around the `web-push` npm package that:
 *   - Lazily configures VAPID details once per process (idempotent).
 *   - Gracefully degrades when VAPID keys are not configured (logs a warning,
 *     returns false instead of throwing).
 *   - Exposes ergonomic send helpers for single + bulk notifications.
 *
 * IMPORTANT: web-push uses Node.js crypto + https — server-side only.
 * Never import this module from a client component.
 *
 * Usage:
 *   import { sendPushNotification } from "@/lib/web-push";
 *   await sendPushNotification(subscription, { title, body, url });
 */

import webpush from "web-push";
import { apiLogger } from "@/lib/logger";

let configured = false;

/**
 * Configure the web-push library with VAPID details (idempotent).
 * Returns true if push is available, false if VAPID keys are missing.
 */
function ensureConfigured(): boolean {
    if (configured) return true;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
        apiLogger.warn(
            "VAPID keys not configured — web push disabled (set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY)",
        );
        return false;
    }

    // The subject should be a mailto: or https:// URL that push services can
    // use to contact the sender if there's a problem. Use the app URL when
    // available, otherwise a sensible mailto fallback.
    const subject =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        "mailto:admin@peopleflow.app";

    webpush.setVapidDetails(subject, publicKey, privateKey);

    configured = true;
    return true;
}

export interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    expirationTime?: number | null;
}

export interface PushPayload {
    title: string;
    body: string;
    url?: string;
    icon?: string;
}

/**
 * Send a web push notification to a single subscription.
 * Returns true on success, false on failure (incl. when VAPID is unconfigured).
 *
 * Failures are non-fatal — callers should NOT let push errors block the
 * notification creation flow. The DB record is the source of truth; push is
 * a best-effort delivery channel.
 */
export async function sendPushNotification(
    subscription: PushSubscription,
    payload: PushPayload,
): Promise<boolean> {
    if (!ensureConfigured()) return false;

    try {
        await webpush.sendNotification(
            subscription,
            JSON.stringify(payload),
        );
        return true;
    } catch (err) {
        apiLogger.error(
            { err, endpoint: subscription.endpoint },
            "Push notification failed",
        );
        return false;
    }
}

/**
 * Send push notifications to multiple subscriptions (serial — the web-push
 * library is not concurrency-safe per subscription due to VAPID header reuse).
 * Returns count of successful sends.
 */
export async function sendPushNotifications(
    subscriptions: PushSubscription[],
    payload: PushPayload,
): Promise<number> {
    let successCount = 0;

    for (const sub of subscriptions) {
        const success = await sendPushNotification(sub, payload);
        if (success) successCount++;
    }

    return successCount;
}

/**
 * Generate a fresh VAPID keypair (run once, store the result in env).
 *
 * Usage:
 *   npx tsx -e "import('./src/lib/web-push').then(m => m.generateVapidKeys().then(console.log))"
 *   # or
 *   npx web-push generate-vapid-keys
 */
export async function generateVapidKeys(): Promise<{
    publicKey: string;
    privateKey: string;
}> {
    const keys = webpush.generateVAPIDKeys();
    return {
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
    };
}
