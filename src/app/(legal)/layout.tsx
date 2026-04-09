import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Legal Pages Layout — Dark prose container
   ═══════════════════════════════════════════════════════════════ */

export default function LegalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ background: "#06060B", minHeight: "100vh" }}>
            {/* Minimal top bar */}
            <div className="max-w-3xl mx-auto px-6 pt-10 pb-6">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm no-underline transition-colors duration-200"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Home
                </Link>
            </div>

            {/* Prose content */}
            <main className="max-w-3xl mx-auto px-6 pb-20">
                <div
                    className="prose prose-invert prose-sm max-w-none"
                    style={{
                        "--tw-prose-headings": "#F0F0F5",
                        "--tw-prose-body": "rgba(255,255,255,0.6)",
                        "--tw-prose-bold": "rgba(255,255,255,0.85)",
                        "--tw-prose-links": "#818CF8",
                        "--tw-prose-counters": "rgba(255,255,255,0.35)",
                        "--tw-prose-bullets": "rgba(255,255,255,0.2)",
                        "--tw-prose-hr": "rgba(255,255,255,0.06)",
                    } as React.CSSProperties}
                >
                    {children}
                </div>
            </main>

            {/* Minimal footer */}
            <div
                className="border-t px-6 py-8 text-center"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                    © 2026 PeopleFlow. Architected by Sharif Mohammad Nasrullah. All rights reserved.
                </p>
            </div>
        </div>
    );
}
