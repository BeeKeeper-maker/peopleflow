/**
 * Batch Console-to-Pino Migration Script
 * 
 * Replaces all console.log/error/warn/info calls in API routes
 * with structured Pino apiLogger calls.
 * 
 * Rules:
 *   - Adds `import { apiLogger } from "@/lib/logger";` if not present
 *   - console.log("msg") → apiLogger.info("msg")
 *   - console.error("msg", error) → apiLogger.error({ err: error }, "msg")
 *   - console.warn("msg") → apiLogger.warn("msg")
 *   - console.info("msg") → apiLogger.info("msg")
 *   - Special: console.error("string", errorVar) → apiLogger.error({ err: errorVar }, "string")
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Map domains to logger names based on path patterns
function getLoggerForPath(filePath) {
    if (filePath.includes("/api/auth/")) return { name: "authLogger", import: 'import { authLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/attendance/")) return { name: "attendanceLogger", import: 'import { attendanceLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/payroll/") || filePath.includes("/api/payslips/")) return { name: "payrollLogger", import: 'import { payrollLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/biometric")) return { name: "biometricLogger", import: 'import { biometricLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/leave")) return { name: "leaveLogger", import: 'import { leaveLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/v1/")) return { name: "apiLogger", import: 'import { apiLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/webhooks/")) return { name: "billingLogger", import: 'import { billingLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/audit")) return { name: "auditLogger", import: 'import { auditLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/cron/")) return { name: "cronLogger", import: 'import { cronLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/upload") || filePath.includes("/api/uploads")) return { name: "storageLogger", import: 'import { storageLogger } from "@/lib/logger";' };
    if (filePath.includes("/api/export")) return { name: "exportLogger", import: 'import { exportLogger } from "@/lib/logger";' };
    return { name: "apiLogger", import: 'import { apiLogger } from "@/lib/logger";' };
}

function migrateFile(filePath) {
    let content = fs.readFileSync(filePath, "utf8");
    const originalContent = content;
    
    // Skip if no console calls
    if (!/console\.(log|error|warn|info)\s*\(/.test(content)) {
        return { changed: false, file: filePath };
    }

    const logger = getLoggerForPath(filePath);
    const loggerName = logger.name;

    // Check if already has a logger import from @/lib/logger
    const hasLoggerImport = /import\s+\{[^}]*\}\s+from\s+["']@\/lib\/logger["']/.test(content);
    
    // Add logger import if needed
    if (!hasLoggerImport) {
        // Find the last import statement and add after it
        const importRegex = /^import\s+.+$/gm;
        let lastImportIndex = -1;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            // Handle multi-line imports
            let end = match.index + match[0].length;
            if (match[0].includes("{") && !match[0].includes("}")) {
                const closeBrace = content.indexOf("}", end);
                if (closeBrace !== -1) {
                    const semiColon = content.indexOf(";", closeBrace);
                    if (semiColon !== -1) end = semiColon + 1;
                }
            }
            lastImportIndex = end;
        }
        
        if (lastImportIndex > -1) {
            content = content.slice(0, lastImportIndex) + "\n" + logger.import + content.slice(lastImportIndex);
        } else {
            content = logger.import + "\n" + content;
        }
    } else {
        // Check if the specific logger is already imported
        const importMatch = content.match(/import\s+\{([^}]*)\}\s+from\s+["']@\/lib\/logger["']/);
        if (importMatch && !importMatch[1].includes(loggerName)) {
            const existingImports = importMatch[1].trim();
            content = content.replace(
                importMatch[0],
                `import { ${existingImports}, ${loggerName} } from "@/lib/logger"`
            );
        }
    }

    // Replace console.error("msg", error) → logger.error({ err: error }, "msg")
    // Pattern: console.error("string", variable)
    content = content.replace(
        /console\.error\(\s*(["`'][^"`']*["`'])\s*,\s*(\w+(?:\.\w+)*)\s*\)/g,
        `${loggerName}.error({ err: $2 }, $1)`
    );
    
    // Replace remaining console.error("msg") → logger.error("msg")
    content = content.replace(
        /console\.error\(/g,
        `${loggerName}.error(`
    );

    // Replace console.log → logger.info  
    content = content.replace(
        /console\.log\(/g,
        `${loggerName}.info(`
    );

    // Replace console.warn → logger.warn
    content = content.replace(
        /console\.warn\(/g,
        `${loggerName}.warn(`
    );

    // Replace console.info → logger.info
    content = content.replace(
        /console\.info\(/g,
        `${loggerName}.info(`
    );

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, "utf8");
        return { changed: true, file: filePath, logger: loggerName };
    }

    return { changed: false, file: filePath };
}

// Main execution
const apiRoutes = glob.sync("src/app/api/**/route.ts", { cwd: process.cwd() });
let changedCount = 0;
let skippedCount = 0;

for (const route of apiRoutes) {
    const fullPath = path.resolve(route);
    const result = migrateFile(fullPath);
    if (result.changed) {
        changedCount++;
        console.log(`✅ ${route} → ${result.logger}`);
    } else {
        skippedCount++;
    }
}

console.log(`\n━━━ Migration Complete ━━━`);
console.log(`Changed: ${changedCount} files`);
console.log(`Skipped: ${skippedCount} files (no console calls)`);
console.log(`Total:   ${apiRoutes.length} files scanned`);

// Verify zero remaining
const { execSync } = require("child_process");
const remaining = execSync(`grep -rl 'console\\.' src/app/api/ 2>/dev/null | wc -l`).toString().trim();
console.log(`Remaining console calls: ${remaining} files`);
