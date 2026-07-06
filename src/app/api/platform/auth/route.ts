/**
 * Platform API: Platform Admin Auth
 *
 * POST /api/platform/auth — Login (with optional 2FA)
 * GET /api/platform/auth — Get current admin profile
 *
 * This is a standalone auth system, completely separate from tenant auth.
 * Phase 0.3: Added 2FA (TOTP) support.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { verify as verifyTOTP } from "otplib";
import { apiLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { getPlatformJwtSecret } from "@/lib/platform-token";

const TOKEN_EXPIRY = "8h";

/**
 * POST: Platform admin login (with 2FA support)
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: max 10 login attempts per 15 minutes per IP
    const rl = await rateLimit(
      request,
      RATE_LIMIT_CONFIGS.auth,
      "platform/auth/login",
    );
    if (!rl.allowed) return rl.response!;

    const body = await request.json();
    const { email, password, totpCode } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    // Find platform admin
    const admin = await prisma.platformAdmin.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // Verify password
    const isValid = await compare(password, admin.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    // ── 2FA Verification (Phase 0.3) ──
    if (admin.twoFactorEnabled && admin.twoFactorSecret) {
      if (!totpCode) {
        // Tell the client that 2FA is required
        return NextResponse.json(
          {
            error: "2FA code required",
            code: "TWO_FACTOR_REQUIRED",
            twoFactorRequired: true,
          },
          { status: 401 },
        );
      }

      try {
        const valid = verifyTOTP({
          token: totpCode,
          secret: admin.twoFactorSecret,
        });
        if (!valid) {
          return NextResponse.json(
            { error: "Invalid 2FA code", code: "INVALID_2FA" },
            { status: 401 },
          );
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid 2FA code", code: "INVALID_2FA" },
          { status: 401 },
        );
      }
    }

    // Generate JWT
    const token = sign(
      {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        isPlatform: true,
        twoFactorEnabled: admin.twoFactorEnabled,
      },
      getPlatformJwtSecret(),
      { expiresIn: TOKEN_EXPIRY },
    );

    // Update last login
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() },
    });

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        twoFactorEnabled: admin.twoFactorEnabled,
      },
      token, // Also return in body for API clients
    });

    response.cookies.set("pf-platform-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60, // 8 hours
      path: "/",
    });

    return response;
  } catch (error) {
    apiLogger.error({ err: error }, "[PLATFORM_LOGIN] Error:");
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

/**
 * GET: Get current platform admin profile
 */
export async function GET(request: NextRequest) {
  try {
    const token =
      request.cookies.get("pf-platform-token")?.value ||
      request.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = verify(token, getPlatformJwtSecret()) as {
      id: string;
      isPlatform: boolean;
    };

    if (!decoded.isPlatform) {
      return NextResponse.json(
        { error: "Invalid token type" },
        { status: 401 },
      );
    }

    const admin = await prisma.platformAdmin.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        twoFactorEnabled: true,
      },
    });

    if (!admin || !admin.isActive) {
      return NextResponse.json(
        { error: "Account not found or disabled" },
        { status: 401 },
      );
    }

    return NextResponse.json({ admin });
  } catch (error) {
    apiLogger.error({ err: error }, "[PLATFORM_AUTH_ME] Error:");
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 },
    );
  }
}
