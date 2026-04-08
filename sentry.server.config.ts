/**
 * Sentry Server-Side Configuration
 *
 * Initializes error monitoring and performance tracing
 * for the Node.js server environment.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: process.env.NODE_ENV === "production",

    // Performance Monitoring — sample 10% of server transactions
    tracesSampleRate: 0.1,

    environment: process.env.NODE_ENV,

    // Filter Next.js internal navigation signals
    ignoreErrors: [
        "NEXT_NOT_FOUND",
        "NEXT_REDIRECT",
    ],
});
