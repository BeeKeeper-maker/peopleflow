/**
 * Session Security Configuration
 * Handles session timeouts, refresh tokens, and security controls
 */

// Session configuration constants
export const SESSION_CONFIG = {
    // Maximum session duration (30 days)
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds

    // Idle timeout (30 minutes of inactivity)
    idleTimeout: 30 * 60, // 30 minutes in seconds

    // Remember me duration (7 days)
    rememberMeDuration: 7 * 24 * 60 * 60, // 7 days in seconds

    // Token refresh interval (15 minutes)
    refreshInterval: 15 * 60, // 15 minutes in seconds

    // Cookie settings
    cookie: {
        name: "peopleflow.session",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
    },

    // Maximum concurrent sessions per user
    maxConcurrentSessions: 5,
};

export interface SessionData {
    userId: string;
    email: string;
    role: string;
    organizationId?: string;
    employeeId?: string;
    createdAt: number;
    lastActivity: number;
    expiresAt: number;
    ipAddress?: string;
    userAgent?: string;
    isRemembered: boolean;
}

export interface SessionValidationResult {
    isValid: boolean;
    reason?: "expired" | "idle_timeout" | "invalid" | "revoked";
    session?: SessionData;
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session: SessionData): boolean {
    return Date.now() > session.expiresAt * 1000;
}

/**
 * Check if session has timed out due to inactivity
 */
export function isSessionIdleTimedOut(
    session: SessionData,
    idleTimeoutSeconds: number = SESSION_CONFIG.idleTimeout
): boolean {
    const lastActivityMs = session.lastActivity * 1000;
    const idleTimeoutMs = idleTimeoutSeconds * 1000;
    return Date.now() - lastActivityMs > idleTimeoutMs;
}

/**
 * Check if session needs token refresh
 */
export function sessionNeedsRefresh(
    session: SessionData,
    refreshIntervalSeconds: number = SESSION_CONFIG.refreshInterval
): boolean {
    const lastActivityMs = session.lastActivity * 1000;
    const refreshIntervalMs = refreshIntervalSeconds * 1000;
    return Date.now() - lastActivityMs > refreshIntervalMs;
}

/**
 * Validate session
 */
export function validateSession(session: SessionData | null): SessionValidationResult {
    if (!session) {
        return { isValid: false, reason: "invalid" };
    }

    if (isSessionExpired(session)) {
        return { isValid: false, reason: "expired" };
    }

    // Only check idle timeout for non-remembered sessions
    if (!session.isRemembered && isSessionIdleTimedOut(session)) {
        return { isValid: false, reason: "idle_timeout" };
    }

    return { isValid: true, session };
}

/**
 * Create a new session
 */
export function createSessionData(
    userId: string,
    email: string,
    role: string,
    options: {
        organizationId?: string;
        employeeId?: string;
        ipAddress?: string;
        userAgent?: string;
        rememberMe?: boolean;
    } = {}
): SessionData {
    const now = Math.floor(Date.now() / 1000);
    const duration = options.rememberMe
        ? SESSION_CONFIG.rememberMeDuration
        : SESSION_CONFIG.maxAge;

    return {
        userId,
        email,
        role,
        organizationId: options.organizationId,
        employeeId: options.employeeId,
        createdAt: now,
        lastActivity: now,
        expiresAt: now + duration,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        isRemembered: options.rememberMe || false,
    };
}

/**
 * Update session activity timestamp
 */
export function refreshSessionActivity(session: SessionData): SessionData {
    return {
        ...session,
        lastActivity: Math.floor(Date.now() / 1000),
    };
}

/**
 * Calculate remaining session time in seconds
 */
export function getSessionTimeRemaining(session: SessionData): number {
    const remainingMs = session.expiresAt * 1000 - Date.now();
    return Math.max(0, Math.floor(remainingMs / 1000));
}

/**
 * Get session expiry warning threshold (5 minutes before expiry)
 */
export function shouldShowExpiryWarning(session: SessionData): boolean {
    const warningThreshold = 5 * 60; // 5 minutes in seconds
    return getSessionTimeRemaining(session) <= warningThreshold;
}

/**
 * Validate session IP (optional security check)
 */
export function validateSessionIP(
    session: SessionData,
    currentIP: string,
    strictMode: boolean = false
): boolean {
    if (!strictMode || !session.ipAddress) {
        return true;
    }
    return session.ipAddress === currentIP;
}

/**
 * Validate session user agent
 */
export function validateSessionUserAgent(
    session: SessionData,
    currentUserAgent: string,
    strictMode: boolean = false
): boolean {
    if (!strictMode || !session.userAgent) {
        return true;
    }
    // Allow minor user agent variations (browser updates)
    const normalizedStored = session.userAgent.split("/")[0];
    const normalizedCurrent = currentUserAgent.split("/")[0];
    return normalizedStored === normalizedCurrent;
}

/**
 * Session security middleware helper
 */
export function getSecurityHeaders(): Record<string, string> {
    return {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
    };
}

/**
 * Extract session metadata from request
 */
export function extractSessionMetadata(request: Request): {
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
