/**
 * Universal File Upload API
 * 
 * Supports multiple file types with validation:
 * - employees: Employee photos
 * - documents: Employee documents (NID, passport, etc.)
 * - receipts: Expense receipts
 * - resumes: Candidate resumes
 */

import { NextRequest } from "next/server";
import path from "path";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { enforcePlanLimit, onResourceCreated } from "@/lib/plan-enforcement";
import { getStorageService, FILE_TYPES } from "@/lib/storage";
import { errorResponse, successResponse, ErrorCodes } from "@/lib/api-response";
import { storageLogger } from "@/lib/logger";

// Folder to file type mapping
const FOLDER_TYPE_MAP: Record<string, keyof typeof FILE_TYPES> = {
    employees: "avatar",
    documents: "document",
    receipts: "receipt",
    resumes: "resume",
    avatars: "avatar",
    "official-assets": "image",
};

function sanitizeFilenamePrefix(prefix?: string): string | undefined {
    const sanitized = prefix?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    return sanitized || undefined;
}

function isHRLevel(role: string): boolean {
    return ["super_admin", "admin", "hr_admin"].includes(role);
}

function canUploadToFolder(folder: string, role: string): boolean {
    if (["receipts", "avatars"].includes(folder)) return true;
    return isHRLevel(role);
}

function getTenantUploadPath(fileUrl: string, organizationId: string): string | null {
    let pathname: string;
    try {
        pathname = new URL(fileUrl, "http://local").pathname;
    } catch {
        pathname = fileUrl;
    }

    let decodedPathname: string;
    try {
        decodedPathname = decodeURIComponent(pathname);
    } catch {
        return null;
    }

    const publicPrefix = "/api/uploads/";
    if (!decodedPathname.startsWith(publicPrefix)) {
        return null;
    }

    const relativePath = decodedPathname.slice(publicPrefix.length);
    const normalized = path.posix.normalize(`/${relativePath}`).replace(/^\/+/, "");

    if (!normalized.startsWith(`${organizationId}/`)) {
        return null;
    }

    return normalized;
}

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        // Parse form data
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const requestedFolder = (formData.get("folder") as string) || "documents";
        const folder = FOLDER_TYPE_MAP[requestedFolder] ? requestedFolder : "documents";
        const tenantFolder = `${auth.organizationId}/${folder}`;
        const requestedPrefix = sanitizeFilenamePrefix(formData.get("prefix") as string | undefined);
        const prefix = folder === "receipts" && auth.employeeId
            ? `${auth.employeeId}-${requestedPrefix || "receipt"}`
            : requestedPrefix;

        if (!canUploadToFolder(folder, auth.role)) {
            return errorResponse(
                ErrorCodes.FORBIDDEN,
                "Only HR administrators can upload files to this folder."
            );
        }

        // Validate file exists
        if (!file) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, "No file provided");
        }

        const planCheck = await enforcePlanLimit(auth.organizationId, "storage");
        if (!planCheck.allowed) {
            return errorResponse(
                ErrorCodes.FORBIDDEN,
                planCheck.message || "Storage is not available for your current plan",
                {
                    status: 402,
                    details: {
                        upgradeRequired: planCheck.upgradeRequired,
                        current: planCheck.current,
                        limit: planCheck.limit,
                    },
                }
            );
        }

        // Get allowed file type for folder
        const allowedType = FOLDER_TYPE_MAP[folder];

        // Get storage service and upload
        const storage = getStorageService();
        const result = await storage.upload(file, {
            folder: tenantFolder,
            allowedType,
            filenamePrefix: prefix,
        });

        if (!result.success) {
            return errorResponse(
                result.error.code === "FILE_TOO_LARGE"
                    ? ErrorCodes.VALIDATION_ERROR
                    : ErrorCodes.INVALID_INPUT,
                result.error.message
            );
        }

        await onResourceCreated(auth.organizationId, "storage");

        return successResponse({
            url: result.file.url,
            filename: result.file.filename,
            originalName: result.file.originalName,
            size: result.file.size,
            mimeType: result.file.mimeType,
        }, { message: "File uploaded successfully" });

    } catch (error) {
        storageLogger.error({ err: error }, "UPLOAD_ERROR:");
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to upload file");
    }
}

// Handle file deletion — with ownership verification
export async function DELETE(req: NextRequest) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { searchParams } = new URL(req.url);
        const fileUrl = searchParams.get("url");

        if (!fileUrl) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, "File URL required");
        }

        // Ownership check: HR-level roles can delete any file.
        // Regular users can only delete files they uploaded (identified by email prefix in filename).
        const userRole = auth.role;
        const isHRLevel = ["super_admin", "admin", "hr_admin"].includes(userRole);

        const tenantUploadPath = getTenantUploadPath(fileUrl, auth.organizationId);
        if (!tenantUploadPath) {
            return errorResponse(
                ErrorCodes.FORBIDDEN,
                "You can only delete files owned by your organization."
            );
        }

        if (!isHRLevel) {
            // For non-HR users, verify the file belongs to them.
            // Files are stored with a prefix derived from the uploader context.
            // As a safety measure, deny deletion for non-HR users entirely.
            // They should request HR to remove files on their behalf.
            return errorResponse(
                ErrorCodes.FORBIDDEN,
                "Only HR administrators can delete files. Please contact your HR department."
            );
        }

        const storage = getStorageService();
        await storage.delete(`/api/uploads/${tenantUploadPath}`);

        return successResponse({ deleted: true }, { message: "File deleted successfully" });

    } catch (error) {
        storageLogger.error({ err: error }, "DELETE_ERROR:");
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete file");
    }
}
