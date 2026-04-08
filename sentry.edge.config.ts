/**
 * Sentry Edge Runtime Configuration
 *
 * Initializes error monitoring for Edge Runtime (middleware, edge API routes).
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NODE_ENV === "production",

    // Lower sample rate for edge — high volume, low complexity
    tracesSampleRate: 0.05,

    environment: process.env.NODE_ENV,
});
