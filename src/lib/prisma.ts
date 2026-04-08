/**
 * PeopleFlow Prisma Client — Multi-Tenant RLS Integration
 *
 * Provides three access patterns:
 *   1. `prisma`          — backward-compatible, no RLS (app-level WHERE still works)
 *   2. `withTenant(id)`  — RLS-enforced via SET LOCAL app.current_tenant_id
 *   3. `withPlatform()`  — RLS-bypass for platform admin cross-tenant ops
 *
 * RLS enforcement requires the app to connect as `peopleflow_app` role
 * (created by the RLS migration). Superuser connections bypass RLS by design.
 */

import { PrismaClient, Prisma } from "@/generated/prisma";

// ── Base Client (singleton) ──────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

const basePrisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

/** Backward-compatible default export — no RLS enforcement */
export const prisma = basePrisma;
export default prisma;

// ── Transaction Client Type ──────────────────────────────────────

export type TxClient = Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ── RLS-Enforced Tenant Access ───────────────────────────────────

/**
 * Execute database operations within a tenant-scoped RLS context.
 *
 * Sets `app.current_tenant_id` for the transaction so PostgreSQL
 * RLS policies enforce that only this tenant's rows are visible.
 *
 * @example
 * ```ts
 * const employees = await withTenant(orgId, (db) =>
 *     db.employee.findMany({ where: { employmentStatus: "active" } })
 * );
 * ```
 */
export async function withTenant<T>(
    organizationId: string,
    fn: (db: TxClient) => Promise<T>
): Promise<T> {
    return basePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${organizationId}, true)`;
        return fn(tx);
    }, { timeout: 30_000 });
}

// ── Platform Admin Bypass ────────────────────────────────────────

/**
 * Execute database operations with RLS bypassed.
 * ONLY for platform admin cross-tenant operations.
 *
 * @example
 * ```ts
 * const allOrgs = await withPlatform((db) =>
 *     db.organization.findMany()
 * );
 * ```
 */
export async function withPlatform<T>(
    fn: (db: TxClient) => Promise<T>
): Promise<T> {
    return basePrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'true', true)`;
        return fn(tx);
    }, { timeout: 30_000 });
}
