import { NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!isAuthenticated(auth)) return auth;

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

    return NextResponse.json(designations);
  } catch (error) {
    apiLogger.error({ err: error }, "GET_DESIGNATIONS_ERROR");
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Require HR admin role for creating designations
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) {
      return auth;
    }

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
    apiLogger.error({ err: error }, "CREATE_DESIGNATION_ERROR");
    return new NextResponse("Internal Error", { status: 500 });
  }
}
