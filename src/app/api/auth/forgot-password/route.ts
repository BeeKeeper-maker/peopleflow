import { NextResponse } from "next/server";
import { withPlatform } from "@/lib/prisma";
import { sendTemplateEmail } from "@/lib/email";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import crypto from "crypto";
import { authLogger } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    // Rate limit: max 5 requests per hour
    const rl = await rateLimit(
      request,
      RATE_LIMIT_CONFIGS.sensitive,
      "forgot-password",
    );
    if (!rl.allowed) return rl.response!;

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json(
      {
        message:
          "If an account exists with this email, a password reset link has been sent.",
      },
      { status: 200 },
    );

    // Find user (don't reveal if user exists)
    const user = await withPlatform((db) =>
      db.user.findUnique({
        where: { email: normalizedEmail },
      }),
    );

    if (!user) {
      return successResponse;
    }

    // Delete any existing tokens for this email
    await withPlatform((db) =>
      db.passwordResetToken.deleteMany({
        where: { email: normalizedEmail },
      }),
    );

    // Generate secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token
    await withPlatform((db) =>
      db.passwordResetToken.create({
        data: {
          token,
          email: normalizedEmail,
          expiresAt,
        },
      }),
    );

    // Build reset URL
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    // Send email (don't await in response — fire and forget with error logging)
    sendTemplateEmail(normalizedEmail, "passwordReset", {
      userName: user.name || "User",
      resetUrl,
    }).catch((err) => {
      authLogger.error({ err: err }, "Failed to send password reset email:");
    });

    return successResponse;
  } catch (error) {
    authLogger.error({ err: error }, "Forgot password error:");
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 },
    );
  }
}
