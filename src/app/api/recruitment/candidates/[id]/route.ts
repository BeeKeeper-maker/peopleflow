import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;

        const candidate = await prisma.candidate.findFirst({
            where: { id, organizationId: ctx.organizationId },
            include: {
                applications: {
                    include: {
                        jobPosting: {
                            select: {
                                id: true,
                                title: true,
                                department: { select: { name: true } },
                                designation: { select: { name: true } },
                            },
                        },
                    },
                    orderBy: { appliedAt: "desc" },
                },
            },
        });

        if (!candidate) {
            return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
        }

        return NextResponse.json(candidate);
    } catch (error) {
        apiLogger.error({ err: error }, "GET_CANDIDATE_ERROR");
        return NextResponse.json({ error: "Failed to fetch candidate" }, { status: 500 });
    }
}

export async function PATCH(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;
        const body = await req.json();

        const candidate = await prisma.candidate.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!candidate) {
            return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
        }

        // Email uniqueness check if email is changing
        if (body.email && body.email !== candidate.email) {
            const existing = await prisma.candidate.findFirst({
                where: { email: body.email, organizationId: ctx.organizationId, id: { not: id } },
            });
            if (existing) {
                return NextResponse.json(
                    { error: "Another candidate with this email already exists" },
                    { status: 409 },
                );
            }
        }

        const updated = await prisma.candidate.update({
            where: { id },
            data: {
                ...(body.firstName !== undefined && { firstName: body.firstName }),
                ...(body.lastName !== undefined && { lastName: body.lastName }),
                ...(body.email !== undefined && { email: body.email }),
                ...(body.phone !== undefined && { phone: body.phone }),
                ...(body.resumeUrl !== undefined && { resumeUrl: body.resumeUrl || null }),
                ...(body.portfolioUrl !== undefined && { portfolioUrl: body.portfolioUrl || null }),
                ...(body.linkedinUrl !== undefined && { linkedinUrl: body.linkedinUrl || null }),
                ...(body.currentCompany !== undefined && { currentCompany: body.currentCompany }),
                ...(body.currentTitle !== undefined && { currentTitle: body.currentTitle }),
                ...(body.yearsOfExp !== undefined && { yearsOfExp: body.yearsOfExp }),
                ...(body.expectedSalary !== undefined && { expectedSalary: body.expectedSalary }),
                ...(body.noticePeriod !== undefined && { noticePeriod: body.noticePeriod }),
                ...(body.skills !== undefined && { skills: body.skills }),
                ...(body.education !== undefined && { education: body.education }),
                ...(body.source !== undefined && { source: body.source }),
                ...(body.notes !== undefined && { notes: body.notes }),
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        apiLogger.error({ err: error }, "UPDATE_CANDIDATE_ERROR");
        return NextResponse.json({ error: "Failed to update candidate" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: RouteParams) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { id } = await params;

        const candidate = await prisma.candidate.findFirst({
            where: { id, organizationId: ctx.organizationId },
        });
        if (!candidate) {
            return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
        }

        await prisma.candidate.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error({ err: error }, "DELETE_CANDIDATE_ERROR");
        return NextResponse.json({ error: "Failed to delete candidate" }, { status: 500 });
    }
}
