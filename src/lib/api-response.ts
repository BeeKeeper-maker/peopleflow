/**
 * Standard API Response Helpers
 * Ensures consistent response format across all API routes
 */

import { NextResponse } from "next/server";

export interface ApiSuccessResponse<T = unknown> {
    success: true;
    data: T;
    message?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
}

export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Error codes for consistent error handling
 */
export const ErrorCodes = {
    // Authentication errors (401)
    UNAUTHORIZED: "UNAUTHORIZED",
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    SESSION_EXPIRED: "SESSION_EXPIRED",

    // Authorization errors (403)
    FORBIDDEN: "FORBIDDEN",
    INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

    // Not found errors (404)
    NOT_FOUND: "NOT_FOUND",
    RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

    // Validation errors (400)
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INVALID_INPUT: "INVALID_INPUT",
    MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

    // Conflict errors (409)
    CONFLICT: "CONFLICT",
    DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
    ALREADY_EXISTS: "ALREADY_EXISTS",

    // Rate limit (429)
    RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

    // Server errors (500)
    INTERNAL_ERROR: "INTERNAL_ERROR",
    DATABASE_ERROR: "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Create success response
 */
export function successResponse<T>(
    data: T,
    options?: {
        message?: string;
        status?: number;
        meta?: ApiSuccessResponse["meta"];
    }
): NextResponse<ApiSuccessResponse<T>> {
    return NextResponse.json(
        {
            success: true as const,
            data,
            message: options?.message,
            meta: options?.meta,
        },
        { status: options?.status || 200 }
    );
}

/**
 * Create error response
 */
export function errorResponse(
    code: ErrorCode,
    message: string,
    options?: {
        status?: number;
        details?: unknown;
    }
): NextResponse<ApiErrorResponse> {
    // Map error codes to HTTP status codes
    const statusMap: Record<ErrorCode, number> = {
        UNAUTHORIZED: 401,
        INVALID_CREDENTIALS: 401,
        SESSION_EXPIRED: 401,
        FORBIDDEN: 403,
        INSUFFICIENT_PERMISSIONS: 403,
        NOT_FOUND: 404,
        RESOURCE_NOT_FOUND: 404,
        VALIDATION_ERROR: 400,
        INVALID_INPUT: 400,
        MISSING_REQUIRED_FIELD: 400,
        CONFLICT: 409,
        DUPLICATE_ENTRY: 409,
        ALREADY_EXISTS: 409,
        RATE_LIMIT_EXCEEDED: 429,
        INTERNAL_ERROR: 500,
        DATABASE_ERROR: 500,
        EXTERNAL_SERVICE_ERROR: 502,
    };

    return NextResponse.json(
        {
            success: false as const,
            error: {
                code,
                message,
                details: options?.details,
            },
        },
        { status: options?.status || statusMap[code] || 500 }
    );
}

/**
 * Create paginated response
 */
export function paginatedResponse<T>(
    data: T[],
    options: {
        page: number;
        limit: number;
        total: number;
        message?: string;
    }
): NextResponse<ApiSuccessResponse<T[]>> {
    return successResponse(data, {
        message: options.message,
        meta: {
            page: options.page,
            limit: options.limit,
            total: options.total,
            totalPages: Math.ceil(options.total / options.limit),
        },
    });
}

/**
 * Create created response (201)
 */
export function createdResponse<T>(
    data: T,
    message?: string
): NextResponse<ApiSuccessResponse<T>> {
    return successResponse(data, { status: 201, message: message || "Created successfully" });
}

/**
 * Create no content response (204)
 */
export function noContentResponse(): NextResponse {
    return new NextResponse(null, { status: 204 });
}

/**
 * Handle common errors
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
    console.error("API Error:", error);

    // Prisma unique constraint violation
    if (error && typeof error === "object" && "code" in error) {
        const prismaError = error as { code: string; meta?: { target?: string[] } };

        if (prismaError.code === "P2002") {
            const field = prismaError.meta?.target?.[0] || "field";
            return errorResponse(
                ErrorCodes.DUPLICATE_ENTRY,
                `A record with this ${field} already exists`
            );
        }

        if (prismaError.code === "P2025") {
            return errorResponse(
                ErrorCodes.RESOURCE_NOT_FOUND,
                "The requested resource was not found"
            );
        }
    }

    // Generic error
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return errorResponse(ErrorCodes.INTERNAL_ERROR, message);
}
