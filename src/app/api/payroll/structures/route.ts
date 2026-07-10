import { NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { z } from "zod";
import { successResponse, errorResponse, ErrorCodes } from "@/lib/api-response";
import { payrollLogger } from "@/lib/logger";

const structureSchema = z.object({
  name: z.string().min(1, "Name is required"),
  basicPercentage: z.number().min(0).max(100),
  houseRentPercent: z.number().min(0).max(100),
  medicalPercent: z.number().min(0).max(100),
  conveyanceFixed: z.number().min(0),
  pfEmployeePercent: z.number().min(0).max(100),
  pfEmployerPercent: z.number().min(0).max(100),
  description: z.string().optional(),
});

export async function GET() {
  // Authenticate first
  const auth = await requireAuth();
  if (!isAuthenticated(auth)) {
    return auth; // Returns 401 Unauthorized
  }

  try {
    const structures = await auth.withDB((db) =>
      db.salaryStructure.findMany({
        where: {
          organizationId: auth.organizationId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    return successResponse(structures);
  } catch (error) {
    payrollLogger.error({ err: error }, "SALARY_STRUCTURES_GET_ERROR");
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      "Failed to fetch salary structures",
    );
  }
}

export async function POST(req: Request) {
  // Require HR admin role for creating salary structures
  const auth = await requireAdminOrHR();
  if (!isAuthenticated(auth)) {
    return auth;
  }

  try {
    const body = await req.json();
    const validation = structureSchema.safeParse(body);

    if (!validation.success) {
      return new NextResponse(validation.error.issues[0].message, {
        status: 400,
      });
    }

    const {
      name,
      basicPercentage,
      houseRentPercent,
      medicalPercent,
      conveyanceFixed,
      pfEmployeePercent,
      pfEmployerPercent,
      description,
    } = validation.data;

    const structure = await auth.withDB((db) =>
      db.salaryStructure.create({
        data: {
          organizationId: auth.organizationId,
          name,
          basicPercentage,
          houseRentPercent,
          medicalPercent,
          conveyanceFixed,
          pfEmployeePercent,
          pfEmployerPercent,
          description,
        },
      }),
    );

    return NextResponse.json(structure);
  } catch (error) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    payrollLogger.error({ err: error, errorId }, "SALARY_STRUCTURES_POST_ERROR");
    return NextResponse.json(
        { error: "Internal server error", errorId },
        { status: 500 }
    );
  }
}
