/**
 * Next.js Instrumentation Hook
 *
 * This file is auto-loaded by Next.js at server startup.
 * We use it to:
 *   1. Activate the structured logger's console interceptor
 *   2. Validate environment variables
 *
 * Sentry instrumentation is currently disabled.
 * To re-enable, install @sentry/nextjs and uncomment Sentry imports.
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // Activate structured logging console interception in production
        const { interceptConsoleInProduction } = await import("@/lib/logger");
        interceptConsoleInProduction();
    }
}
