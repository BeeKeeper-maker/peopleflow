import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { errorResponse, ErrorCodes, successResponse } from "@/lib/api-response";
import { apiLogger } from "@/lib/logger";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, DOCUMENT_TYPES, deriveDocumentCategory } from "@/lib/employee-documents";

const categoryValues = DOCUMENT_CATEGORIES.map((item) => item.value) as [string, ...string[]];
const statusValues = DOCUMENT_STATUSES as unknown as [string, ...string[]];
const typeValues = DOCUMENT_TYPES.map((item) => item.value) as [string, ...string[]];

const updateDocumentSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  type: z.enum(typeValues).or(z.string().trim().min(1).max(80)).optional(),
  category: z.enum(categoryValues).optional(),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  status: z.enum(statusValues).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  rejectedReason: z.string().trim().max(500).optional().nullable(),
});

function parseDate(value?: string | null) {
  if (value === undefined) return undefined;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTags(tags?: string[]) {
  if (tags === undefined) return undefined;
  return Array.from(new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrHR();
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await params;
    const document = await auth.withDB((db) =>
      db.employeeDocument.findFirst({
        where: {
          id,
          deletedAt: null,
          employee: { organizationId: auth.organizationId, deletedAt: null },
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              email: true,
              department: { select: { id: true, name: true } },
              branch: { select: { id: true, name: true } },
              designation: { select: { id: true, name: true } },
            },
          },
        },
      }),
    );

    if (!document) {
      return errorResponse(ErrorCodes.NOT_FOUND, "Document not found");
    }

    return successResponse(document);
  } catch (error) {
    apiLogger.error({ err: error }, "EMPLOYEE_DOCUMENT_GET_ERROR");
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to load document");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrHR();
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await params;
    const parsed = updateDocumentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 422 });
    }

    const body = parsed.data;
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = body.name;
    if (body.type !== undefined) {
      data.type = body.type;
      data.category = body.category || deriveDocumentCategory(body.type);
    } else if (body.category !== undefined) {
      data.category = body.category;
    }
    if (body.issueDate !== undefined) data.issueDate = parseDate(body.issueDate);
    if (body.expiryDate !== undefined) data.expiryDate = parseDate(body.expiryDate);
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.tags !== undefined) data.tags = normalizeTags(body.tags);
    if (body.rejectedReason !== undefined) data.rejectedReason = body.rejectedReason || null;

    if (body.status !== undefined) {
      data.status = body.status;
      data.isVerified = body.status === "verified";
      data.verifiedAt = body.status === "verified" ? new Date() : null;
      data.verifiedById = body.status === "verified" ? auth.userId : null;
      if (body.status !== "rejected") data.rejectedReason = null;
    }

    const updated = await auth.withDB(async (db) => {
      const existing = await db.employeeDocument.findFirst({
        where: {
          id,
          deletedAt: null,
          employee: { organizationId: auth.organizationId, deletedAt: null },
        },
        select: { id: true },
      });

      if (!existing) return null;

      return db.employeeDocument.update({
        where: { id },
        data,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              department: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    if (!updated) {
      return errorResponse(ErrorCodes.NOT_FOUND, "Document not found");
    }

    return successResponse(updated, { message: "Document updated" });
  } catch (error) {
    apiLogger.error({ err: error }, "EMPLOYEE_DOCUMENT_UPDATE_ERROR");
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to update document");
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminOrHR();
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await params;
    const deleted = await auth.withDB(async (db) => {
      const existing = await db.employeeDocument.findFirst({
        where: {
          id,
          deletedAt: null,
          employee: { organizationId: auth.organizationId, deletedAt: null },
        },
        select: { id: true },
      });

      if (!existing) return null;

      return db.employeeDocument.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: { id: true },
      });
    });

    if (!deleted) {
      return errorResponse(ErrorCodes.NOT_FOUND, "Document not found");
    }

    return successResponse({ deleted: true }, { message: "Document archived" });
  } catch (error) {
    apiLogger.error({ err: error }, "EMPLOYEE_DOCUMENT_DELETE_ERROR");
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to archive document");
  }
}
