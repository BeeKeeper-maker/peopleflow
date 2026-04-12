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
import { auth } from "@/lib/auth";
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
};

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const session = await auth();
        if (!session?.user?.email) {
            return errorResponse(ErrorCodes.UNAUTHORIZED, "Authentication required");
        }

        // Parse form data
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const folder = (formData.get("folder") as string) || "documents";
        const prefix = formData.get("prefix") as string | undefined;

        // Validate file exists
        if (!file) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, "No file provided");
        }

        // Get allowed file type for folder
        const allowedType = FOLDER_TYPE_MAP[folder] || "document";

        // Get storage service and upload
        const storage = getStorageService();
        const result = await storage.upload(file, {
            folder,
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
        const session = await auth();
        if (!session?.user?.email) {
            return errorResponse(ErrorCodes.UNAUTHORIZED, "Authentication required");
        }

        const { searchParams } = new URL(req.url);
        const fileUrl = searchParams.get("url");

        if (!fileUrl) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, "File URL required");
        }

        // Ownership check: HR-level roles can delete any file.
        // Regular users can only delete files they uploaded (identified by email prefix in filename).
        const userRole = (session.user as { role?: string }).role || "employee";
        const isHRLevel = ["super_admin", "admin", "hr_admin"].includes(userRole);

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
        await storage.delete(fileUrl);

        return successResponse({ deleted: true }, { message: "File deleted successfully" });

    } catch (error) {
        storageLogger.error({ err: error }, "DELETE_ERROR:");
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Failed to delete file");
    }
}
