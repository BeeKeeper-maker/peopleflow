/**
 * Audit Logging System
 * Tracks security-sensitive operations for compliance
 */

import { prisma } from "./prisma";
import { auditLogger } from "@/lib/logger";

export type AuditAction =
    | "login"
    | "logout"
    | "login_failed"
    | "password_change"
    | "create"
    | "update"
    | "delete"
    | "view"
    | "approve"
    | "reject"
    | "export";

interface AuditLogEntry {
    action: AuditAction;
    userId?: string;
    organizationId: string;
    entityType: string;
    entityId: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                action: entry.action,
                userId: entry.userId,
                organizationId: entry.organizationId,
                entityType: entry.entityType,
                entityId: entry.entityId,
                oldValues: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
                newValues: entry.newValues ? JSON.stringify(entry.newValues) : null,
                ipAddress: entry.ipAddress,
                userAgent: entry.userAgent,
            },
        });

        // Log sensitive events to console
        if (["login_failed", "delete", "password_change"].includes(entry.action)) {
            auditLogger.warn({ action: entry.action, entityType: entry.entityType, entityId: entry.entityId, userId: entry.userId }, "Sensitive audit event");
        }
    } catch (error) {
        // Don't let audit logging failures break the main operation
        auditLogger.error({ err: error }, "Failed to create audit log entry");
    }
}

/**
 * Helper to extract request metadata for audit logging
 */
export function extractRequestMetadata(request: Request): {
    ipAddress: string;
    userAgent: string;
} {
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded
        ? forwarded.split(",")[0].trim()
        : request.headers.get("x-real-ip") || "unknown";

    const userAgent = request.headers.get("user-agent") || "unknown";

    return { ipAddress, userAgent };
}

/**
 * Get audit logs with filtering
 */
export async function getAuditLogs(filters: {
    organizationId: string;
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}) {
    const where: Record<string, unknown> = {
        organizationId: filters.organizationId,
    };

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;

    if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) (where.createdAt as Record<string, Date>).gte = filters.startDate;
        if (filters.endDate) (where.createdAt as Record<string, Date>).lte = filters.endDate;
    }

    return prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters.limit || 100,
        skip: filters.offset || 0,
    });
}

/**
 * Log a create operation
 */
export async function logCreate(
    organizationId: string,
    entityType: string,
    entityId: string,
    newValues: Record<string, unknown>,
    userId?: string,
    request?: Request
): Promise<void> {
    const metadata = request ? extractRequestMetadata(request) : {};
    await createAuditLog({
        action: "create",
        organizationId,
        entityType,
        entityId,
        newValues,
        userId,
        ...metadata,
    });
}

/**
 * Log an update operation
 */
export async function logUpdate(
    organizationId: string,
    entityType: string,
    entityId: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    userId?: string,
    request?: Request
): Promise<void> {
    const metadata = request ? extractRequestMetadata(request) : {};
    await createAuditLog({
        action: "update",
        organizationId,
        entityType,
        entityId,
        oldValues,
        newValues,
        userId,
        ...metadata,
    });
}

/**
 * Log a delete operation
 */
export async function logDelete(
    organizationId: string,
    entityType: string,
    entityId: string,
    oldValues: Record<string, unknown>,
    userId?: string,
    request?: Request
): Promise<void> {
    const metadata = request ? extractRequestMetadata(request) : {};
    await createAuditLog({
        action: "delete",
        organizationId,
        entityType,
        entityId,
        oldValues,
        userId,
        ...metadata,
    });
}

/**
 * Clean up old audit logs (keep for compliance period)
 */
export async function cleanupOldAuditLogs(
    organizationId: string,
    retentionDays: number = 365
): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.auditLog.deleteMany({
        where: {
            organizationId,
            createdAt: {
                lt: cutoffDate,
            },
        },
    });

    return result.count;
}
