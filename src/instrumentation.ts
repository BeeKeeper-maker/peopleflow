/**
 * Next.js Instrumentation Hook
 *
 * This file is auto-loaded by Next.js at server startup.
 * We use it to:
 *   1. Initialize Sentry for error monitoring
 *   2. Activate the structured logger's console interceptor
 *   3. Validate environment variables
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        // Initialize Sentry server-side monitoring
        const Sentry = await import("@sentry/nextjs");
        // sentry.server.config.ts is auto-loaded by the SDK via next.config withSentryConfig

        // Activate structured logging console interception in production
        const { interceptConsoleInProduction } = await import("@/lib/logger");
        interceptConsoleInProduction();
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        // sentry.edge.config.ts is auto-loaded by the SDK via next.config withSentryConfig
        await import("@sentry/nextjs");
    }
}

export const onRequestError = async (
    error: { digest: string },
    request: {
        path: string;
        method: string;
        headers: { [key: string]: string };
    },
    context: { routerKind: string; routePath: string; routeType: string; renderSource: string }
) => {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(error, request, context);
};
