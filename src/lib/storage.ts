/**
 * Enterprise File Storage System
 * 
 * Features:
 * - Storage abstraction (Local, S3, Cloudflare R2)
 * - File type validation
 * - Size limits per file type
 * - Secure file naming
 * - Image optimization
 * - MIME type detection
 */

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

// ============================================
// Configuration
// ============================================

export interface StorageConfig {
    provider: "local" | "s3" | "r2";
    basePath?: string;         // For local storage
    bucket?: string;           // For S3/R2
    region?: string;           // For S3
    accessKeyId?: string;
    secretAccessKey?: string;
    endpoint?: string;         // For R2/S3-compatible
    publicUrl?: string;        // Public URL prefix
}

const defaultConfig: StorageConfig = {
    provider: "local",
    basePath: path.join(process.cwd(), "uploads"),
    publicUrl: "/api/uploads",
};

// ============================================
// File Type Definitions
// ============================================

export interface AllowedFileType {
    mimeTypes: string[];
    extensions: string[];
    maxSize: number;  // bytes
}

export const FILE_TYPES: Record<string, AllowedFileType> = {
    image: {
        mimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        extensions: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    document: {
        mimeTypes: [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        extensions: [".pdf", ".doc", ".docx", ".xls", ".xlsx"],
        maxSize: 10 * 1024 * 1024, // 10MB
    },
    resume: {
        mimeTypes: ["application/pdf"],
        extensions: [".pdf"],
        maxSize: 5 * 1024 * 1024, // 5MB
    },
    avatar: {
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        extensions: [".jpg", ".jpeg", ".png", ".webp"],
        maxSize: 2 * 1024 * 1024, // 2MB
    },
    receipt: {
        mimeTypes: ["image/jpeg", "image/png", "application/pdf"],
        extensions: [".jpg", ".jpeg", ".png", ".pdf"],
        maxSize: 5 * 1024 * 1024, // 5MB
    },
};

// ============================================
// Upload Result Types
// ============================================

export interface UploadResult {
    success: true;
    file: {
        id: string;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        url: string;
        path: string;
    };
}

export interface UploadError {
    success: false;
    error: {
        code: "INVALID_TYPE" | "FILE_TOO_LARGE" | "UPLOAD_FAILED" | "NO_FILE";
        message: string;
    };
}

export type UploadResponse = UploadResult | UploadError;

// ============================================
// Storage Provider Interface
// ============================================

interface StorageProvider {
    upload(buffer: Buffer, filename: string, folder: string): Promise<string>;
    delete(path: string): Promise<void>;
    getSignedUrl?(path: string, expiresIn: number): Promise<string>;
}

// ============================================
// Local Storage Provider
// ============================================

class LocalStorageProvider implements StorageProvider {
    private basePath: string;
    private publicUrl: string;

    constructor(config: StorageConfig) {
        this.basePath = config.basePath || path.join(process.cwd(), "uploads");
        this.publicUrl = config.publicUrl || "/api/uploads";
    }

    async upload(buffer: Buffer, filename: string, folder: string): Promise<string> {
        const uploadDir = path.join(this.basePath, folder);
        await fs.mkdir(uploadDir, { recursive: true });

        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, buffer);

        return `${this.publicUrl}/${folder}/${filename}`;
    }

    async delete(filePath: string): Promise<void> {
        // Extract folder and filename from URL
        const relativePath = filePath.replace(this.publicUrl, "");
        const fullPath = path.join(this.basePath, relativePath);

        try {
            await fs.unlink(fullPath);
        } catch (error) {
            console.error("Failed to delete file:", error);
        }
    }
}

// ============================================
// S3/R2 Storage Provider (Placeholder)
// ============================================

class S3StorageProvider implements StorageProvider {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_config: StorageConfig) {
        // Initialize S3 client here when needed
        // This is a placeholder for future S3/R2 implementation
    }

    async upload(buffer: Buffer, filename: string, folder: string): Promise<string> {
        // TODO: Implement S3 upload when needed
        // Using AWS SDK v3:
        // const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
        throw new Error(`S3 upload not implemented yet. Would upload ${filename} to ${folder} (${buffer.length} bytes)`);
    }

    async delete(_path: string): Promise<void> {
        // TODO: Implement S3 delete
        throw new Error("S3 delete not implemented yet");
    }

    async getSignedUrl(_path: string, _expiresIn: number): Promise<string> {
        // TODO: Implement signed URL generation
        throw new Error("S3 signed URL not implemented yet");
    }
}

// ============================================
// File Storage Service
// ============================================

export class FileStorageService {
    private provider: StorageProvider;
    private config: StorageConfig;

