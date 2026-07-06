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
import { storageLogger } from "@/lib/logger";

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

    private assertInsideBasePath(targetPath: string): void {
        const base = path.resolve(this.basePath);
        const resolved = path.resolve(targetPath);
        const relative = path.relative(base, resolved);

        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            throw new Error("Storage path escapes upload directory");
        }
    }

    async upload(buffer: Buffer, filename: string, folder: string): Promise<string> {
        const uploadDir = path.resolve(this.basePath, folder);
        this.assertInsideBasePath(uploadDir);
        await fs.mkdir(uploadDir, { recursive: true });

        const filepath = path.resolve(uploadDir, filename);
        this.assertInsideBasePath(filepath);
        await fs.writeFile(filepath, buffer);

        return `${this.publicUrl}/${folder}/${filename}`;
    }

    async delete(filePath: string): Promise<void> {
        // Extract folder and filename from URL
        let relativePath = filePath;
        try {
            relativePath = new URL(filePath, "http://local").pathname;
        } catch {
            // Keep the original value for relative paths.
        }
        relativePath = relativePath.startsWith(this.publicUrl)
            ? relativePath.slice(this.publicUrl.length)
            : relativePath;
        relativePath = relativePath.replace(/^\/+/, "");

        const fullPath = path.resolve(this.basePath, relativePath);
        this.assertInsideBasePath(fullPath);

        try {
            await fs.unlink(fullPath);
        } catch (error) {
            storageLogger.error({ err: error, filePath }, "Failed to delete file");
        }
    }
}

// ============================================
// S3/R2 Storage Provider (Production-ready)
// ============================================

class S3StorageProvider implements StorageProvider {
    private config: StorageConfig;
    private s3Client: any = null;

    constructor(config: StorageConfig) {
        this.config = config;

        // Lazy-load AWS SDK — only when S3 is actually used
        // This prevents import errors if @aws-sdk/client-s3 isn't installed
        try {
            const { S3Client } = require("@aws-sdk/client-s3");
            this.s3Client = new S3Client({
                region: config.region || "auto",
                endpoint: config.endpoint || undefined,
                credentials: {
                    accessKeyId: config.accessKeyId || "",
                    secretAccessKey: config.secretAccessKey || "",
                },
                forcePathStyle: !!config.endpoint, // Required for MinIO/R2
            });
            storageLogger.info({ bucket: config.bucket, endpoint: config.endpoint }, "S3 storage provider initialized");
        } catch (err) {
            storageLogger.warn({ err }, "AWS SDK not installed — S3 storage unavailable. Install @aws-sdk/client-s3 to enable.");
        }
    }

    async upload(buffer: Buffer, filename: string, folder: string): Promise<string> {
        if (!this.s3Client) {
            throw new Error("S3 client not initialized. Install @aws-sdk/client-s3 and configure S3 credentials.");
        }

        const { PutObjectCommand } = require("@aws-sdk/client-s3");
        const key = `${folder}/${filename}`;
        const bucket = this.config.bucket!;

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: this.getContentType(filename),
        });

        await this.s3Client.send(command);

        // Return URL: use publicUrl if set, otherwise construct from endpoint/bucket
        if (this.config.publicUrl) {
            return `${this.config.publicUrl}/${key}`;
        }
        if (this.config.endpoint) {
            return `${this.config.endpoint}/${bucket}/${key}`;
        }
        return `https://${bucket}.s3.${this.config.region || "us-east-1"}.amazonaws.com/${key}`;
    }

    async delete(filePath: string): Promise<void> {
        if (!this.s3Client) return;

        const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
        // Extract key from full URL or use as-is
        const key = filePath.startsWith("http") ? this.extractKeyFromUrl(filePath) : filePath;

        const command = new DeleteObjectCommand({
            Bucket: this.config.bucket!,
            Key: key,
        });

        await this.s3Client.send(command);
        storageLogger.info({ key }, "S3 file deleted");
    }

    async getSignedUrl(filePath: string, expiresIn: number): Promise<string> {
        if (!this.s3Client) {
            throw new Error("S3 client not initialized");
        }

        const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
        const { GetObjectCommand } = require("@aws-sdk/client-s3");
        const key = filePath.startsWith("http") ? this.extractKeyFromUrl(filePath) : filePath;

        const command = new GetObjectCommand({
            Bucket: this.config.bucket!,
            Key: key,
        });

        return getSignedUrl(this.s3Client, command, { expiresIn });
    }

    private extractKeyFromUrl(url: string): string {
        // Remove protocol and domain, keep just the key
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        // If first part is bucket name, skip it
        if (pathParts[0] === this.config.bucket) {
            return pathParts.slice(1).join("/");
        }
        return pathParts.join("/");
    }

    private getContentType(filename: string): string {
        const ext = filename.split(".").pop()?.toLowerCase() || "";
        const types: Record<string, string> = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
            pdf: "application/pdf",
            doc: "application/msword",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xls: "application/vnd.ms-excel",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            csv: "text/csv",
            txt: "text/plain",
        };
        return types[ext] || "application/octet-stream";
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
            storageLogger.error({ err: error, fileName: file.name }, "Upload failed");
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
