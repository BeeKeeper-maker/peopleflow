/**
 * External API v1: Organization Info
 *
 * GET /api/v1/organization — Get organization details and summary stats
 *
 * Authenticated via API key. Returns the key's organization data.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey, hasPermission } from "@/lib/api-key-auth";

export async function GET(request: NextRequest) {
    const auth = await authenticateApiKey(request);
    if (!auth.valid) return auth.response;

    if (!hasPermission(auth, "organization:read")) {
        return NextResponse.json(
            {
                error: "Insufficient permissions",
                required: "organization:read",
            },
            { status: 403 }
        );
    }

    try {
        const org = await prisma.organization.findUnique({
            where: { id: auth.organizationId },
            include: {
                _count: {
                    select: {
                        employees: true,
                        users: true,
                        branches: true,
                        departments: true,
                    },
                },
                subscription: {
                    select: {
                        status: true,
                        billingCycle: true,
                        currentPeriodEnd: true,
                        plan: {
                            select: {
                                name: true,
                                slug: true,
                                maxEmployees: true,
                            },
                        },
                    },
                },
            },
        });

        if (!org) {
            return NextResponse.json(
                { error: "Organization not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            data: {
                id: org.id,
                name: org.name,
                slug: org.slug,
                status: org.status,
                countryCode: org.countryCode,
                currencyCode: org.currencyCode,
                createdAt: org.createdAt,
                counts: org._count,
                subscription: org.subscription
                    ? {
                          status: org.subscription.status,
                          billingCycle: org.subscription.billingCycle,
                          currentPeriodEnd:
                              org.subscription.currentPeriodEnd,
                          plan: org.subscription.plan,
                      }
                    : null,
            },
            apiKey: {
                name: auth.keyName,
                permissions: auth.permissions,
            },
        });
    } catch (error) {
        console.error("[API_V1_ORG] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
