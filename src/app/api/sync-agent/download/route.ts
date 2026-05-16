import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { apiLogger } from "@/lib/logger";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";

/**
 * GET /api/sync-agent/download — Serves the sync agent script as a download
 * 
 * This is the frictionless distribution mechanism:
 * 1. HR Admin generates API key in dashboard
 * 2. Clicks "Download Agent" 
 * 3. Gets a ready-to-run .js file with cloud URL pre-configured
 * 4. Runs: node peopleflow-sync.js
 * 
 * Query params:
 *   ?key=pf_sync_xxx — Optional: pre-bake the API key into the script
 */
export async function GET(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;

    try {
        const url = new URL(req.url);
        const apiKey = url.searchParams.get("key") || "";
        if (apiKey && !apiKey.startsWith("pf_sync_")) {
            return new NextResponse("Invalid sync key format", { status: 400 });
        }
        
        // Determine the cloud URL from the request
        const proto = req.headers.get("x-forwarded-proto") || "https";
        const host = req.headers.get("host") || "peopleflowbd.online";
        const cloudUrl = `${proto}://${host}`;

        // Read the sync agent template
        let script: string;
        try {
            script = readFileSync(
                join(process.cwd(), "tools", "sync-agent", "peopleflow-sync.js"),
                "utf8"
            );
        } catch {
            // Fallback: serve an inline minimal version
            script = generateInlineAgent();
        }

        // Pre-configure the script: inject the cloud URL and optionally the API key
        // Replace the interactive config-loading section with pre-baked values
        const configOverride = `
// ── Pre-configured by PeopleFlow Dashboard ──────────────────────────
const PRE_CONFIGURED_URL = ${JSON.stringify(cloudUrl)};
const PRE_CONFIGURED_KEY = ${JSON.stringify(apiKey)};
`;
        // Inject after the constants section
        script = script.replace(
            "// ── Colorful Terminal Output",
            configOverride + "\n// ── Colorful Terminal Output"
        );

        // Return as downloadable file
        return new NextResponse(script, {
            status: 200,
            headers: {
                "Content-Type": "application/javascript; charset=utf-8",
                "Content-Disposition": 'attachment; filename="peopleflow-sync.js"',
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        apiLogger.error({ err: error }, "DOWNLOAD_AGENT_ERROR");
        return new NextResponse("Failed to generate agent script", { status: 500 });
    }
}

function generateInlineAgent(): string {
    // Minimal fallback — shouldn't normally be needed
    return `#!/usr/bin/env node
console.log("PeopleFlow Sync Agent");
console.error("Error: Agent template not found. Please contact support.");
process.exit(1);
`;
}
