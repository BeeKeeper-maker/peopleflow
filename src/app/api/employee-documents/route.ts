import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { errorResponse, ErrorCodes, successResponse } from "@/lib/api-response";
import { apiLogger } from "@/lib/logger";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, DOCUMENT_TYPES, deriveDocumentCategory } from "@/lib/employee-documents";

const categoryValues = DOCUMENT_CATEGORIES.map((item) => item.value) as [string, ...string[]];
const statusValues = DOCUMENT_STATUSES as unknown as [string, ...string[]];
const typeValues = DOCUMENT_TYPES.map((item) => item.value) as [string, ...string[]];

const createDocumentSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  type: z.enum(typeValues).or(z.string().trim().min(1).max(80)),
  category: z.enum(categoryValues).optional(),
  fileUrl: z.string().trim().min(1),
  originalName: z.string().trim().max(255).optional().nullable(),
  mimeType: z.string().trim().max(120).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  issueDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  status: z.enum(statusValues).optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isTenantUploadUrl(fileUrl: string, organizationId: string) {
  try {
    const pathname = new URL(fileUrl, "http://local").pathname;
    const decoded = decodeURIComponent(pathname);
    return decoded.startsWith(`/api/uploads/${organizationId}/documents/`);
  } catch {
    return false;
  }
}

function normalizeTags(tags?: string[]) {
  return Array.from(new Set((tags || []).map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminOrHR();
  if (!isAuthenticated(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId") || undefined;
    const q = searchParams.get("q")?.trim();
    const category = searchParams.get("category") || undefined;
    const status = searchParams.get("status") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const branchId = searchParams.get("branchId") || undefined;
    const expiring = searchParams.get("expiring") || undefined;
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, Number.parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const now = new Date();
    const expiryThreshold = new Date(now);
    expiryThreshold.setDate(expiryThreshold.getDate() + 30);

    const where: Record<string, unknown> = {
      deletedAt: null,
      employee: {
        organizationId: auth.organizationId,
        deletedAt: null,
        ...(employeeId ? { id: employeeId } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      ...(category && category !== "all" ? { category } : {}),
      ...(status && status !== "all" && status !== "expired" ? { status } : {}),
    };

    if (status === "expired") {
      where.expiryDate = { lt: now };
    } else if (expiring === "soon") {
      where.expiryDate = { gte: now, lte: expiryThreshold };
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { type: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
        { tags: { has: q.toLowerCase() } },
        { employee: { firstName: { contains: q, mode: "insensitive" } } },
        { employee: { lastName: { contains: q, mode: "insensitive" } } },
        { employee: { employeeCode: { contains: q, mode: "insensitive" } } },
        { employee: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [documents, total, verifiedCount, pendingCount, expiredCount, expiringSoonCount] = await auth.withDB((db) =>
      Promise.all([
        db.employeeDocument.findMany({
          where,
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
          orderBy: [{ createdAt: "desc" }],
          skip,
          take: limit,
        }),
        db.employeeDocument.count({ where }),
        db.employeeDocument.count({ where: { deletedAt: null, status: "verified", employee: { organizationId: auth.organizationId, deletedAt: null } } }),
        db.employeeDocument.count({ where: { deletedAt: null, status: "pending", employee: { organizationId: auth.organizationId, deletedAt: null } } }),
        db.employeeDocument.count({ where: { deletedAt: null, expiryDate: { lt: now }, employee: { organizationId: auth.organizationId, deletedAt: null } } }),
        db.employeeDocument.count({ where: { deletedAt: null, expiryDate: { gte: now, lte: expiryThreshold }, employee: { organizationId: auth.organizationId, deletedAt: null } } }),
      ]),
    );

    return successResponse(
      {
        documents,
        stats: {
          total,
          verified: verifiedCount,
          pending: pendingCount,
          expired: expiredCount,
          expiringSoon: expiringSoonCount,
        },
      },
      {
        meta: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    );
  } catch (error) {
    apiLogger.error({ err: error }, "EMPLOYEE_DOCUMENTS_LIST_ERROR");
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to load employee documents");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrHR();
  if (!isAuthenticated(auth)) return auth;

  try {
    const parsed = createDocumentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 422 });
    }

    const body = parsed.data;
    if (!isTenantUploadUrl(body.fileUrl, auth.organizationId)) {
      return errorResponse(ErrorCodes.FORBIDDEN, "Document file must be uploaded to this organization's protected documents folder.");
    }

    const category = body.category || deriveDocumentCategory(body.type);
    const status = body.status || "pending";

    const document = await auth.withDB(async (db) => {
      const employee = await db.employee.findFirst({
        where: { id: body.employeeId, organizationId: auth.organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!employee) return null;

      return db.employeeDocument.create({
        data: {
          employeeId: employee.id,
          name: body.name,
          type: body.type,
          category,
          fileUrl: body.fileUrl,
          originalName: body.originalName || null,
          mimeType: body.mimeType || null,
          fileSize: body.fileSize || null,
          issueDate: parseDate(body.issueDate),
          expiryDate: parseDate(body.expiryDate),
          status,
          isVerified: status === "verified",
          verifiedAt: status === "verified" ? new Date() : null,
          verifiedById: status === "verified" ? auth.userId : null,
          notes: body.notes || null,
          tags: normalizeTags(body.tags),
          uploadedById: auth.userId,
        },
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

    if (!document) {
      return errorResponse(ErrorCodes.NOT_FOUND, "Employee not found");
    }

    return successResponse(document, { message: "Employee document saved", status: 201 });
  } catch (error) {
    apiLogger.error({ err: error }, "EMPLOYEE_DOCUMENTS_CREATE_ERROR");
    return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to save employee document");
  }
}
