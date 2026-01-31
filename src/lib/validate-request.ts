/**
 * Request Validation Helper
 * Validates request body against Zod schema and returns typed result
 */

import { NextRequest, NextResponse } from "next/server";
import { z, ZodSchema, ZodError } from "zod";
import { errorResponse, ErrorCodes, ErrorCode } from "./api-response";

export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    error?: NextResponse;
}

/**
 * Validate request body against a Zod schema
 * Returns typed data or error response
 */
export async function validateRequestBody<T>(
    request: NextRequest,
    schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
    try {
        const body = await request.json();
        const result = schema.safeParse(body);

        if (!result.success) {
            return {
                success: false,
                error: formatZodError(result.error),
            };
        }

        return {
            success: true,
            data: result.data,
        };
    } catch (error) {
        return {
            success: false,
            error: errorResponse(
                ErrorCodes.VALIDATION_ERROR,
                "Invalid JSON in request body"
            ),
        };
    }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQueryParams<T>(
    searchParams: URLSearchParams,
    schema: ZodSchema<T>
): ValidationResult<T> {
    const params: Record<string, string | string[]> = {};

    searchParams.forEach((value, key) => {
        if (params[key]) {
            // Handle multiple values for same key
            if (Array.isArray(params[key])) {
                (params[key] as string[]).push(value);
            } else {
                params[key] = [params[key] as string, value];
            }
        } else {
            params[key] = value;
        }
    });

    const result = schema.safeParse(params);

    if (!result.success) {
        return {
            success: false,
            error: formatZodError(result.error),
        };
    }

    return {
        success: true,
        data: result.data,
    };
}

/**
 * Validate route parameters
 */
export function validateParams<T>(
    params: Record<string, string | string[] | undefined>,
    schema: ZodSchema<T>
): ValidationResult<T> {
    const result = schema.safeParse(params);

    if (!result.success) {
        return {
            success: false,
            error: formatZodError(result.error),
        };
    }

    return {
        success: true,
        data: result.data,
    };
}

/**
 * Format Zod validation errors into API error response
 */
function formatZodError(error: ZodError): NextResponse {
    const formattedErrors = error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
    }));

    // Create a human-readable message from the first error
    const firstError = error.issues[0];
    const message = firstError
        ? `${firstError.path.join(".")}: ${firstError.message}`
        : "Validation failed";

    return NextResponse.json(
        {
            success: false,
            error: {
                code: ErrorCodes.VALIDATION_ERROR,
                message: "Validation failed",
                details: formattedErrors,
            },
        },
        { status: 400 }
    );
}

/**
 * Create a validated API handler wrapper
 * Automatically validates request body before calling handler
 */
export function withValidation<T>(
    schema: ZodSchema<T>,
    handler: (
        request: NextRequest,
        data: T,
        context?: { params: Record<string, string> }
    ) => Promise<NextResponse>
) {
    return async (
        request: NextRequest,
        context?: { params: Record<string, string> }
    ): Promise<NextResponse> => {
        const validation = await validateRequestBody(request, schema);

        if (!validation.success) {
            return validation.error!;
        }

        return handler(request, validation.data!, context);
    };
}

/**
 * Utility type for extracting schema type
 */
export type InferSchema<T extends ZodSchema> = z.infer<T>;
