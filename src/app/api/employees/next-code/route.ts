import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

/**
 * GET /api/employees/next-code
 * Auto-generates the next available employee code for the organization.
 * Pattern: EMP-001, EMP-002, ... or continues from the last used pattern.
 */
export async function GET() {
  const auth = await requireAdminOrHR();
  if (!isAuthenticated(auth)) return auth;

  try {
    const lastEmployee = await auth.withDB((db) =>
      db.employee.findFirst({
        where: { organizationId: auth.organizationId },
        orderBy: { createdAt: "desc" },
        select: { employeeCode: true },
      }),
    );

    let nextCode: string;

    if (lastEmployee?.employeeCode) {
      // Extract prefix + numeric suffix (e.g. "EMP-001" → ["EMP-", "001"])
      const match = lastEmployee.employeeCode.match(/^([A-Za-z-]*)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const numPart = parseInt(match[2], 10) + 1;
        const padded = numPart.toString().padStart(match[2].length, "0");
        nextCode = `${prefix}${padded}`;
      } else {
        nextCode = "EMP-001";
      }
    } else {
      nextCode = "EMP-001";
    }

    // Handle collision
    const exists = await auth.withDB((db) =>
      db.employee.findFirst({
        where: { organizationId: auth.organizationId, employeeCode: nextCode },
      }),
    );

    if (exists) {
      // Count total employees and use that + 1
      const count = await auth.withDB((db) =>
        db.employee.count({
          where: { organizationId: auth.organizationId },
        }),
      );
      nextCode = `EMP-${(count + 1).toString().padStart(3, "0")}`;
    }

    return NextResponse.json({ code: nextCode });
  } catch (error) {
    apiLogger.error({ err: error }, "NEXT_CODE_ERROR");
    return NextResponse.json(
      { error: "Failed to generate code" },
      { status: 500 },
    );
  }
}
