/**
 * Input Sanitization Utilities
 * Prevents XSS and other injection attacks
 */

/**
 * HTML entities to escape
 */
const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
    return str.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Sanitize a string by trimming and removing dangerous characters
 */
export function sanitizeString(input: string | undefined | null): string {
    if (!input) return "";

    // Trim whitespace
    let sanitized = input.trim();

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, "");

    // Remove control characters (except newlines and tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    return sanitized;
}

/**
 * Sanitize and escape a string for HTML output
 */
export function sanitizeForHtml(input: string | undefined | null): string {
    return escapeHtml(sanitizeString(input));
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string | undefined | null): string {
    if (!email) return "";

    const sanitized = sanitizeString(email).toLowerCase();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
        return "";
    }

    return sanitized;
}

/**
 * Sanitize phone number (keep only digits and basic formatting)
 */
export function sanitizePhone(phone: string | undefined | null): string {
    if (!phone) return "";

    // Keep only digits, plus sign, hyphens, spaces, and parentheses
    return sanitizeString(phone).replace(/[^\d+\-\s()]/g, "");
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: string | undefined | null): string {
    if (!url) return "";

    const sanitized = sanitizeString(url);

    // Only allow http, https, and relative URLs
    if (
        sanitized.startsWith("http://") ||
        sanitized.startsWith("https://") ||
        sanitized.startsWith("/")
    ) {
        return sanitized;
    }

    // Block javascript:, data:, and other dangerous protocols
    return "";
}

/**
 * Sanitize filename (for uploads)
 */
export function sanitizeFilename(filename: string | undefined | null): string {
    if (!filename) return "";

    // Remove path separators and dangerous characters
    return sanitizeString(filename)
        .replace(/[/\\:*?"<>|]/g, "_")  // Replace dangerous chars
        .replace(/\.\./g, "_")           // Prevent directory traversal
        .slice(0, 255);                  // Limit length
}

/**
 * Sanitize object by applying sanitization to all string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(
    obj: T,
    options?: {
        excludeKeys?: string[];
        forHtml?: boolean;
    }
): T {
    const result: Record<string, unknown> = {};
    const excludeKeys = new Set(options?.excludeKeys || []);
    const sanitizeFn = options?.forHtml ? sanitizeForHtml : sanitizeString;

    for (const [key, value] of Object.entries(obj)) {
        if (excludeKeys.has(key)) {
            result[key] = value;
        } else if (typeof value === "string") {
            result[key] = sanitizeFn(value);
        } else if (Array.isArray(value)) {
            result[key] = value.map((item) =>
                typeof item === "string" ? sanitizeFn(item) : item
            );
        } else if (value && typeof value === "object") {
            result[key] = sanitizeObject(value as Record<string, unknown>, options);
        } else {
            result[key] = value;
        }
    }

    return result as T;
}

/**
 * Validate and sanitize pagination parameters
 */
export function sanitizePagination(params: {
    page?: string | number | null;
    limit?: string | number | null;
    maxLimit?: number;
}): { page: number; limit: number; skip: number } {
    const maxLimit = params.maxLimit || 100;

    let page = typeof params.page === "string"
        ? parseInt(params.page, 10)
        : (params.page || 1);

    let limit = typeof params.limit === "string"
        ? parseInt(params.limit, 10)
        : (params.limit || 10);

    // Ensure positive values
    page = Math.max(1, isNaN(page) ? 1 : page);
    limit = Math.max(1, Math.min(maxLimit, isNaN(limit) ? 10 : limit));

    return {
        page,
        limit,
        skip: (page - 1) * limit,
    };
}

/**
 * Validate sort parameters against allowed fields
 */
export function sanitizeSort(
    sortBy: string | null | undefined,
    sortOrder: string | null | undefined,
    allowedFields: string[]
): { sortBy: string; sortOrder: "asc" | "desc" } | null {
    if (!sortBy) return null;

    const sanitizedSortBy = sanitizeString(sortBy);

    if (!allowedFields.includes(sanitizedSortBy)) {
        return null;
    }

    const order = sortOrder?.toLowerCase() === "desc" ? "desc" : "asc";

    return { sortBy: sanitizedSortBy, sortOrder: order };
}
