#!/usr/bin/env node
/**
 * Batch replace browser-native confirm() with useConfirmDialog hook.
 * 
 * For each file:
 * 1. Add useConfirmDialog import
 * 2. Add const { confirm, dialog: confirmDialog } = useConfirmDialog()
 * 3. Replace confirm() calls with await confirm({ ... })
 * 4. Add {confirmDialog} to JSX return
 */

const fs = require("fs");
const path = require("path");

const fixes = [
    {
        file: "src/app/(ess)/ess/leaves/page.tsx",
        oldConfirm: 'if (!confirm(t("cancelConfirm"))) return;',
        newConfirm: `const ok = await confirm({ title: t("cancelConfirm"), description: "This leave application will be cancelled.", confirmLabel: "Cancel Leave", variant: "destructive" }); if (!ok) return;`,
        hasToast: true,
    },
    {
        file: "src/app/(dashboard)/devices/page.tsx",
        oldConfirm: 'if (!confirm(t("confirmDelete"))) return;',
        newConfirm: `const ok = await confirm({ title: t("confirmDelete"), description: "This device will be removed from the system.", confirmLabel: "Delete", variant: "destructive" }); if (!ok) return;`,
        hasToast: true,
    },
    {
        file: "src/app/(dashboard)/organization/branches/page.tsx",
        oldConfirm: "if (!confirm(t('confirmDelete'))) return",
        newConfirm: `const ok = await confirm({ title: t('confirmDelete'), description: "This branch will be permanently removed.", confirmLabel: "Delete", variant: "destructive" }); if (!ok) return`,
        hasToast: true,
    },
    {
        file: "src/app/(dashboard)/organization/holidays/page.tsx",
        oldConfirm: "if (!confirm(t('confirmDelete'))) return",
        newConfirm: `const ok = await confirm({ title: t('confirmDelete'), description: "This holiday will be permanently removed.", confirmLabel: "Delete", variant: "destructive" }); if (!ok) return`,
        hasToast: true,
    },
    {
        file: "src/app/(dashboard)/settings/custom-fields/page.tsx",
        oldConfirm: 'if (!confirm(`Deactivate field "${field.label}"? Existing values will be preserved.`)) return;',
        newConfirm: `const ok = await confirm({ title: \`Deactivate field "${field.label}"?\`, description: "Existing values will be preserved. The field will be hidden from forms.", confirmLabel: "Deactivate", variant: "destructive" }); if (!ok) return;`,
        hasToast: true,
    },
    {
        file: "src/app/(dashboard)/approval-workflows/page.tsx",
        oldConfirm: 'if (!confirm(t("confirmDelete"))) return;',
        newConfirm: `const ok = await confirm({ title: t("confirmDelete"), description: "This workflow configuration will be permanently removed.", confirmLabel: "Delete", variant: "destructive" }); if (!ok) return;`,
        hasToast: true,
    },
    {
        file: "src/app/(dashboard)/payroll/page.tsx",
        oldConfirm: 'if (!confirm(`Approve ${draftSlips.length} draft slip(s) for ${months[processMonth - 1]} ${processYear}?`)) return',
        newConfirm: `const ok = await confirm({ title: \`Approve ${draftSlips.length} draft slip(s)?\`, description: \`All draft slips for ${months[processMonth - 1]} ${processYear} will be approved. This action can be reversed later.\`, confirmLabel: "Approve All", variant: "default" }); if (!ok) return`,
        hasToast: true,
    },
    {
        file: "src/app/(dashboard)/recruitment/jobs/[id]/page.tsx",
        oldConfirm: 'if (!job || !confirm(`Delete job posting \u201c${job.title}\u201d?`)) return',
        newConfirm: 'if (!job) return; const ok = await confirm({ title: `Delete job posting \u201c${job.title}\u201d?`, description: "This job posting and all its applications will be permanently removed.", confirmLabel: "Delete", variant: "destructive" }); if (!ok) return',
        hasToast: false,
    },
    {
        file: "src/app/(dashboard)/recruitment/pipeline/page.tsx",
        oldConfirm: 'if (!confirm("Reject this candidate?")) return;',
        newConfirm: 'const ok = await confirm({ title: "Reject this candidate?", description: "The candidate will be moved to the rejected stage. This can be changed later.", confirmLabel: "Reject", variant: "destructive" }); if (!ok) return;',
        hasToast: true,
        secondOldConfirm: 'if (!confirm("Onboard this candidate as an employee?")) return;',
        secondNewConfirm: 'const ok2 = await confirm({ title: "Onboard this candidate?", description: "An employee record will be created and an invitation email will be sent.", confirmLabel: "Hire & Onboard", variant: "default" }); if (!ok2) return;',
    },
];

