import { NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

/**
 * GET /api/notifications/push/vapid-key
 *
 * Returns the VAPID public key so the browser can subscribe to push
 * notifications via `serviceWorkerRegistration.pushManager.subscribe({
 *   applicationServerKey: urlBase64ToUint8Array(publicKey),
 * })`.
 *
 * The public key is safe to expose to the client. The private key never
 * leaves the server.
 */
export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
        return NextResponse.json(
            { error: "Push notifications not configured" },
            { status: 503 },
        );
    }

    return NextResponse.json({ publicKey });
}
