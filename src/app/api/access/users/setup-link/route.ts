import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { sendTemplateEmail } from "@/lib/email";
import { apiLogger } from "@/lib/logger";

const setupLinkSchema = z.object({
  userId: z.string().min(1),
});

function isAdminRole(role: string) {
  return ["super_admin", "admin"].includes(role);
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!isAuthenticated(auth)) return auth;

  if (!isAdminRole(auth.role)) {
    return NextResponse.json(
      { error: "Only organization admins can send account setup links" },
      { status: 403 },
    );
  }

  try {
    const body = setupLinkSchema.parse(await req.json());

    const target = await auth.withDB((db) =>
      db.user.findFirst({
        where: {
          id: body.userId,
          organizationId: auth.organizationId,
        },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          emailVerified: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employmentStatus: true,
              deletedAt: true,
            },
          },
        },
      }),
    );

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!target.email) {
      return NextResponse.json({ error: "User has no email address" }, { status: 400 });
    }

    if (!target.isActive || target.employee?.employmentStatus !== "active" || target.employee?.deletedAt) {
      return NextResponse.json(
        { error: "Only active employee accounts can receive setup links" },
        { status: 400 },
      );
    }

    if (target.emailVerified) {
      return NextResponse.json(
        { error: "This account is already activated. Use password reset if the user cannot sign in." },
        { status: 409 },
      );
    }

    const token = randomBytes(32).toString("hex");
    await auth.withDB(async (db) => {
      await db.passwordResetToken.deleteMany({
        where: {
          email: target.email,
          used: false,
          purpose: { in: ["employee_invitation", "employee_reactivation"] },
        },
      });
      await db.passwordResetToken.create({
        data: {
          email: target.email,
          token,
          purpose: "employee_invitation",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        },
      });
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const setupUrl = `${appUrl}/set-password/${token}`;
    const userName = target.employee
      ? `${target.employee.firstName} ${target.employee.lastName}`.trim()
      : target.name || target.email;

    const emailResult = await sendTemplateEmail(target.email, "employeeInvitation", {
      userName,
      setupUrl,
      expiresIn: "24 hours",
    });

    if (!emailResult.success) {
      apiLogger.error(
        { userId: target.id, email: target.email, error: emailResult.error },
        "ACCESS_SETUP_LINK_EMAIL_FAILED",
      );
      return NextResponse.json(
        { error: "Setup link was created, but email delivery failed. Check SMTP/email settings before retrying.", details: emailResult.error },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Account setup link sent",
      email: target.email,
      expiresIn: "24 hours",
      // Returned to organization admins for assisted onboarding/QA.
      // The token remains one-time-use, expires in 24 hours, and older setup
      // tokens for the same account are invalidated above.
      setupUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    apiLogger.error({ err: error }, "ACCESS_SETUP_LINK_POST_ERROR");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