let fixed = 0;

for (const fix of fixes) {
    const fullPath = path.join(__dirname, "..", fix.file);
    if (!fs.existsSync(fullPath)) {
        console.log(`Skip (not found): ${fix.file}`);
        continue;
    }

    let content = fs.readFileSync(fullPath, "utf8");
    let modified = false;

    // 1. Add import if not present
    if (!content.includes("useConfirmDialog")) {
        // Find useToast import line and add after it
        const toastImport = 'import { useToast } from "@/components/ui/toast";';
        if (content.includes(toastImport)) {
            content = content.replace(
                toastImport,
                toastImport + '\nimport { useConfirmDialog } from "@/hooks/use-confirm-dialog";'
            );
            modified = true;
        } else {
            // Find any import line and add after last import
            const imports = content.match(/^import .+$/gm);
            if (imports && imports.length > 0) {
                const lastImport = imports[imports.length - 1];
                content = content.replace(
                    lastImport,
                    lastImport + '\nimport { useConfirmDialog } from "@/hooks/use-confirm-dialog";'
                );
                modified = true;
            }
        }
    }

    // 2. Add hook destructuring if not present
    if (!content.includes("confirmDialog")) {
        // Find the first const { addToast } = useToast() line
        const toastLine = content.match(/const \{ addToast \} = useToast\(\);?/);
        if (toastLine) {
            content = content.replace(
                toastLine[0],
                toastLine[0] + '\n    const { confirm, dialog: confirmDialog } = useConfirmDialog();'
            );
            modified = true;
        }
    }

    // 3. Replace confirm() calls
    if (content.includes(fix.oldConfirm)) {
        content = content.replace(fix.oldConfirm, fix.newConfirm);
        modified = true;
    }

    // Handle second confirm() in pipeline page
    if (fix.secondOldConfirm && content.includes(fix.secondOldConfirm)) {
        content = content.replace(fix.secondOldConfirm, fix.secondNewConfirm);
        modified = true;
    }

    // 4. Add {confirmDialog} to JSX — find last </div> before closing }
    if (modified && !content.includes("{confirmDialog}")) {
        // Find the last closing </div> followed by ) and }
        const match = content.match(/(\s*<\/div>\s*\)\s*\})$/);
        if (match) {
            content = content.replace(
                /(\s*<\/div>\s*\)\s*\})$/,
                '\n            {confirmDialog}\n        </div>\n    )\n}'
            );
        } else {
            // Try alternate pattern
            const match2 = content.match(/(\s*<\/div>\s*\n\s*\)\s*\n\})$/);
            if (match2) {
                content = content.replace(
                    /(\s*<\/div>\s*\n\s*\)\s*\n\})$/,
                    '\n            {confirmDialog}\n        </div>\n    )\n}'
                );
            }
        }
    }

    if (modified) {
        fs.writeFileSync(fullPath, content, "utf8");
        console.log(`Fixed: ${fix.file}`);
        fixed++;
    } else {
        console.log(`No changes: ${fix.file}`);
    }
}

console.log(`\n${fixed} files fixed.`);
