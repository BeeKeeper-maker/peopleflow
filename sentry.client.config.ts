/**
 * Sentry Client-Side Configuration
 *
 * Initializes error monitoring, performance tracing, and session replay
 * for the browser environment.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NODE_ENV === "production",

    // Performance Monitoring — sample 10% of transactions
    tracesSampleRate: 0.1,

    // Session Replay — 1% of sessions, 100% of errored sessions
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }),
        Sentry.browserTracingIntegration(),
    ],

    environment: process.env.NODE_ENV,

    // Filter out noisy, non-actionable errors
    ignoreErrors: [
        "top.GLOBALS",
        "ResizeObserver loop",
        "Failed to fetch",
        "NetworkError",
        "Load failed",
        "NEXT_NOT_FOUND",
        "NEXT_REDIRECT",
        "AbortError",
        "ChunkLoadError",
    ],

    // Scrub sensitive data before sending
    beforeSend(event) {
        if (event.request?.cookies) {
            delete event.request.cookies;
        }
        return event;
    },
});
