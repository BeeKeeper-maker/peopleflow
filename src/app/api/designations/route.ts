import { NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS, applyRateLimitHeaders } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!isAuthenticated(auth)) return auth;

  // Per-user rate limit (read op)
  const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, auth.userId);
  if (!rl.allowed) return rl.response!;

  try {
    const { searchParams } = new URL(req.url);
    const fetchAll = searchParams.get("all") === "true";

    const where: Record<string, unknown> = {
      organizationId: auth.organizationId,
    };

    if (!fetchAll) {
      where.isActive = true;
    }

    const designations = await auth.withDB((db) =>
      db.designation.findMany({
        where,
        include: {
          _count: {
            select: { employees: true },
          },
        },
        orderBy: { name: "asc" },
      }),
    );

    return applyRateLimitHeaders(NextResponse.json(designations), rl.headers);
  } catch (error) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    apiLogger.error({ err: error, errorId }, "GET_DESIGNATIONS_ERROR");
    return NextResponse.json(
        { error: "Internal server error", errorId },
        { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Require HR admin role for creating designations
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) {
      return auth;
    }

    // Per-user rate limit (write op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.write, auth.userId);
    if (!rl.allowed) return rl.response!;

    const json = await req.json();
    const { name, code, ...rest } = json;

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    // Check uniqueness of code if provided
    if (code) {
      const existingCode = await auth.withDB((db) =>
        db.designation.findFirst({
          where: {
            organizationId: auth.organizationId,
            code,
          },
        }),
      );

      if (existingCode) {
        return new NextResponse("Designation code already exists", {
          status: 409,
        });
      }
    }

    const designation = await auth.withDB((db) =>
      db.designation.create({
        data: {
          name,
          code: code || null,
          organizationId: auth.organizationId,
          ...rest,
        },
      }),
    );

    return NextResponse.json(designation);
  } catch (error) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    apiLogger.error({ err: error, errorId }, "CREATE_DESIGNATION_ERROR");
    return NextResponse.json(
        { error: "Internal server error", errorId },
        { status: 500 }
    );
  }
}
