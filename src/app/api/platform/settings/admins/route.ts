/**
 * Platform API: Settings — list platform admins
 *
 * GET /api/platform/settings/admins
 *
 * Returns all platform admin accounts (excluding password hash).
 * Platform admin only.
 *
 * POST /api/platform/settings/admins
 * Body: { name, email, role, password }
 * Creates a new platform admin (super-admin only).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    verifyPlatformRequest,
    isPlatformVerified,
} from "@/lib/platform-token";
import { apiLogger } from "@/lib/logger";
import bcrypt from "bcryptjs";
import { z } from "zod";

const CreateAdminSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email().max(255),
    role: z.enum(["platform_admin", "platform_super"]).default("platform_admin"),
    password: z.string().min(8).max(128),
});

export async function GET(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    try {
        const admins = await prisma.platformAdmin.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                lastLogin: true,
                twoFactorEnabled: true,
                createdAt: true,
            },
            orderBy: { createdAt: "asc" },
        });

        return NextResponse.json({ admins });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_SETTINGS_ADMINS_LIST] Error:");
        return NextResponse.json(
            { error: "Failed to fetch platform admins" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    // Only platform_super can create new admins
    const adminId = auth.admin.id;

    const currentAdmin = await prisma.platformAdmin.findUnique({
        where: { id: adminId },
        select: { role: true },
    });

    if (currentAdmin?.role !== "platform_super") {
        return NextResponse.json(
            { error: "Only super admins can create new platform admin accounts" },
            { status: 403 }
        );
    }

    try {
        const body = await request.json();
        const parsed = CreateAdminSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "Invalid input", details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { name, email, role, password } = parsed.data;

        // Check email uniqueness
        const existing = await prisma.platformAdmin.findUnique({
            where: { email },
            select: { id: true },
        });
        if (existing) {
            return NextResponse.json(
                { error: "A platform admin with this email already exists" },
                { status: 409 }
            );
        }

        // Hash password (bcrypt with 12 rounds)
        const passwordHash = await bcrypt.hash(password, 12);

        const newAdmin = await prisma.platformAdmin.create({
            data: {
                name,
                email,
                role,
                password: passwordHash,
                isActive: true,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        // Audit log the creation
        await prisma.platformAuditLog.create({
            data: {
                action: "platform_admin.create",
                targetType: "platform_admin",
                targetId: newAdmin.id,
                platformAdminId: adminId,
                metadata: {
                    name: newAdmin.name,
                    email: newAdmin.email,
                    role: newAdmin.role,
                },
            },
        });

        apiLogger.info(
            { newAdminId: newAdmin.id, createdBy: adminId },
            "[PLATFORM_SETTINGS_ADMIN_CREATED]"
        );

        return NextResponse.json({ admin: newAdmin }, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "[PLATFORM_SETTINGS_ADMINS_CREATE] Error:");
        return NextResponse.json(
            { error: "Failed to create platform admin" },
            { status: 500 }
        );
    }
}
