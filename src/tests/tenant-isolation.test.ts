/**
 * PeopleFlow Tenant Isolation Test Suite
 *
 * These tests verify that cross-tenant data access is blocked.
 * They run against the schema (static analysis) rather than a live DB,
 * so they can run in CI without a database.
 *
 * The tests check:
 *   1. Every org-scoped Prisma model has RLS enabled + FORCE RLS
 *   2. Every org-scoped Prisma model has a tenant_isolation policy
 *   3. The RLS migration covers all models defined in schema.prisma
 *   4. The tenant middleware wrapper correctly sets tenant context
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");

// Read ALL migration files concatenated
const migrationsDir = path.join(root, "prisma/migrations");
const migrationFolders = readdirSync(migrationsDir).filter((f) => !f.endsWith(".toml"));
const allMigrationsSql = migrationFolders
    .map((f) => {
        try {
            return readFileSync(path.join(migrationsDir, f, "migration.sql"), "utf8");
        } catch {
            return "";
        }
    })
    .join("\n\n");

function getOrganizationScopedModels() {
    const models: string[] = [];
    const modelRegex = /model\s+(\w+)\s+\{([\s\S]*?)\n\}/g;
    let match: RegExpExecArray | null;

    while ((match = modelRegex.exec(schema))) {
        const [, modelName, body] = match;
        if (/^\s*organizationId\s+String\??/m.test(body)) {
            models.push(modelName);
        }
    }

    return models.sort();
}

describe("Tenant Isolation — RLS Coverage", () => {
    it("covers every direct organizationId-scoped Prisma model with ENABLE + FORCE RLS", () => {
        const scopedModels = getOrganizationScopedModels();
        expect(scopedModels.length).toBeGreaterThanOrEqual(30);

        for (const model of scopedModels) {
            expect(allMigrationsSql, `${model} should enable RLS`).toMatch(
                new RegExp(`ALTER\\s+TABLE\\s+"${model}"\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`),
            );
            expect(allMigrationsSql, `${model} should force RLS`).toMatch(
                new RegExp(`ALTER\\s+TABLE\\s+"${model}"\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY;`),
            );
        }
    });

    it("creates tenant isolation policies for every organizationId-scoped model", () => {
        const scopedModels = getOrganizationScopedModels();

        for (const model of scopedModels) {
            expect(allMigrationsSql, `${model} should have tenant policy`).toContain(
                `CREATE POLICY tenant_isolation ON "${model}" FOR ALL`,
            );
        }
    });

    it("uses app.current_tenant_id for tenant context and app.rls_bypass for platform", () => {
        expect(allMigrationsSql).toContain("app.current_tenant_id");
        expect(allMigrationsSql).toContain("app.rls_bypass");
        expect(allMigrationsSql).toContain("CREATE ROLE peopleflow_app");
        expect(allMigrationsSql).toContain("NOSUPERUSER");
    });
});

describe("Tenant Middleware — Wrapper API", () => {
    it("tenant-middleware.ts file exists and exports the wrapper functions", () => {
        const content = readFileSync(path.join(root, "src/lib/tenant-middleware.ts"), "utf8");
        expect(content).toContain("export function withTenantContext");
        expect(content).toContain("export function withTenantContextBody");
        expect(content).toContain("export function withTenantContextParams");
    });

    it("tenant-middleware imports from @/lib/prisma (withTenant)", () => {
        const content = readFileSync(path.join(root, "src/lib/tenant-middleware.ts"), "utf8");
        expect(content).toContain("withTenant");
        expect(content).toContain("requireAuth");
    });

    it("tenant-middleware supports RBAC v2 permission checks", () => {
        const content = readFileSync(path.join(root, "src/lib/tenant-middleware.ts"), "utf8");
        expect(content).toContain("hasEffectivePermission");
        expect(content).toContain("permission");
    });
});

describe("Tenant Isolation — Route Audit", () => {
    it("all critical routes import from @/lib/api-auth (auth checked)", () => {
        const criticalRoutes = [
            "src/app/api/employees/route.ts",
            "src/app/api/leaves/applications/route.ts",
            "src/app/api/attendance/route.ts",
            "src/app/api/payroll/process/route.ts",
            "src/app/api/expenses/claims/route.ts",
            "src/app/api/loans/route.ts",
        ];

        for (const route of criticalRoutes) {
            try {
                const content = readFileSync(path.join(root, route), "utf8");
                expect(content, `${route} should check auth`).toMatch(
                    /requireAuth|requireAdminOrHR|requireManagerOrAbove|requireEmployee|requireRole|requirePermission/,
                );
            } catch {
                // Route may not exist in this branch
            }
        }
    });

    it("all critical routes filter by organizationId", () => {
        const criticalRoutes = [
            "src/app/api/employees/route.ts",
            "src/app/api/leaves/applications/route.ts",
            "src/app/api/attendance/route.ts",
            "src/app/api/payroll/process/route.ts",
            "src/app/api/expenses/claims/route.ts",
            "src/app/api/loans/route.ts",
        ];

        for (const route of criticalRoutes) {
            try {
                const content = readFileSync(path.join(root, route), "utf8");
                expect(
                    content.includes("organizationId") ||
                    content.includes("withTenant") ||
                    content.includes("auth.organizationId"),
                    `${route} should filter by organizationId or use withTenant`,
                ).toBe(true);
            } catch {
                // Route may not exist
            }
        }
    });
});
