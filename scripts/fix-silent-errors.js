#!/usr/bin/env node
/**
 * Batch fix: Add useToast to pages that silently swallow fetch errors.
 * 
 * For each file:
 * 1. Check if useToast is imported — if not, add the import
 * 2. Check if addToast is destructured — if not, add it
 * 3. Replace console.error("...:", error) with console.error + addToast
 */

const fs = require("fs");
const path = require("path");

const files = [
    "src/app/(ess)/ess/attendance/page.tsx",
    "src/app/(ess)/ess/payslips/page.tsx",
    "src/app/(ess)/ess/expenses/page.tsx",
    "src/app/(ess)/ess/announcements/page.tsx",
    "src/app/(ess)/ess/loans/page.tsx",
    "src/app/(ess)/ess/performance/page.tsx",
    "src/app/(manager)/manager/dashboard/page.tsx",
    "src/app/(manager)/manager/team/page.tsx",
    "src/app/(manager)/manager/leaves/page.tsx",
    "src/app/(manager)/manager/attendance/page.tsx",
    "src/app/(dashboard)/departments/page.tsx",
    "src/app/(dashboard)/leaves/types/page.tsx",
];

let fixed = 0;

for (const relPath of files) {
    const fullPath = path.join(__dirname, "..", relPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`Skip (not found): ${relPath}`);
        continue;
    }

    let content = fs.readFileSync(fullPath, "utf8");
    let modified = false;

    // 1. Add useToast import if not present
    if (!content.includes("useToast")) {
        // Find the last import line
        const importMatch = content.match(/^import.*from.*["'][^"']+["'];?\s*$/gm);
        if (importMatch) {
            const lastImport = importMatch[importMatch.length - 1];
            const toastImport = 'import { useToast } from "@/components/ui/toast";';
            content = content.replace(lastImport, lastImport + "\n" + toastImport);
            modified = true;
        }
    }

    // 2. Add addToast destructuring if not present
    // Look for the first const declaration inside the component function
    if (!content.includes("addToast") && content.includes("useToast")) {
        // Find the component function declaration
        const componentMatch = content.match(/(?:export\s+default\s+function|function)\s+\w+\s*\([^)]*\)\s*\{/);
        if (componentMatch) {
            const insertPos = content.indexOf(componentMatch[0]) + componentMatch[0].length;
            const afterInsert = content.substring(insertPos);
            // Skip whitespace/newlines
            const nextLineMatch = afterInsert.match(/^\s*\n/);
            const insertAt = insertPos + (nextLineMatch ? nextLineMatch[0].length : 0);
            content = content.substring(0, insertAt) + 
                '    const { addToast } = useToast();\n' + 
                content.substring(insertAt);
            modified = true;
        }
    }

    // 3. Replace console.error patterns with addToast
    if (content.includes("addToast")) {
        // Pattern: console.error("...:", error); → console.error("...:", error); addToast({ title: "...", type: "error" });
        content = content.replace(
            /console\.error\(["']([^"']+)["'],?\s*(error|err)?\);?\s*\n/g,
            (match, msg, errVar) => {
                return `${match.trim()}\n                addToast({ title: "Failed to load data. Please refresh the page.", type: "error" });\n`;
            }
        );
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`Fixed: ${relPath}`);
        fixed++;
    } else {
        console.log(`No changes: ${relPath}`);
    }
}

console.log(`\n${fixed} files fixed.`);
