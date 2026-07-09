import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import mime from 'mime';
import { storageLogger } from "@/lib/logger";
import { requireAuth, isAuthenticated, type AuthContext } from "@/lib/api-auth";


function buildUploadUrl(pathSegments: string[]): string {
    return `/api/uploads/${pathSegments.map((segment) => encodeURIComponent(segment)).join("/")}`;
}

function isHRLevel(role: string): boolean {
    return ["super_admin", "admin", "hr_admin"].includes(role);
}

async function canAccessUpload(pathSegments: string[], auth: AuthContext): Promise<boolean> {
    const folder = pathSegments[1];
    if (!folder) return false;

    // Profile images are intentionally visible to authenticated users in the same tenant.
    if (["employees", "avatars"].includes(folder)) return true;

    if (isHRLevel(auth.role)) return true;

    const fileUrl = buildUploadUrl(pathSegments);

    if (folder === "receipts") {
        const filename = pathSegments[2] || "";
        if (auth.employeeId && filename.startsWith(`${auth.employeeId}-`)) {
            return true;
        }

        const claim = await auth.withDB((db) =>
            db.expenseClaim.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    receiptUrl: fileUrl,
                },
                include: { employee: { select: { id: true, reportingManagerId: true } } },
            }),
        );

        if (!claim || !auth.employeeId) return false;
        if (claim.employeeId === auth.employeeId) return true;
        return auth.role === "manager" && claim.employee.reportingManagerId === auth.employeeId;
    }

    // Employee documents, resumes, generated/attached HR documents are sensitive.
    // Until every file is backed by explicit ownership metadata, keep direct file access HR-only.
    return false;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { path: pathSegments } = await params;

        if (pathSegments[0] !== auth.organizationId) {
            return new NextResponse("Access Denied", { status: 403 });
        }

        if (!(await canAccessUpload(pathSegments, auth))) {
            return new NextResponse("Access Denied", { status: 403 });
        }

        const filePath = path.join(process.cwd(), "uploads", ...pathSegments);

        // Security check: ensure path is within uploads directory
        const resolvedPath = path.resolve(filePath);
        const uploadsDir = path.resolve(process.cwd(), "uploads");
        const relativePath = path.relative(uploadsDir, resolvedPath);
        if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
            return new NextResponse("Access Denied", { status: 403 });
        }

        const tenantPrefix = `${auth.organizationId}${path.sep}`;
        if (!relativePath.startsWith(tenantPrefix)) {
            return new NextResponse("Access Denied", { status: 403 });
        }

        // Check if file exists
        try {
            await stat(filePath);
        } catch {
            return new NextResponse("File not found", { status: 404 });
        }

        // Read file
        const fileBuffer = await readFile(filePath);

        // Determine mime type
        const mimeType = mime.getType(filePath) || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": mimeType,
                "Cache-Control": "private, no-store",
            },
        });
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        storageLogger.error({ err: error, errorId }, "SERVE_FILE_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
