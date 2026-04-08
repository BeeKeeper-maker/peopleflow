/**
 * Lead Capture API — /api/leads
 *
 * High-converting B2B lead funnel endpoint.
 * - Zod validated
 * - Rate-limited (5 req/IP/hour)
 * - Persists to SalesLead table
 * - Fires sales.lead_captured → BullMQ for instant sales notification
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { emit } from "@/lib/event-bus";

// ── Validation Schema ────────────────────────────────────────
const leadSchema = z.object({
    name: z.string().min(2, "Name is required").max(100),
    email: z.email("Please enter a valid email address"),
    phone: z.string().max(20).optional(),
    companyName: z.string().min(1, "Company name is required").max(200),
    companySize: z.enum(["1-50", "51-200", "201-500", "500+"]),
    sector: z.enum(["rmg", "corporate", "ngo", "other"]),
    message: z.string().max(1000).optional(),
    source: z.string().max(50).optional(),
    utmSource: z.string().max(100).optional(),
    utmMedium: z.string().max(100).optional(),
    utmCampaign: z.string().max(100).optional(),
});

// ── Simple In-Memory Rate Limiter ────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return false;
    }

    if (entry.count >= RATE_LIMIT) {
        return true;
    }

    entry.count++;
    return false;
}

// ── POST Handler ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        // Rate limit check
        const ip =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") ||
            "unknown";

        if (isRateLimited(ip)) {
            return NextResponse.json(
                { error: "Too many requests. Please try again later." },
                { status: 429 }
            );
        }

        // Parse & validate
        const body = await request.json();
        const result = leadSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: result.error.issues.map((i: z.core.$ZodIssue) => ({
                        field: i.path.join("."),
                        message: i.message,
                    })),
                },
                { status: 400 }
            );
        }

        const data = result.data;

        // Attempt DB save — gracefully handle if SalesLead table hasn't migrated yet
        let leadId = "pending";
        try {
            // Check for duplicate (same email within last 24h)
            const recentLead = await prisma.salesLead.findFirst({
                where: {
                    email: data.email,
                    createdAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            });

            if (recentLead) {
                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Thank you! We already have your request and our team will reach out within 24 hours.",
                    },
                    { status: 200 }
                );
            }

            const lead = await prisma.salesLead.create({
                data: {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    companyName: data.companyName,
                    companySize: data.companySize,
                    sector: data.sector,
                    message: data.message,
                    source: data.source || "website",
                    utmSource: data.utmSource,
                    utmMedium: data.utmMedium,
                    utmCampaign: data.utmCampaign,
                },
            });
            leadId = lead.id;
        } catch (dbError) {
            // Table may not exist yet — log and continue so the user gets a success response
            console.error("[Lead DB Save Failed — migration pending?]", dbError);
        }

        // Fire-and-forget → BullMQ (never block the response)
        emit("sales.lead_captured", {
            leadId,
            name: data.name,
            email: data.email,
            phone: data.phone ?? undefined,
            companyName: data.companyName,
            companySize: data.companySize,
            sector: data.sector,
            source: data.source || "website",
            message: data.message ?? undefined,
        }).catch((err) => console.error("[Lead Event Emit Failed]", err));

        return NextResponse.json(
            {
                success: true,
                message:
                    "Thank you for your interest! Our enterprise team will contact you within 2 business hours.",
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("[Lead Capture Error]", error);
        return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}
