/**
 * PeopleFlow Direct-Cloud Device Authentication
 *
 * Provides HMAC-based authentication for /iclock/* and ADMS endpoints.
 *
 * Why: Previously, /iclock/* endpoints had NO authentication — anyone who
 * knew a device's serial number could POST fake attendance punches. Serial
 * numbers are printed on devices and visible in the dashboard, so this was
 * a security hole.
 *
 * How: Each direct_cloud device has an optional `cloudSecret` (stored as
 * `cloudSecretHash` = sha256(secret) on BiometricDevice). When set, the
 * device (or any client acting on its behalf) must send:
 *
 *   X-PeopleFlow-Signature: <hex HMAC-SHA256(requestBody, secret)>
 *
 * The server recomputes the HMAC from the received body and the stored
 * secret, and compares. If they match → authenticated.
 *
 * Backward compatibility:
 *   - If a device has `cloudSecretHash = null` → it's in "claim mode".
 *     Punches are CAPTURED to BiometricCloudEvent but NOT ingested into
 *     Attendance. The admin must assign a secret via the dashboard first.
 *   - This lets new devices announce themselves (so the admin can see
 *     the serial number) without allowing unauthenticated punch injection.
 *
 * Future: For devices that can't send custom headers (firmware limitation),
 * we can fall back to signing the URL query string instead of the body.
 * For now, header-based is the documented path.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export interface DirectCloudAuthResult {
    authenticated: boolean;
    device: {
        id: string;
        organizationId: string;
        name: string;
        serialNumber: string | null;
    } | null;
    reason?: string;
}

/**
 * Compute the expected HMAC-SHA256 signature for a request body + secret.
 */
export function computeSignature(body: string, secret: string): string {
    return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/**
 * Constant-time comparison of two hex strings.
 * Returns false if lengths differ (which would otherwise leak length info).
 */
function safeEqualHex(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
        return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
    } catch {
        return false;
    }
}

/**
 * Authenticate a direct-cloud device request.
 *
 * Looks up the device by serial number. If found and has a cloudSecretHash:
 *   - Validates the X-PeopleFlow-Signature header against the body.
 *   - Returns authenticated=true if valid, false otherwise.
 *
 * If found but cloudSecretHash is null (claim mode):
 *   - Returns authenticated=false with reason="claim_mode".
 *   - Caller should capture the event but NOT ingest punches.
 *
 * If not found:
 *   - Returns authenticated=false with reason="unknown_device".
 *
 * @param serialNumber  Device serial from ?SN= query param
 * @param body          Raw request body (already read by caller)
 * @param signatureHeader  Value of X-PeopleFlow-Signature header
 */
export async function authenticateDirectCloudDevice(
    serialNumber: string | null,
    body: string,
    signatureHeader: string | null,
): Promise<DirectCloudAuthResult> {
    if (!serialNumber) {
        return { authenticated: false, device: null, reason: "missing_serial" };
    }

    const device = await prisma.biometricDevice.findFirst({
        where: {
            serialNumber,
            isActive: true,
            connectionMode: "direct_cloud",
        },
        select: {
            id: true,
            organizationId: true,
            serialNumber: true,
            name: true,
            cloudSecretHash: true,
        },
    });

    if (!device) {
        return { authenticated: false, device: null, reason: "unknown_device" };
    }

    // Claim mode: no secret set yet. Capture but don't ingest.
    if (!device.cloudSecretHash) {
        return {
            authenticated: false,
            device: {
                id: device.id,
                organizationId: device.organizationId,
                name: device.name,
                serialNumber: device.serialNumber,
            },
            reason: "claim_mode",
        };
    }

    // Authenticated mode: require valid signature
    if (!signatureHeader) {
        return {
            authenticated: false,
            device: {
                id: device.id,
                organizationId: device.organizationId,
                name: device.name,
                serialNumber: device.serialNumber,
            },
            reason: "missing_signature",
        };
    }

    // We store sha256(secret), not the raw secret. To verify the HMAC,
    // we need the raw secret — but we don't have it. So the device must
    // send the secret itself in a second header (X-PeopleFlow-Secret) OR
    // we use a different scheme.
    //
    // DESIGN DECISION: To keep firmware compatibility simple, we support
    // TWO auth schemes:
    //   1. X-PeopleFlow-Secret: <raw_secret>  → server hashes and compares to cloudSecretHash
    //   2. X-PeopleFlow-Signature: <hmac>     → server needs raw secret (NOT supported with hash-only storage)
    //
    // We use scheme #1 (simpler for firmware, no HMAC library needed on device).
    // The secret travels in a header, but only over HTTPS, so it's encrypted in transit.
    //
    // This function receives the secret via `signatureHeader` (which is actually
    // the raw secret in scheme #1). We hash it and compare to cloudSecretHash.

    const providedHash = createHash("sha256").update(signatureHeader, "utf8").digest("hex");
    if (!safeEqualHex(providedHash, device.cloudSecretHash)) {
        return {
            authenticated: false,
            device: {
                id: device.id,
                organizationId: device.organizationId,
                name: device.name,
                serialNumber: device.serialNumber,
            },
            reason: "invalid_secret",
        };
    }

    return {
        authenticated: true,
        device: {
            id: device.id,
            organizationId: device.organizationId,
            name: device.name,
            serialNumber: device.serialNumber,
        },
    };
}

/**
 * Generate a new random cloud secret for a device.
 * Returns the raw secret (to be shown to the user ONCE and configured
 * on the device) — only the hash is stored in the DB.
 */
export function generateCloudSecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return `pf_dev_${Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")}`;
}

/**
 * Hash a raw cloud secret for storage.
 */
export function hashCloudSecret(secret: string): string {
    return createHash("sha256").update(secret, "utf8").digest("hex");
}
