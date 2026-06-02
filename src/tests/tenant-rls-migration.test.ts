import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const rlsMigration = readFileSync(
  path.join(root, "prisma/migrations/20260407104500_rls_tenant_isolation/migration.sql"),
  "utf8",
);

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

describe("Prisma RLS tenant isolation migration", () => {
  it("covers every direct organizationId-scoped Prisma model with ENABLE + FORCE RLS", () => {
    const scopedModels = getOrganizationScopedModels();

    expect(scopedModels.length).toBeGreaterThanOrEqual(30);

    for (const model of scopedModels) {
      expect(rlsMigration, `${model} should enable RLS`).toMatch(
        new RegExp(`ALTER\\s+TABLE\\s+"${model}"\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY;`),
      );
      expect(rlsMigration, `${model} should force RLS`).toMatch(
        new RegExp(`ALTER\\s+TABLE\\s+"${model}"\\s+FORCE\\s+ROW\\s+LEVEL\\s+SECURITY;`),
      );
    }
  });

  it("creates tenant isolation policies for every organizationId-scoped Prisma model", () => {
    const scopedModels = getOrganizationScopedModels();

    for (const model of scopedModels) {
      expect(rlsMigration, `${model} should have tenant policy`).toContain(
        `CREATE POLICY tenant_isolation ON "${model}" FOR ALL`,
      );
    }
  });

  it("uses app.current_tenant_id for tenant context and app.rls_bypass only for platform access", () => {
    expect(rlsMigration).toContain("app.current_tenant_id");
    expect(rlsMigration).toContain("app.rls_bypass");
    expect(rlsMigration).toContain("CREATE ROLE peopleflow_app");
    expect(rlsMigration).toContain("NOSUPERUSER");
  });
});
