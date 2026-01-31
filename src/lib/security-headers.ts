/**
 * Security Headers Configuration
 * Implements OWASP security best practices
 */

export const securityHeaders: Record<string, string> = {
    // Prevent clickjacking
    "X-Frame-Options": "DENY",

    // Prevent MIME type sniffing
    "X-Content-Type-Options": "nosniff",

    // Enable XSS protection
    "X-XSS-Protection": "1; mode=block",

    // Referrer policy
    "Referrer-Policy": "strict-origin-when-cross-origin",

    // Permissions policy (disable sensitive browser features)
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",

    // Content Security Policy
    "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Required for Next.js
        "style-src 'self' 'unsafe-inline'", // Required for Tailwind
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ].join("; "),

    // Strict Transport Security (HTTPS only)
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

/**
 * CORS configuration
 */
export const corsConfig = {
    // Allowed origins (configure for production)
    allowedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    ],

    // Allowed methods
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    // Allowed headers
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
    ],

    // Expose headers
    exposedHeaders: [
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
    ],

    // Max age for preflight cache
    maxAge: 86400, // 24 hours
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: Response): Response {
    const newHeaders = new Headers(response.headers);

    for (const [key, value] of Object.entries(securityHeaders)) {
        newHeaders.set(key, value);
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

/**
 * Create CORS headers for a request
 */
export function createCorsHeaders(request: Request): Record<string, string> {
    const origin = request.headers.get("origin") || "";
    const isAllowed = corsConfig.allowedOrigins.includes(origin) ||
        corsConfig.allowedOrigins.includes("*");

    if (!isAllowed) {
        return {};
    }

    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": corsConfig.allowedMethods.join(", "),
        "Access-Control-Allow-Headers": corsConfig.allowedHeaders.join(", "),
        "Access-Control-Expose-Headers": corsConfig.exposedHeaders.join(", "),
        "Access-Control-Max-Age": corsConfig.maxAge.toString(),
        "Access-Control-Allow-Credentials": "true",
    };
}

/**
 * Handle CORS preflight request
 */
export function handleCorsPreflightRequest(request: Request): Response | null {
    if (request.method !== "OPTIONS") {
        return null;
    }

    const corsHeaders = createCorsHeaders(request);
    if (Object.keys(corsHeaders).length === 0) {
        return new Response("CORS not allowed", { status: 403 });
    }

    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}
