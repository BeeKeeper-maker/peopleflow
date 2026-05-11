import { NextResponse } from "next/server";
import { withPlatform } from "@/lib/prisma";
import { authLogger } from "@/lib/logger";
import {
  checkRateLimit,
  rateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 },
      );
    }

    const verificationToken = await withPlatform((db) =>
      db.emailVerificationToken.findUnique({
        where: { token },
      }),
    );

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid verification link" },
        { status: 400 },
      );
    }

    if (new Date() > verificationToken.expiresAt) {
      await withPlatform((db) =>
        db.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        }),
      );
      return NextResponse.json(
        { error: "Verification link has expired. Please request a new one." },
        { status: 400 },
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    authLogger.error(
      { err: error },
      "Email verification token validation error:",
    );
    return NextResponse.json(
      { error: "An error occurred during verification" },
      { status: 500 },
    );
  }
}

/**
 * POST — Resend verification email
 */
export async function POST(request: Request) {
  try {
    // Protect the free email quota from accidental resend loops and abuse.
    const ipLimit = await rateLimit(
      request,
      RATE_LIMIT_CONFIGS.sensitive,
      "auth/verify-email/resend",
    );
    if (!ipLimit.allowed) return ipLimit.response!;

    const body = await request.json();

    if (body.token) {
      const verificationToken = await withPlatform((db) =>
        db.emailVerificationToken.findUnique({
          where: { token: body.token },
        }),
      );

      if (!verificationToken) {
        return NextResponse.json(
          { error: "Invalid verification link" },
          { status: 400 },
        );
      }

      if (new Date() > verificationToken.expiresAt) {
        await withPlatform((db) =>
          db.emailVerificationToken.delete({
            where: { id: verificationToken.id },
          }),
        );
        return NextResponse.json(
          { error: "Verification link has expired. Please request a new one." },
          { status: 400 },
        );
      }

      const user = await withPlatform((db) =>
        db.user.findUnique({
          where: { email: verificationToken.email },
        }),
      );

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (user.emailVerified) {
        await withPlatform((db) =>
          db.emailVerificationToken.delete({
            where: { id: verificationToken.id },
          }),
        );
        return NextResponse.json(
          { message: "Email is already verified", alreadyVerified: true },
          { status: 200 },
        );
      }

      await withPlatform(async (db) => {
        await db.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
        await db.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        });
      });

      return NextResponse.json(
        { message: "Email verified successfully! You can now log in." },
        { status: 200 },
      );
    }

    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await withPlatform((db) =>
      db.user.findUnique({
        where: { email: normalizedEmail },
      }),
    );

    // Don't reveal if user exists
    const successResponse = NextResponse.json(
      {
        message:
          "If an unverified account exists with this email, a verification link has been sent.",
      },
      { status: 200 },
    );

    if (!user || user.emailVerified) {
      return successResponse;
    }

    // Per-address resend cooldown: never burn credits for repeated clicks.
    const latestToken = await withPlatform((db) =>
      db.emailVerificationToken.findFirst({
        where: { email: normalizedEmail },
        orderBy: { createdAt: "desc" },
      }),
    );

    const resendCooldownMs = 10 * 60 * 1000;
    if (
      latestToken &&
      Date.now() - latestToken.createdAt.getTime() < resendCooldownMs
    ) {
      authLogger.info(
        { email: normalizedEmail },
        "Verification resend skipped: cooldown active",
      );
      return successResponse;
    }

    // Daily caps for the free Brevo phase. This keeps PeopleFlow below the
    // 300/day provider limit while preserving room for critical system emails.
    const dayKey = new Date().toISOString().slice(0, 10);
    const globalEmailLimit = await checkRateLimit(
      `email:verify:global:${dayKey}`,
      {
        windowMs: 24 * 60 * 60 * 1000,
        maxRequests: Number.parseInt(
          process.env.EMAIL_VERIFY_GLOBAL_DAILY_LIMIT || "250",
          10,
        ),
      },
    );
    const addressEmailLimit = await checkRateLimit(
      `email:verify:address:${normalizedEmail}:${dayKey}`,
      {
        windowMs: 24 * 60 * 60 * 1000,
        maxRequests: Number.parseInt(
          process.env.EMAIL_VERIFY_ADDRESS_DAILY_LIMIT || "3",
          10,
        ),
      },
    );

    if (!globalEmailLimit.allowed || !addressEmailLimit.allowed) {
      authLogger.warn(
        {
          email: normalizedEmail,
          globalAllowed: globalEmailLimit.allowed,
          addressAllowed: addressEmailLimit.allowed,
        },
        "Verification resend skipped: daily email quota reached",
      );
      return successResponse;
    }

    // Delete old tokens only after all send guards pass.
    await withPlatform((db) =>
      db.emailVerificationToken.deleteMany({
        where: { email: normalizedEmail },
      }),
    );

    // Generate new token (24 hour expiry)
    const crypto = await import("crypto");
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await withPlatform((db) =>
      db.emailVerificationToken.create({
        data: {
          token,
          email: normalizedEmail,
          expiresAt,
        },
      }),
    );

    // Send email
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

    const { sendTemplateEmail } = await import("@/lib/email");
    sendTemplateEmail(normalizedEmail, "verifyEmail", {
      userName: user.name || "User",
      verifyUrl,
    }).catch((err) =>
      authLogger.error({ err: err }, "Failed to send verification email:"),
    );

    return successResponse;
  } catch (error) {
    authLogger.error({ err: error }, "Resend verification error:");
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 },
    );
  }
}
