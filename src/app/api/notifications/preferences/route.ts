import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import * as z from "zod";

/**
 * GET /api/notifications/preferences — Get current user's notification preferences
 *
 * Creates default preferences if none exist (lazy init).
 */
export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        let prefs = await auth.withDB((db) => db.notificationPreference.findUnique({
            where: { userId: ctx.userId },
        }));

        // Lazy-init with defaults
        if (!prefs) {
            prefs = await auth.withDB((db) => db.notificationPreference.create({
                data: { userId: ctx.userId },
            }));
        }

        return NextResponse.json(prefs);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_NOTIFICATION_PREFS_ERROR");
        return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
    }
}

const updatePrefsSchema = z.object({
    inAppEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    pushEnabled: z.boolean().optional(),
    digestMode: z.enum(["instant", "daily", "weekly"]).optional(),
    quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    categoryOverrides: z.record(z.string(), z.record(z.string(), z.boolean())).optional(),
});

/**
 * PATCH /api/notifications/preferences — Update notification preferences
 */
export async function PATCH(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = updatePrefsSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validation.error.issues.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        const data = validation.data;

        // Upsert (create if doesn't exist)
        const prefs = await auth.withDB((db) => db.notificationPreference.upsert({
            where: { userId: ctx.userId },
            create: {
                userId: ctx.userId,
                ...(data.inAppEnabled !== undefined && { inAppEnabled: data.inAppEnabled }),
                ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
                ...(data.pushEnabled !== undefined && { pushEnabled: data.pushEnabled }),
                ...(data.digestMode !== undefined && { digestMode: data.digestMode }),
                ...(data.quietHoursStart !== undefined && { quietHoursStart: data.quietHoursStart }),
                ...(data.quietHoursEnd !== undefined && { quietHoursEnd: data.quietHoursEnd }),
                ...(data.categoryOverrides !== undefined && {
                    categoryOverrides: data.categoryOverrides as object,
                }),
            },
            update: {
                ...(data.inAppEnabled !== undefined && { inAppEnabled: data.inAppEnabled }),
                ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
                ...(data.pushEnabled !== undefined && { pushEnabled: data.pushEnabled }),
                ...(data.digestMode !== undefined && { digestMode: data.digestMode }),
                ...(data.quietHoursStart !== undefined && { quietHoursStart: data.quietHoursStart }),
                ...(data.quietHoursEnd !== undefined && { quietHoursEnd: data.quietHoursEnd }),
                ...(data.categoryOverrides !== undefined && {
                    categoryOverrides: data.categoryOverrides as object,
                }),
            },
        }));

        return NextResponse.json({
            success: true,
            preferences: prefs,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_NOTIFICATION_PREFS_ERROR");
        return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
    }
}
