/**
 * Sentry Client-Side Configuration (Placeholder)
 *
 * @sentry/nextjs is not currently installed.
 * This file is kept as a placeholder for future Sentry integration.
 * To enable: npm install @sentry/nextjs, then uncomment the init block below.
 */

// import * as Sentry from "@sentry/nextjs";
//
// Sentry.init({
//     dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
//     enabled: process.env.NODE_ENV === "production",
//     tracesSampleRate: 0.1,
//     replaysSessionSampleRate: 0.01,
//     replaysOnErrorSampleRate: 1.0,
//     integrations: [
//         Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
//         Sentry.browserTracingIntegration(),
//     ],
//     environment: process.env.NODE_ENV,
//     ignoreErrors: [
//         "top.GLOBALS", "ResizeObserver loop",
//         "Failed to fetch", "NetworkError", "Load failed",
//         "NEXT_NOT_FOUND", "NEXT_REDIRECT",
//     ],
//     beforeSend(event) {
//         if (event.request?.cookies) delete event.request.cookies;
//         return event;
//     },
// });

export {};
