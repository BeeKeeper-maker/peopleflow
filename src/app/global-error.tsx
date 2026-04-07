"use client";

/**
 * Global Error Boundary — Must NOT use any providers (next-intl, session, etc.)
 * This page renders outside <html> providers, so no useContext() is available.
 */
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
            <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0, backgroundColor: "#0a0a0a", color: "#fafafa" }}>
                <div style={{ textAlign: "center", maxWidth: 480, padding: 32 }}>
                    <h1 style={{ fontSize: 48, marginBottom: 8 }}>500</h1>
                    <h2 style={{ fontSize: 20, fontWeight: 400, marginBottom: 24, opacity: 0.7 }}>Something went wrong</h2>
                    <p style={{ fontSize: 14, opacity: 0.5, marginBottom: 32 }}>
                        {error.digest ? `Error ID: ${error.digest}` : "An unexpected error occurred."}
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{ padding: "12px 24px", fontSize: 14, fontWeight: 600, backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}
                    >
                        Try Again
                    </button>
                </div>
            </body>
        </html>
    );
}
