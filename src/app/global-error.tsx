"use client";

/**
 * PeopleFlow — Global Error Boundary
 *
 * Replaces the root layout when the root layout itself throws during
 * render. CRITICAL constraints:
 *   1. Must NOT import any component that uses hooks (it replaces the
 *      root layout, so providers/contexts are not mounted).
 *   2. Must NOT import next-intl or other server-dependent modules
 *      (no request context during static generation).
 *   3. Must define its own <html>/<body> tags.
 *
 * Visual treatment mirrors `ErrorFallback` (`@/components/error-fallback`)
 * as closely as possible without hooks: a centered card with the same
 * gradient accent, error digest badge, and "Try Again" action. Colors
 * use design-system CSS variables (defined in `globals.css`) with
 * hardcoded fallbacks so the UI still renders if globals.css fails to
 * load.
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
            <head>
                {/* Restore theme class so CSS variables resolve correctly */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    var theme = localStorage.getItem('peopleflow-theme') || 'dark';
                                    if (theme === 'system') {
                                        theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                                    }
                                    document.documentElement.classList.remove('light', 'dark');
                                    document.documentElement.classList.add(theme);
                                } catch(e) {
                                    document.documentElement.classList.add('dark');
                                }
                            })();
                        `,
                    }}
                />
            </head>
            <body
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    margin: 0,
                    padding: "24px",
                    // Design-system tokens (with fallbacks in case globals.css is unavailable)
                    background: "var(--bg-primary, #0A0A0F)",
                    color: "var(--text-primary, #FFFFFF)",
                    fontFamily:
                        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
            >
                <div
                    style={{
                        position: "relative",
                        width: "100%",
                        maxWidth: "480px",
                    }}
                >
                    {/* Card */}
                    <div
                        style={{
                            position: "relative",
                            padding: "32px",
                            borderRadius: "16px",
                            background: "var(--card-bg, rgba(255,255,255,0.02))",
                            border:
                                "1px solid var(--card-border, rgba(255,255,255,0.06))",
                            boxShadow:
                                "0 20px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.3)",
                            backdropFilter: "blur(12px)",
                            textAlign: "center",
                        }}
                    >
                        {/* Icon */}
                        <div
                            style={{
                                width: "64px",
                                height: "64px",
                                margin: "0 auto 24px",
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background:
                                    "linear-gradient(135deg, rgba(239,68,68,0.10), rgba(249,115,22,0.10))",
                                border: "1px solid rgba(239,68,68,0.20)",
                                fontSize: "32px",
                                lineHeight: 1,
                            }}
                            aria-hidden
                        >
                            ⚠
                        </div>

                        <h1
                            style={{
                                fontSize: "20px",
                                fontWeight: 600,
                                margin: "0 0 8px",
                                color: "var(--text-primary, #FFFFFF)",
                            }}
                        >
                            Something went wrong
                        </h1>
                        <p
                            style={{
                                fontSize: "14px",
                                margin: "0 0 24px",
                                color: "var(--text-secondary, #A1A1AA)",
                                lineHeight: 1.5,
                            }}
                        >
                            An unexpected error occurred. Our team has been
                            automatically notified and is working on a fix.
                        </p>

                        {error.digest && (
                            <p
                                style={{
                                    display: "inline-block",
                                    margin: "0 0 24px",
                                    padding: "4px 12px",
                                    borderRadius: "999px",
                                    fontSize: "11px",
                                    fontFamily: "monospace",
                                    background: "var(--hover-bg, rgba(255,255,255,0.04))",
                                    border:
                                        "1px solid var(--card-border, rgba(255,255,255,0.06))",
                                    color: "var(--text-tertiary, #71717A)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.05em",
                                }}
                            >
                                Error ID: {error.digest}
                            </p>
                        )}

                        <button
                            onClick={reset}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                padding: "10px 24px",
                                borderRadius: "8px",
                                border: "none",
                                background:
                                    "var(--color-primary-500, #1677FF)",
                                color: "#FFFFFF",
                                fontSize: "14px",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "opacity 200ms ease",
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
