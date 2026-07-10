import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { biometricLogger } from "@/lib/logger";
import { generateCloudSecret, hashCloudSecret } from "@/lib/biometric/direct-cloud-auth";
import { createAuditLog } from "@/lib/audit-log";

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * POST /api/biometric-devices/[id]/cloud-secret — Generate or rotate the
 * per-device shared secret used for direct-cloud (ADMS/iClock) authentication.
 *
 * Body:
 *   { "action": "generate" | "revoke" }   // default: "generate"
 *
 * Returns (on generate):
 *   {
 *     "cloudSecret": "pf_dev_...",   // RAW secret — shown ONCE, configure on device
 *     "message": "Save this secret. It will not be shown again."
 *   }
 *
 * The raw secret is NEVER stored. Only its SHA-256 hash is persisted in
 * BiometricDevice.cloudSecretHash. If the secret is lost, the admin must
 * regenerate it (which invalidates the old secret).
 *
 * Authorization: admin / hr_admin / super_admin only.
 *
 * After generating, the admin must configure the device firmware to send:
 *   X-PeopleFlow-Secret: <raw_secret>
 *
 * on every push to /iclock/cdata (and other /iclock/* endpoints).
 */
export async function POST(req: Request, { params }: RouteParams) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return NextResponse.json(
            { error: "Forbidden", code: "ACCESS_DENIED" },
            { status: 403 },
        );
    }

    try {
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const action = body?.action === "revoke" ? "revoke" : "generate";

        // Verify device belongs to org
        const device = await auth.withDB((db) => db.biometricDevice.findFirst({
            where: { id, organizationId: auth.organizationId },
            select: {
                id: true,
                name: true,
                connectionMode: true,
                serialNumber: true,
                cloudSecretHash: true,
            },
        }));

        if (!device) {
            return NextResponse.json(
                { error: "Device not found", code: "NOT_FOUND" },
                { status: 404 },
            );
        }

        if (device.connectionMode !== "direct_cloud") {
            return NextResponse.json(
                {
                    error:
                        "Cloud secrets are only used for direct_cloud devices. This device is in sync_agent mode.",
                    code: "WRONG_MODE",
                },
                { status: 400 },
            );
        }

        if (action === "revoke") {
            await auth.withDB((db) => db.biometricDevice.update({
                where: { id },
                data: { cloudSecretHash: null, cloudStatus: "pending" },
            }));

            await createAuditLog({
                organizationId: auth.organizationId,
                action: "update",
                entityType: "BiometricDevice",
                entityId: id,
                oldValues: { cloudSecretSet: !!device.cloudSecretHash },
                newValues: { cloudSecretSet: false },
                userId: auth.userId,
                ipAddress: req.headers.get("x-forwarded-for") || undefined,
                userAgent: req.headers.get("user-agent") || undefined,
            }).catch((err) => {
                biometricLogger.error({ err, deviceId: id }, "Failed to write audit log for cloud secret revoke");
            });

            return NextResponse.json({
                success: true,
                message: "Cloud secret revoked. The device is now in claim mode — punches will be captured but NOT ingested until a new secret is generated.",
            });
        }

        // Generate a new secret
        const rawSecret = generateCloudSecret();
        const secretHash = hashCloudSecret(rawSecret);

        await auth.withDB((db) => db.biometricDevice.update({
            where: { id },
            data: { cloudSecretHash: secretHash, cloudStatus: "pending" },
        }));

        await createAuditLog({
            organizationId: auth.organizationId,
            action: "update",
            entityType: "BiometricDevice",
            entityId: id,
            oldValues: { cloudSecretSet: !!device.cloudSecretHash },
            newValues: { cloudSecretSet: true, rotated: !!device.cloudSecretHash },
            userId: auth.userId,
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined,
        }).catch((err) => {
            biometricLogger.error({ err, deviceId: id }, "Failed to write audit log for cloud secret generation");
        });

        biometricLogger.info(
            { deviceId: id, rotated: !!device.cloudSecretHash, actorUserId: auth.userId },
            "Cloud secret generated for direct-cloud device",
        );

        return NextResponse.json({
            success: true,
            cloudSecret: rawSecret,
            message: device.cloudSecretHash
                ? "Cloud secret rotated. Update the device firmware with this new secret. The old secret is no longer valid."
                : "Cloud secret generated. Configure the device firmware to send this secret in the X-PeopleFlow-Secret header on every push to /iclock/*. This secret will NOT be shown again — save it now.",
            deviceId: id,
            deviceName: device.name,
        });
    } catch (error) {
        biometricLogger.error({ err: error }, "GENERATE_CLOUD_SECRET_ERROR");
        return NextResponse.json(
            { error: "Internal server error", code: "INTERNAL_ERROR" },
            { status: 500 },
        );
    }
}
