"use client";

/**
 * Global Error Boundary
 *
 * This is a pure client component that handles uncaught errors at the root layout level.
 * CRITICAL: This file must NOT import next-intl or any server-side APIs.
 * During Next.js static generation (prerendering), there is no request context,
 * so server-dependent imports would crash the build.
 *
 * Sentry.captureException is called to report the error, then a minimal
 * fallback UI is rendered.
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en">
            <body
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    background: "#0a0a0f",
                    color: "#e2e8f0",
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    margin: 0,
                }}
            >
                <div style={{ textAlign: "center", maxWidth: 480, padding: 32 }}>
                    <h1 style={{ fontSize: 24, marginBottom: 8 }}>
                        Something went wrong
                    </h1>
                    <p
                        style={{
                            fontSize: 14,
                            color: "#94a3b8",
                            marginBottom: 24,
                        }}
                    >
                        An unexpected error occurred. Our team has been notified.
                    </p>
                    {error.digest && (
                        <p
                            style={{
                                fontSize: 12,
                                color: "#64748b",
                                marginBottom: 24,
                                fontFamily: "monospace",
                            }}
                        >
                            Error ID: {error.digest}
                        </p>
                    )}
                    <button
                        onClick={reset}
                        style={{
                            padding: "10px 24px",
                            borderRadius: 8,
                            border: "none",
                            background: "#6366f1",
                            color: "white",
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Try Again
                    </button>
                </div>
            </body>
        </html>
    );
}
