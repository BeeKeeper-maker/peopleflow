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
        const host = req.headers.get("host") || "drdf.ailearnersbd.com";
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

        // Patch getConfig to use pre-configured values
        const patchedGetConfig = `
async function getConfig() {
    const args = parseArgs();
    let config = loadConfig();

    // If CLI args provided, use them
    if (args.url && args.key && args.deviceIp) {
        config = {
            cloudUrl: args.url.replace(/\\/$/, ""),
            apiKey: args.key,
            deviceIp: args.deviceIp,
            devicePort: parseInt(args.devicePort) || ZKTECO_PORT,
            syncInterval: parseInt(args.syncInterval) || SYNC_INTERVAL_MS / 60000,
        };
        saveConfig(config);
        return config;
    }

    // If config file exists, ask to reuse
    if (config && config.cloudUrl && config.apiKey && config.deviceIp) {
        logInfo(\`Found existing config: \${config.cloudUrl} → \${config.deviceIp}\`);
        const reuse = await prompt("Use existing config? (Y/n):");
        if (reuse.toLowerCase() !== "n") {
            return config;
        }
    }

    // Interactive setup with pre-configured values
    apiLogger.info(\`\\n\${c.yellow}\${c.bold}─── First-Time Setup ───\${c.reset}\\n\`);

    const defaultUrl = PRE_CONFIGURED_URL || "";
    const defaultKey = PRE_CONFIGURED_KEY || "";

    const cloudUrl = defaultUrl || await prompt("Enter your PeopleFlow URL (e.g., https://drdf.ailearnersbd.com):");
    if (defaultUrl) logSuccess(\`Cloud URL: \${defaultUrl} (pre-configured)\`);
    
    let apiKeyVal = defaultKey;
    if (!apiKeyVal) {
        apiKeyVal = await prompt("Paste your API Key (from Dashboard → Devices → Sync Agent):");
    } else {
        logSuccess("API Key: pre-configured ✓");
    }
    
    const deviceIp = await prompt("Enter ZKTeco device IP address (e.g., 192.168.1.201):");
    const devicePortInput = await prompt(\`Enter device port (default \${ZKTECO_PORT}):\`);
    const intervalInput = await prompt("Sync interval in minutes (default 5):");

    config = {
        cloudUrl: cloudUrl.replace(/\\/$/, ""),
        apiKey: apiKeyVal,
        deviceIp,
        devicePort: parseInt(devicePortInput) || ZKTECO_PORT,
        syncInterval: parseInt(intervalInput) || 5,
    };

    saveConfig(config);
    return config;
}`;

        // Replace the existing getConfig function
        script = script.replace(
            /async function getConfig\(\) \{[\s\S]*?^}/m,
            patchedGetConfig
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
