import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { apiLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/audit-log";
import * as z from "zod";

/**
 * GET /api/settings/custom-fields — List custom fields
 *
 * Query params:
 *   - entityType: Employee, Attendance, LeaveApplication
 *   - active: true/false
 */
export async function GET(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const { searchParams } = new URL(req.url);
        const entityType = searchParams.get("entityType");
        const active = searchParams.get("active");

        const where: Record<string, unknown> = { organizationId: ctx.organizationId };
        if (entityType) where.entityType = entityType;
        if (active === "true") where.isActive = true;
        if (active === "false") where.isActive = false;

        const fields = await prisma.customField.findMany({
            where,
            orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
        });

        return NextResponse.json({ data: fields, total: fields.length });
    } catch (error) {
        apiLogger.error({ err: error }, "GET_CUSTOM_FIELDS_ERROR");
        return NextResponse.json({ error: "Failed to fetch custom fields" }, { status: 500 });
    }
}

const ENTITY_TYPES = ["Employee", "Attendance", "LeaveApplication"] as const;
const FIELD_TYPES = ["text", "textarea", "number", "date", "select", "boolean"] as const;

const createFieldSchema = z.object({
    label: z.string().min(1, "Label is required").max(100),
    key: z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-z0-9_]+$/, "Key must be lowercase letters, numbers, and underscores"),
    entityType: z.enum(ENTITY_TYPES),
    fieldType: z.enum(FIELD_TYPES),
    options: z.array(z.string()).default([]),
    isRequired: z.boolean().default(false),
    isFilterable: z.boolean().default(false),
    isSearchable: z.boolean().default(false),
    defaultValue: z.string().nullable().optional(),
    description: z.string().max(500).optional(),
    sortOrder: z.number().int().default(0),
});

/**
 * POST /api/settings/custom-fields — Create a custom field
 */
export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        const body = await req.json();
        const validation = createFieldSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: validation.error.issues.map((e) => ({
                        field: e.path.join("."),
                        message: e.message,
                    })),
                },
                { status: 400 },
            );
        }

        const data = validation.data;

        // Select type requires at least 2 options
        if (data.fieldType === "select" && data.options.length < 2) {
            return NextResponse.json(
                { error: "Select fields must have at least 2 options" },
                { status: 400 },
            );
        }

        // Check key uniqueness within (org, entityType)
        const existing = await prisma.customField.findFirst({
            where: {
                organizationId: ctx.organizationId,
                entityType: data.entityType,
                key: data.key,
            },
        });
        if (existing) {
            return NextResponse.json(
                { error: `A field with key "${data.key}" already exists for ${data.entityType}` },
                { status: 409 },
            );
        }

        const field = await prisma.customField.create({
            data: {
                ...data,
                organizationId: ctx.organizationId,
            },
        });

        await createAuditLog({
            organizationId: ctx.organizationId,
            action: "create",
            entityType: "CustomField",
            entityId: field.id,
            newValues: { label: data.label, key: data.key, entityType: data.entityType, fieldType: data.fieldType },
            userId: ctx.userId,
        }).catch(() => {});

        return NextResponse.json(field, { status: 201 });
    } catch (error) {
        apiLogger.error({ err: error }, "CREATE_CUSTOM_FIELD_ERROR");
        return NextResponse.json({ error: "Failed to create custom field" }, { status: 500 });
    }
}
