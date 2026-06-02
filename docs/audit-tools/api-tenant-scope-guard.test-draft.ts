/**
 * Static Guard: API tenant scoping
 *
 * This test is intentionally conservative. PeopleFlow is multi-tenant, so tenant
 * API routes should either use the RLS-scoped `auth.withDB(...)` helper or be
 * explicitly documented as a platform/public/integration exception.
 *
 * It does not replace real database RLS integration tests; it prevents easy
 * regressions where a new route imports `prisma` and forgets tenant scoping.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const apiRoot = path.resolve(process.cwd(), "src/app/api");

function routeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) return routeFiles(fullPath);
    return entry === "route.ts" ? [fullPath] : [];
  });
}

function rel(file: string) {
  return path.relative(process.cwd(), file).replaceAll(path.sep, "/");
}

// Routes that are not tenant-plane session routes, or intentionally need
// platform/public/token-based lookup before a tenant context exists.
const allowedDirectPrismaRoutePrefixes = [
  "src/app/api/auth/",
  "src/app/api/platform/",
  "src/app/api/v1/sync/",
  "src/app/api/v1/organization/",
  "src/app/api/v1/employees/",
  "src/app/api/v1/leaves/",
];

const directPrismaPattern = /\bprisma\.(?!\$)/;
const scopedPattern = /\bauth\.withDB\s*\(/;
const platformBypassPattern = /\bwithPlatform\s*\(/;

function isAllowedException(route: string) {
  return allowedDirectPrismaRoutePrefixes.some((prefix) => route.startsWith(prefix));
}

describe("API tenant scope guard", () => {
  it("flags tenant API routes that use direct prisma without RLS-scoped auth.withDB", () => {
    const offenders = routeFiles(apiRoot)
      .map((file) => ({ file, route: rel(file), source: readFileSync(file, "utf8") }))
      .filter(({ route, source }) => {
        if (isAllowedException(route)) return false;
        if (platformBypassPattern.test(source)) return false;
        if (!directPrismaPattern.test(source)) return false;
        return !scopedPattern.test(source);
      })
      .map(({ route }) => route)
      .sort();

    expect(offenders, [
      "Tenant-plane API routes should not use direct prisma without auth.withDB().",
      "Either wrap DB operations in auth.withDB(...) or add a reviewed exception above.",
      ...offenders,
    ].join("\n")).toEqual([]);
  });
});
