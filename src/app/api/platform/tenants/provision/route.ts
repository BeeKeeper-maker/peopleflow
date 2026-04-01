/**
 * Platform API: Tenant Provisioning
 *
 * POST /api/platform/tenants/provision
 *
 * Creates a new tenant organization with all defaults in a single transaction.
 * Platform admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    requirePlatformAuth,
    isPlatformAuthenticated,
    logPlatformAction,
} from "@/lib/platform-auth";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";

export async function POST(request: NextRequest) {
    // Require platform admin
    const auth = await requirePlatformAuth();
    if (!isPlatformAuthenticated(auth)) return auth;

    try {
        const body = await request.json();
        const {
            companyName,
            adminEmail,
            adminName,
            planSlug = "starter",
            trialDays = 14,
            countryCode = "BD",
            currencyCode = "BDT",
        } = body;

        // Validation
        if (!companyName || !adminEmail || !adminName) {
            return NextResponse.json(
                {
                    error: "companyName, adminEmail, and adminName are required",
                },
                { status: 400 }
            );
        }

        // Check email uniqueness
        const existingUser = await prisma.user.findUnique({
            where: { email: adminEmail },
        });
        if (existingUser) {
            return NextResponse.json(
                { error: "A user with this email already exists" },
                { status: 409 }
            );
        }

        // Get plan
        const plan = await prisma.plan.findUnique({
            where: { slug: planSlug },
        });
        if (!plan) {
            return NextResponse.json(
                { error: `Plan '${planSlug}' not found` },
                { status: 400 }
            );
        }

        // Generate temp password
        const tempPassword = crypto.randomBytes(12).toString("base64url");
        const hashedPassword = await hashPassword(tempPassword);

        // Generate unique slug
        const baseSlug = companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
        const uniqueSuffix = crypto.randomBytes(3).toString("hex");
        const slug = `${baseSlug}-${uniqueSuffix}`;

        // Trial period
        const now = new Date();
        const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

        // Single transaction: create everything or nothing
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Organization
            const org = await tx.organization.create({
                data: {
                    name: companyName,
                    slug,
                    countryCode,
                    currencyCode,
                    status: "active",
                    onboardedAt: now,
                    trialEndsAt: trialEnd,
                    settings: {
                        payrollDay: 25,
                        weeklyOffDays: ["Friday", "Saturday"],
                        dateFormat: "DD/MM/YYYY",
                    },
                },
            });

            // 2. Create Admin User
            const user = await tx.user.create({
                data: {
                    email: adminEmail,
                    name: adminName,
                    password: hashedPassword,
                    role: "admin",
                    isActive: true,
                    emailVerified: now, // Auto-verified for provisioned tenants
                    organizationId: org.id,
                },
            });

            // 3. Create Subscription
            const subscription = await tx.subscription.create({
                data: {
                    status: "trialing",
                    billingCycle: "monthly",
                    currentPeriodStart: now,
                    currentPeriodEnd: trialEnd,
                    trialStart: now,
                    trialEnd: trialEnd,
                    organizationId: org.id,
                    planId: plan.id,
                },
            });

            // 4. Create Default Leave Types
            await tx.leaveType.createMany({
                data: [
                    {
                        name: "Annual Leave",
                        nameBn: "বার্ষিক ছুটি",
                        code: "AL",
                        color: "#3B82F6",
                        annualAllocation: 10,
                        maxAccumulation: 30,
                        carryForwardLimit: 5,
                        encashmentAllowed: true,
                        organizationId: org.id,
                    },
                    {
                        name: "Sick Leave",
                        nameBn: "অসুস্থতাজনিত ছুটি",
                        code: "SL",
                        color: "#EF4444",
                        annualAllocation: 14,
                        requiresDocument: true,
                        organizationId: org.id,
                    },
                    {
                        name: "Casual Leave",
                        nameBn: "নৈমিত্তিক ছুটি",
                        code: "CL",
                        color: "#F59E0B",
                        annualAllocation: 10,
                        organizationId: org.id,
                    },
                ],
            });

            // 5. Create Default Shift
            await tx.shift.create({
                data: {
                    name: "General Shift",
                    nameBn: "সাধারণ শিফট",
                    code: "GEN",
                    startTime: "09:00",
                    endTime: "18:00",
                    breakDuration: 60,
                    graceMinutes: 15,
                    isDefault: true,
                    organizationId: org.id,
                },
            });

            // 6. Create Default Expense Categories
            await tx.expenseCategory.createMany({
                data: [
                    {
                        name: "Travel",
                        nameBn: "ভ্রমণ",
                        requiresReceipt: true,
                        organizationId: org.id,
                    },
                    {
                        name: "Meals",
                        nameBn: "খাবার",
                        requiresReceipt: true,
                        monthlyLimit: 5000,
                        organizationId: org.id,
                    },
                    {
                        name: "Office Supplies",
                        nameBn: "অফিস সরবরাহ",
                        requiresReceipt: true,
                        organizationId: org.id,
                    },
                ],
            });

            return { org, user, subscription };
        });

        // Audit log (outside transaction — audit failure shouldn't block provisioning)
        await logPlatformAction({
            adminId: auth.adminId,
            action: "tenant.provision",
            targetType: "organization",
            targetId: result.org.id,
            metadata: {
                companyName,
                adminEmail,
                planSlug,
                trialDays,
                trialEndsAt: trialEnd.toISOString(),
            },
            ipAddress: request.headers.get("x-forwarded-for") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
        });

        // TODO: Send welcome email with temp password
        // await sendTemplateEmail(adminEmail, "welcomeEmployee", {
        //   employeeName: adminName,
        //   loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
        //   tempPassword,
        // });

        return NextResponse.json(
            {
                success: true,
                organization: {
                    id: result.org.id,
                    name: result.org.name,
                    slug: result.org.slug,
                },
                admin: {
                    id: result.user.id,
                    email: result.user.email,
                    tempPassword, // Only returned once, for the platform admin to share
                },
                subscription: {
                    id: result.subscription.id,
                    status: result.subscription.status,
                    planSlug,
                    trialEndsAt: trialEnd.toISOString(),
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[TENANT_PROVISION] Error:", error);
        return NextResponse.json(
            { error: "Failed to provision tenant" },
            { status: 500 }
        );
    }
}