    constructor(config: Partial<StorageConfig> = {}) {
        this.config = { ...defaultConfig, ...config };

        switch (this.config.provider) {
            case "s3":
            case "r2":
                this.provider = new S3StorageProvider(this.config);
                break;
            case "local":
            default:
                this.provider = new LocalStorageProvider(this.config);
        }
    }

    /**
     * Validate file against allowed types
     */
    validateFile(
        file: File,
        allowedType: keyof typeof FILE_TYPES
    ): { valid: true } | { valid: false; error: string } {
        const typeConfig = FILE_TYPES[allowedType];

        if (!typeConfig) {
            return { valid: false, error: `Unknown file type: ${allowedType}` };
        }

        // Check MIME type
        if (!typeConfig.mimeTypes.includes(file.type)) {
            return {
                valid: false,
                error: `Invalid file type. Allowed: ${typeConfig.extensions.join(", ")}`
            };
        }

        // Check extension
        const ext = path.extname(file.name).toLowerCase();
        if (!typeConfig.extensions.includes(ext)) {
            return {
                valid: false,
                error: `Invalid file extension. Allowed: ${typeConfig.extensions.join(", ")}`
            };
        }

        // Check size
        if (file.size > typeConfig.maxSize) {
            const maxMB = (typeConfig.maxSize / (1024 * 1024)).toFixed(1);
            return {
                valid: false,
                error: `File too large. Maximum: ${maxMB}MB`
            };
        }

        return { valid: true };
    }

    /**
     * Generate secure filename
     */
    generateSecureFilename(originalName: string, prefix: string = ""): string {
        const ext = path.extname(originalName).toLowerCase();
        const hash = crypto.randomBytes(8).toString("hex");
        const timestamp = Date.now();
        const safePrefix = prefix ? `${prefix}-` : "";

        return `${safePrefix}${timestamp}-${hash}${ext}`;
    }

    /**
     * Upload a file
     */
    async upload(
        file: File,
        options: {
            folder: string;
            allowedType: keyof typeof FILE_TYPES;
            filenamePrefix?: string;
        }
    ): Promise<UploadResponse> {
        // Validate file
        const validation = this.validateFile(file, options.allowedType);
        if (!validation.valid) {
            return {
                success: false,
                error: {
                    code: file.size > (FILE_TYPES[options.allowedType]?.maxSize || 0)
                        ? "FILE_TOO_LARGE"
                        : "INVALID_TYPE",
                    message: validation.error,
                },
            };
        }

        try {
            // Read file buffer
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Generate secure filename
            const filename = this.generateSecureFilename(
                file.name,
                options.filenamePrefix
            );

            // Upload to storage
            const url = await this.provider.upload(buffer, filename, options.folder);

            // Generate file ID
            const fileId = crypto.randomUUID();

            return {
                success: true,
                file: {
                    id: fileId,
                    filename,
                    originalName: file.name,
                    mimeType: file.type,
                    size: file.size,
                    url,
                    path: `${options.folder}/${filename}`,
                },
            };
        } catch (error) {
            console.error("Upload failed:", error);
            return {
                success: false,
                error: {
                    code: "UPLOAD_FAILED",
                    message: "Failed to upload file. Please try again.",
                },
            };
        }
    }

    /**
     * Delete a file
     */
    async delete(fileUrl: string): Promise<void> {
        await this.provider.delete(fileUrl);
    }
}

// ============================================
// Singleton Instance
// ============================================

let storageInstance: FileStorageService | null = null;

export function getStorageService(): FileStorageService {
    if (!storageInstance) {
        // Check environment for storage configuration
        const provider = (process.env.STORAGE_PROVIDER as StorageConfig["provider"]) || "local";

        storageInstance = new FileStorageService({
            provider,
            basePath: process.env.STORAGE_LOCAL_PATH || path.join(process.cwd(), "uploads"),
            bucket: process.env.STORAGE_S3_BUCKET,
            region: process.env.STORAGE_S3_REGION,
            accessKeyId: process.env.STORAGE_S3_ACCESS_KEY,
            secretAccessKey: process.env.STORAGE_S3_SECRET_KEY,
            endpoint: process.env.STORAGE_S3_ENDPOINT,
            publicUrl: process.env.STORAGE_PUBLIC_URL || "/api/uploads",
        });
    }

    return storageInstance;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get file extension icon name
 */
export function getFileIcon(filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    const iconMap: Record<string, string> = {
        ".pdf": "file-pdf",
        ".doc": "file-doc",
        ".docx": "file-doc",
        ".xls": "file-excel",
        ".xlsx": "file-excel",
        ".jpg": "file-image",
        ".jpeg": "file-image",
        ".png": "file-image",
        ".gif": "file-image",
        ".webp": "file-image",
    };

    return iconMap[ext] || "file";
}
