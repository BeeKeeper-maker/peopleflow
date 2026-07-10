import { NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { z } from "zod";
import { successResponse, errorResponse, ErrorCodes } from "@/lib/api-response";
import { apiLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS, applyRateLimitHeaders } from "@/lib/rate-limit";

const shiftSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid logic format (HH:mm)"),
  endTime: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid logic format (HH:mm)"),
  breakDuration: z.number().min(0).default(60),
  graceMinutes: z.number().min(0).default(15),
  halfDayHours: z.number().min(0).default(4),
  fullDayHours: z.number().min(0).default(8),
  isDefault: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    // Require HR admin role for creating shifts
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) {
      return auth;
    }

    // Per-user rate limit (write op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.write, auth.userId);
    if (!rl.allowed) return rl.response!;

    const json = await req.json();
    const body = shiftSchema.parse(json);

    // If setting as default, unset others
    if (body.isDefault) {
      await auth.withDB((db) =>
        db.shift.updateMany({
          where: { organizationId: auth.organizationId, isDefault: true },
          data: { isDefault: false },
        }),
      );
    }

    const shift = await auth.withDB((db) =>
      db.shift.create({
        data: {
          ...body,
          organizationId: auth.organizationId,
        },
      }),
    );

    return NextResponse.json(shift);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse(JSON.stringify(error.issues), { status: 422 });
    }
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    apiLogger.error({ err: error, errorId }, "CREATE_SHIFT_ERROR");
    return NextResponse.json(
        { error: "Internal server error", errorId },
        { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!isAuthenticated(auth)) return auth;

  // Per-user rate limit (read op)
  const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, auth.userId);
  if (!rl.allowed) return rl.response!;

  try {
    const shifts = await auth.withDB((db) =>
      db.shift.findMany({
        where: { organizationId: auth.organizationId, isActive: true },
        orderBy: { createdAt: "desc" },
      }),
    );

    return applyRateLimitHeaders(successResponse(shifts), rl.headers);
  } catch (error) {
    apiLogger.error({ err: error }, "GET_SHIFTS_ERROR");
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to fetch shifts");
  }
}
