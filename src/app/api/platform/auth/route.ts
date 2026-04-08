/**
 * Platform API: Platform Admin Auth
 *
 * POST /api/platform/auth/login — Login
 * GET /api/platform/auth/me — Get current admin profile
 *
 * This is a standalone auth system, completely separate from tenant auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";
import { sign, verify } from "jsonwebtoken";
import { apiLogger } from "@/lib/logger";

const PLATFORM_JWT_SECRET =
    process.env.PLATFORM_JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "platform-secret-change-me";

const TOKEN_EXPIRY = "8h";

/**
 * POST: Platform admin login
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        // Find platform admin
        const admin = await prisma.platformAdmin.findUnique({
            where: { email: email.toLowerCase().trim() },
        });

        if (!admin || !admin.isActive) {
            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Verify password
        const isValid = await compare(password, admin.password);
        if (!isValid) {
            return NextResponse.json(
                { error: "Invalid credentials" },
                { status: 401 }
            );
        }

        // Generate JWT
        const token = sign(
            {
                id: admin.id,
                email: admin.email,
                name: admin.name,
                role: admin.role,
                isPlatform: true,
            },
            PLATFORM_JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
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
        return NextResponse.json(
            { error: "Login failed" },
            { status: 500 }
        );
    }
}

/**
 * GET: Get current platform admin profile
 */
export async function GET(request: NextRequest) {
    try {
        const token =
            request.cookies.get("pf-platform-token")?.value ||
            request.headers
                .get("authorization")
                ?.replace("Bearer ", "");

        if (!token) {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            );
        }

        const decoded = verify(token, PLATFORM_JWT_SECRET) as {
            id: string;
            isPlatform: boolean;
        };

        if (!decoded.isPlatform) {
            return NextResponse.json(
                { error: "Invalid token type" },
                { status: 401 }
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
            },
        });

        if (!admin || !admin.isActive) {
            return NextResponse.json(
                { error: "Account not found or disabled" },
                { status: 401 }
            );
        }

        return NextResponse.json({ admin });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_AUTH_ME] Error:");
        return NextResponse.json(
            { error: "Authentication failed" },
            { status: 401 }
        );
    }
}
