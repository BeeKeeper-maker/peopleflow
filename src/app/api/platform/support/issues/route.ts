/**
 * Platform Support Issues API
 *
 * GET /api/platform/support/issues
 * POST /api/platform/support/issues
 * PATCH /api/platform/support/issues
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPlatformRequest, isPlatformVerified } from "@/lib/platform-token";
import { logPlatformAction } from "@/lib/platform-auth";

const categories = ["bug", "training", "feature_request", "billing", "device_sync", "data_issue", "other"] as const;
const priorities = ["low", "medium", "high", "urgent"] as const;
const statuses = ["open", "triaging", "in_progress", "waiting_on_client", "resolved", "closed"] as const;
const scopes = ["core_hrms", "tenant_customization", "paid_addon", "not_aligned", "unknown"] as const;
const sources = ["platform", "client_call", "whatsapp", "phone", "email", "system"] as const;

const createIssueSchema = z.object({
    organizationId: z.string().min(1),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(4000).optional().nullable(),
    category: z.enum(categories).default("bug"),
    priority: z.enum(priorities).default("medium"),
    status: z.enum(statuses).default("open"),
    scope: z.enum(scopes).default("core_hrms"),
    source: z.enum(sources).default("platform"),
    impact: z.string().trim().max(1000).optional().nullable(),
    nextAction: z.string().trim().max(1000).optional().nullable(),
    dueAt: z.string().datetime().optional().nullable(),
    assignedToId: z.string().optional().nullable(),
});

const updateIssueSchema = createIssueSchema.partial().extend({
    id: z.string().min(1),
    resolution: z.string().trim().max(2000).optional().nullable(),
});

function cleanText(value: string | null | undefined) {
    if (value === undefined) return undefined;
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function parseDate(value: string | null | undefined) {
    if (!value) return null;
    return new Date(value);
}

export async function GET(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || undefined;
    const status = searchParams.get("status") || undefined;
    const category = searchParams.get("category") || undefined;
    const priority = searchParams.get("priority") || undefined;
    const q = searchParams.get("q")?.trim() || undefined;
    const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

    try {
        const issues = await prisma.platformSupportIssue.findMany({
            where: {
                ...(tenantId ? { organizationId: tenantId } : {}),
                ...(status && status !== "all" ? { status } : {}),
                ...(category && category !== "all" ? { category } : {}),
                ...(priority && priority !== "all" ? { priority } : {}),
                ...(q
                    ? {
                          OR: [
                              { title: { contains: q, mode: "insensitive" } },
                              { description: { contains: q, mode: "insensitive" } },
                              { nextAction: { contains: q, mode: "insensitive" } },
                          ],
                      }
                    : {}),
            },
            include: {
                organization: { select: { id: true, name: true, slug: true, status: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                reportedBy: { select: { id: true, name: true, email: true } },
            },
            orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
            take: limit,
        });

        const summary = await prisma.platformSupportIssue.groupBy({
            by: ["status", "priority"],
            where: tenantId ? { organizationId: tenantId } : undefined,
            _count: { _all: true },
        });

        return NextResponse.json({ issues, summary });
    } catch (error) {
        console.error("Platform support issues list failed", error);
        return NextResponse.json({ error: "Failed to load support issues" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    try {
        const body = createIssueSchema.parse(await request.json());
        const org = await prisma.organization.findUnique({ where: { id: body.organizationId }, select: { id: true, name: true } });
        if (!org) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

        const issue = await prisma.platformSupportIssue.create({
            data: {
                organizationId: body.organizationId,
                title: body.title.trim(),
                description: cleanText(body.description),
                category: body.category,
                priority: body.priority,
                status: body.status,
                scope: body.scope,
                source: body.source,
                impact: cleanText(body.impact),
                nextAction: cleanText(body.nextAction),
                dueAt: parseDate(body.dueAt),
                assignedToId: body.assignedToId || null,
                reportedById: auth.admin.id,
            },
            include: {
                organization: { select: { id: true, name: true, slug: true, status: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                reportedBy: { select: { id: true, name: true, email: true } },
            },
        });

        await logPlatformAction({
            adminId: auth.admin.id,
            action: "support.issue.create",
            targetType: "support_issue",
            targetId: issue.id,
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
            metadata: {
                organizationId: issue.organizationId,
                title: issue.title,
                category: issue.category,
                priority: issue.priority,
                scope: issue.scope,
            },
        });

        return NextResponse.json({ issue }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid issue data", details: error.issues }, { status: 400 });
        }
        console.error("Platform support issue create failed", error);
        return NextResponse.json({ error: "Failed to create support issue" }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const auth = await verifyPlatformRequest(request);
    if (!isPlatformVerified(auth)) return auth;

    try {
        const body = updateIssueSchema.parse(await request.json());
        const existing = await prisma.platformSupportIssue.findUnique({ where: { id: body.id } });
        if (!existing) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

        const status = body.status ?? existing.status;
        const issue = await prisma.platformSupportIssue.update({
            where: { id: body.id },
            data: {
                ...(body.organizationId ? { organizationId: body.organizationId } : {}),
                ...(body.title ? { title: body.title.trim() } : {}),
                ...(body.description !== undefined ? { description: cleanText(body.description) } : {}),
                ...(body.category ? { category: body.category } : {}),
                ...(body.priority ? { priority: body.priority } : {}),
                ...(body.status ? { status: body.status } : {}),
                ...(body.scope ? { scope: body.scope } : {}),
                ...(body.source ? { source: body.source } : {}),
                ...(body.impact !== undefined ? { impact: cleanText(body.impact) } : {}),
                ...(body.nextAction !== undefined ? { nextAction: cleanText(body.nextAction) } : {}),
                ...(body.resolution !== undefined ? { resolution: cleanText(body.resolution) } : {}),
                ...(body.dueAt !== undefined ? { dueAt: parseDate(body.dueAt) } : {}),
                ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId || null } : {}),
                resolvedAt: ["resolved", "closed"].includes(status) ? existing.resolvedAt ?? new Date() : null,
            },
            include: {
                organization: { select: { id: true, name: true, slug: true, status: true } },
                assignedTo: { select: { id: true, name: true, email: true } },
                reportedBy: { select: { id: true, name: true, email: true } },
            },
        });

        await logPlatformAction({
            adminId: auth.admin.id,
            action: "support.issue.update",
            targetType: "support_issue",
            targetId: issue.id,
            ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
            metadata: {
                organizationId: issue.organizationId,
                title: issue.title,
                category: issue.category,
                priority: issue.priority,
                status: issue.status,
                scope: issue.scope,
            },
        });

        return NextResponse.json({ issue });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Invalid issue data", details: error.issues }, { status: 400 });
        }
        console.error("Platform support issue update failed", error);
        return NextResponse.json({ error: "Failed to update support issue" }, { status: 500 });
    }
}
