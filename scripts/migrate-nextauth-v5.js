#!/usr/bin/env node
/**
 * Batch Migration: NextAuth v4 → Auth.js v5
 *
 * Replaces in all API route files:
 *   - import { getServerSession } from "next-auth"  → removed
 *   - import { authOptions } from "@/lib/auth"       → import { auth } from "@/lib/auth"
 *   - getServerSession(authOptions)                   → auth()
 *   - import { platformAuthOptions } from ...         → import { platformAuth } from ...
 *   - getServerSession(platformAuthOptions)           → platformAuth()
 */

const fs = require("fs");
const path = require("path");

const API_DIR = path.resolve(__dirname, "../src/app/api");
const SRC_DIR = path.resolve(__dirname, "../src");

let totalFiles = 0;
let modifiedFiles = 0;

function processFile(filePath) {
    let content = fs.readFileSync(filePath, "utf-8");
    const original = content;

    // ── Tenant Auth Migration ──

    // Remove: import { getServerSession } from "next-auth";
    content = content.replace(
        /import\s*\{\s*getServerSession\s*\}\s*from\s*["']next-auth["'];\s*\n/g,
        ""
    );

    // Replace authOptions import with auth import (if not already importing auth)
    if (content.includes('authOptions') && content.includes('@/lib/auth')) {
        // Replace import { authOptions } from "@/lib/auth" with { auth }
        content = content.replace(
            /import\s*\{([^}]*)\bauthOptions\b([^}]*)\}\s*from\s*["']@\/lib\/auth["']/g,
            (match, before, after) => {
                // Remove authOptions, add auth if not present
                let imports = (before + after)
                    .split(",")
                    .map(s => s.trim())
                    .filter(s => s && s !== "authOptions");
                if (!imports.includes("auth")) imports.unshift("auth");
                return `import { ${imports.join(", ")} } from "@/lib/auth"`;
            }
        );
    }

    // Replace getServerSession(authOptions) → auth()
    content = content.replace(/getServerSession\s*\(\s*authOptions\s*\)/g, "auth()");

    // Also handle: await getServerSession(authOptions)  already covered since we replace the call

    // ── Platform Auth Migration ──

    // Replace platformAuthOptions import
    content = content.replace(
        /import\s*\{([^}]*)\bplatformAuthOptions\b([^}]*)\}\s*from\s*["']@\/lib\/platform-auth["']/g,
        (match, before, after) => {
            let imports = (before + after)
                .split(",")
                .map(s => s.trim())
                .filter(s => s && s !== "platformAuthOptions");
            if (!imports.includes("platformAuth")) imports.unshift("platformAuth");
            return `import { ${imports.join(", ")} } from "@/lib/platform-auth"`;
        }
    );

    // Replace getServerSession(platformAuthOptions) → platformAuth()
    content = content.replace(/getServerSession\s*\(\s*platformAuthOptions\s*\)/g, "platformAuth()");

    // Remove orphaned next-auth imports (if nothing else needed from next-auth)
    content = content.replace(
        /import\s*\{\s*\}\s*from\s*["']next-auth["'];\s*\n/g,
        ""
    );

    // Clean up any remaining standalone getServerSession import
    content = content.replace(
        /import\s*\{\s*getServerSession\s*\}\s*from\s*["']next-auth\/next["'];\s*\n/g,
        ""
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content, "utf-8");
        modifiedFiles++;
        console.log(`  ✅ ${path.relative(SRC_DIR, filePath)}`);
    }
    totalFiles++;
}

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkDir(fullPath);
        } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
            processFile(fullPath);
        }
    }
}

console.log("🔄 Migrating NextAuth v4 → Auth.js v5...\n");
walkDir(API_DIR);

// Also process lib files and page components that might use getServerSession
const LIB_DIR = path.resolve(__dirname, "../src/lib");
const APP_DIR = path.resolve(__dirname, "../src/app");

// Process specific lib files
["api-key-auth.ts", "impersonation.ts", "session-security.ts"].forEach(f => {
    const fp = path.join(LIB_DIR, f);
    if (fs.existsSync(fp)) processFile(fp);
});

// Process page components
function walkPages(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "api") {
            walkPages(fullPath);
        } else if (entry.name === "page.tsx" || entry.name === "layout.tsx") {
            processFile(fullPath);
        }
    }
}
walkPages(APP_DIR);

console.log(`\n✅ Done: ${modifiedFiles}/${totalFiles} files modified.`);
