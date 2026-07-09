import { NextResponse } from "next/server";

import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";

// GET /api/approval-workflows — List workflows for the organization
export async function GET(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Per-user rate limit (read op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, auth.userId);
    if (!rl.allowed) return rl.response!;

    try {
        const workflows = await auth.withDB((db) => db.approvalWorkflow.findMany({
            where: { organizationId: auth.organizationId },
            orderBy: { entityType: "asc" },
        }));

        return NextResponse.json(workflows);
    } catch (error) {
        apiLogger.error({ err: error }, "Failed to fetch workflows:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/approval-workflows — Create a new workflow
export async function POST(req: Request) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) return auth;

    // Only admin/hr can create approval workflows
    if (!["super_admin", "admin", "hr_admin"].includes(auth.role)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    // Per-user rate limit (write op)
    const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.write, auth.userId);
    if (!rl.allowed) return rl.response!;

    try {
        const body = await req.json();
        const { entityType, name, steps, isActive } = body;

        if (!entityType || !name || !steps) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Check if a workflow already exists for this entity type
        const existing = await auth.withDB((db) => db.approvalWorkflow.findUnique({
            where: {
                organizationId_entityType: {
                    organizationId: auth.organizationId,
                    entityType,
                },
            },
        }));

        if (existing) {
            return NextResponse.json(
                { error: `A workflow for '${entityType}' already exists. Please edit the existing one.` },
                { status: 409 }
            );
        }

        const workflow = await auth.withDB((db) => db.approvalWorkflow.create({
            data: {
                entityType,
                name,
                steps: typeof steps === "string" ? steps : JSON.stringify(steps),
                isActive: isActive ?? true,
                organizationId: auth.organizationId,
            },
        }));

        return NextResponse.json(workflow, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "Failed to create workflow:");
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
