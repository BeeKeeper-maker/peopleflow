import { NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { enforcePlanLimit, onResourceCreated } from "@/lib/plan-enforcement";
import { apiLogger } from "@/lib/logger";

// GET /api/branches — List all branches
export async function GET() {
  const auth = await requireAuth();
  if (!isAuthenticated(auth)) return auth;

  try {
    const branches = await auth.withDB((db) =>
      db.branch.findMany({
        where: { organizationId: auth.organizationId },
        include: {
          _count: {
            select: { employees: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    return NextResponse.json(branches);
  } catch (error) {
    apiLogger.error({ err: error }, "GET_BRANCHES_ERROR");
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// POST /api/branches — Create a new branch
export async function POST(req: Request) {
  const auth = await requireAdminOrHR();
  if (!isAuthenticated(auth)) return auth;

  try {
    const json = await req.json();
    const {
      name,
      code,
      address,
      city,
      phone,
      email,
      isHeadOffice,
      latitude,
      longitude,
      geoFenceRadius,
    } = json;

    if (!name) {
      return NextResponse.json(
        { error: "Branch name is required" },
        { status: 400 },
      );
    }

    const planCheck = await enforcePlanLimit(auth.organizationId, "branch");
    if (!planCheck.allowed) {
      return NextResponse.json(
        {
          error: planCheck.message,
          upgradeRequired: planCheck.upgradeRequired,
          current: planCheck.current,
          limit: planCheck.limit,
        },
        { status: 402 },
      );
    }

    // Check for duplicate code
    if (code) {
      const existing = await auth.withDB((db) =>
        db.branch.findUnique({
          where: {
            organizationId_code: {
              organizationId: auth.organizationId,
              code,
            },
          },
        }),
      );

      if (existing) {
        return NextResponse.json(
          { error: "A branch with this code already exists" },
          { status: 409 },
        );
      }
    }

    const branch = await auth.withDB((db) =>
      db.branch.create({
        data: {
          name,
          code: code || undefined,
          address: address || null,
          city: city || null,
          phone: phone || null,
          email: email || null,
          isHeadOffice: isHeadOffice || false,
          latitude: latitude != null ? parseFloat(latitude) : null,
          longitude: longitude != null ? parseFloat(longitude) : null,
          geoFenceRadius: geoFenceRadius ? parseInt(geoFenceRadius) : 200,
          organizationId: auth.organizationId,
        },
      }),
    );

    await onResourceCreated(auth.organizationId, "branch");

    return NextResponse.json(branch);
  } catch (error) {
    apiLogger.error({ err: error }, "CREATE_BRANCH_ERROR");
    return new NextResponse("Internal Error", { status: 500 });
  }
}
