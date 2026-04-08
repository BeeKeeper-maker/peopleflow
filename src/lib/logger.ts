/**
 * PeopleFlow Enterprise Logger — Structured JSON Logging
 *
 * Built on Pino for zero-overhead, structured JSON logs.
 *
 * Architecture:
 *   - Root logger with base context (service, version, environment)
 *   - Domain-scoped child loggers (payroll, auth, queue, etc.)
 *   - Request context binding for distributed tracing
 *   - Automatic Sentry integration for error-level logs
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.info({ userId, orgId }, "User logged in");
 *
 *   import { payrollLogger } from "@/lib/logger";
 *   payrollLogger.info({ employeeId, month, year }, "Salary calculated");
 *
 * Output Format (production):
 *   {"level":30,"time":1712500000,"pid":1,"hostname":"...",
 *    "service":"peopleflow","domain":"payroll","msg":"Salary calculated",
 *    "employeeId":"...","month":4,"year":2026}
 *
 * Output Format (development):
 *   [13:45:00] INFO (payroll): Salary calculated { employeeId: "..." }
 */

import pino from "pino";

// ════════════════════════════════════════════════════════════════════════
// Root Logger Configuration
// ════════════════════════════════════════════════════════════════════════

const isDev = process.env.NODE_ENV !== "production";

export const log = pino({
    name: "peopleflow",
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),

    // Base context attached to every log line
    base: {
        service: "peopleflow-hrms",
        env: process.env.NODE_ENV || "development",
    },

    // Timestamp as ISO string for human readability in log aggregators
    timestamp: pino.stdTimeFunctions.isoTime,

    // Redact sensitive fields from logs
    redact: {
        paths: [
            "password",
            "token",
            "secret",
            "authorization",
            "cookie",
            "req.headers.authorization",
            "req.headers.cookie",
            "*.password",
            "*.token",
            "*.secret",
            "*.apiKey",
            "*.stripeKey",
        ],
        censor: "[REDACTED]",
    },

    // Serializers for common objects
    serializers: {
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        req: (req: Record<string, unknown>) => ({
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
        }),
    },

    // Pretty-print in development, JSON in production
    ...(isDev
        ? {
              transport: {
                  target: "pino-pretty",
                  options: {
                      colorize: true,
                      translateTime: "HH:MM:ss",
                      ignore: "pid,hostname,service,env",
                      messageFormat: "{domain}: {msg}",
                  },
              },
          }
        : {}),
});

// ════════════════════════════════════════════════════════════════════════
// Domain-Scoped Child Loggers
// ════════════════════════════════════════════════════════════════════════

/** Authentication & authorization events */
export const authLogger = log.child({ domain: "auth" });

/** Payroll engine calculations */
export const payrollLogger = log.child({ domain: "payroll" });

/** Leave management events */
export const leaveLogger = log.child({ domain: "leave" });

/** Attendance tracking */
export const attendanceLogger = log.child({ domain: "attendance" });

/** Background job queue processing */
export const queueLogger = log.child({ domain: "queue" });

/** Event bus dispatching */
export const eventLogger = log.child({ domain: "event" });

/** Redis cache operations */
export const redisLogger = log.child({ domain: "redis" });

/** Email service */
export const emailLogger = log.child({ domain: "email" });

/** Biometric device communication */
export const biometricLogger = log.child({ domain: "biometric" });

/** Platform admin operations */
export const platformLogger = log.child({ domain: "platform" });

/** Stripe billing operations */
export const billingLogger = log.child({ domain: "billing" });

/** API request/response lifecycle */
export const apiLogger = log.child({ domain: "api" });

/** Subscription lifecycle worker */
export const subscriptionLogger = log.child({ domain: "subscription" });

/** Audit trail */
export const auditLogger = log.child({ domain: "audit" });

/** CRON job execution */
export const cronLogger = log.child({ domain: "cron" });

/** File storage operations */
export const storageLogger = log.child({ domain: "storage" });

/** Data export operations */
export const exportLogger = log.child({ domain: "export" });

// ════════════════════════════════════════════════════════════════════════
// Request Context Logger Factory
// ════════════════════════════════════════════════════════════════════════

/**
 * Create a request-scoped logger with bound context.
 * Use in API route handlers for automatic request correlation.
 *
 * Usage:
 *   const reqLog = createRequestLogger(request, "payroll");
 *   reqLog.info({ month: 4 }, "Processing payroll");
 */
export function createRequestLogger(
    request: Request,
    domain: string
): pino.Logger {
    const requestId = request.headers.get("x-request-id") ||
        crypto.randomUUID();

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
        ? forwarded.split(",")[0].trim()
        : request.headers.get("x-real-ip") || "unknown";

    return log.child({
        domain,
        requestId,
        method: request.method,
        url: new URL(request.url).pathname,
        ip,
        userAgent: request.headers.get("user-agent")?.substring(0, 100),
    });
}

// ════════════════════════════════════════════════════════════════════════
// Compatibility Layer — Drop-in console.* replacement
// ════════════════════════════════════════════════════════════════════════

/**
 * Captures unhandled console.* calls in production and routes them
 * through the structured logger. This ensures no log line
 * bypasses the structured pipeline.
 *
 * NOTE: Only activated in production to avoid interfering with
 * Next.js dev server output.
 */
export function interceptConsoleInProduction(): void {
    if (process.env.NODE_ENV !== "production") return;

    const fallbackLogger = log.child({ domain: "console" });

    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
    };

    console.log = (...args: unknown[]) => {
        fallbackLogger.info({ raw: args.map(String).join(" ") }, "console.log");
    };

    console.error = (...args: unknown[]) => {
        fallbackLogger.error({ raw: args.map(String).join(" ") }, "console.error");
    };

    console.warn = (...args: unknown[]) => {
        fallbackLogger.warn({ raw: args.map(String).join(" ") }, "console.warn");
    };

    console.info = (...args: unknown[]) => {
        fallbackLogger.info({ raw: args.map(String).join(" ") }, "console.info");
    };

    // Stash originals for emergency debugging
    (globalThis as Record<string, unknown>).__originalConsole = originalConsole;
}
