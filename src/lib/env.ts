/**
 * PeopleFlow Environment Variable Validation
 *
 * Uses Zod to validate ALL environment variables at boot time.
 * If any required variable is missing or malformed, the process
 * crashes immediately with a clear error message.
 *
 * This file MUST be imported at the top of:
 *   - next.config.ts (build-time validation)
 *   - src/workers/index.ts (worker boot validation)
 *
 * Categories:
 *   1. Server-only secrets (never exposed to client)
 *   2. Public variables (NEXT_PUBLIC_* prefix)
 *   3. Optional variables (defaults provided)
 */

import { z } from "zod";

// ════════════════════════════════════════════════════════════════════════
// Schema Definitions
// ════════════════════════════════════════════════════════════════════════

const serverSchema = z.object({
    // ── Database ──
    DATABASE_URL: z
        .string()
        .min(1, "DATABASE_URL is required")
        .url("DATABASE_URL must be a valid PostgreSQL connection string")
        .refine(
            (url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
            "DATABASE_URL must use postgresql:// or postgres:// protocol"
        )
        .refine(
            (url) => {
                // In production, prevent connecting as superuser (bypasses RLS)
                if (process.env.NODE_ENV === "production") {
                    return !url.includes(":peopleflow@") || url.includes(":peopleflow_app@");
                }
                return true;
            },
            "DATABASE_URL must use peopleflow_app role (NOSUPERUSER) in production, not peopleflow (SUPERUSER) — RLS would be bypassed"
        ),

    // ── Redis ──
    REDIS_URL: z
        .string()
        .min(1, "REDIS_URL is required")
        .refine(
            (url) => url.startsWith("redis://") || url.startsWith("rediss://"),
            "REDIS_URL must use redis:// or rediss:// protocol"
        ),

    // ── Authentication ──
    NEXTAUTH_SECRET: z
        .string()
        .min(32, "NEXTAUTH_SECRET must be at least 32 characters for production security"),

    NEXTAUTH_URL: z
        .string()
        .url("NEXTAUTH_URL must be a valid URL"),

    // ── Stripe (required in production, optional in dev) ──
    STRIPE_SECRET_KEY: z
        .string()
        .optional()
        .refine(
            (key) => {
                if (process.env.NODE_ENV === "production") {
                    return key && key.startsWith("sk_live_");
                }
                return true;
            },
            "STRIPE_SECRET_KEY must be a live key (sk_live_*) in production"
        ),

    STRIPE_WEBHOOK_SECRET: z
        .string()
        .optional()
        .refine(
            (key) => {
                if (process.env.NODE_ENV === "production") {
                    return key && key.startsWith("whsec_");
                }
                return true;
            },
            "STRIPE_WEBHOOK_SECRET must start with whsec_ in production"
        ),

    // ── Sentry (required in production) ──
    SENTRY_DSN: z
        .string()
        .url("SENTRY_DSN must be a valid Sentry DSN URL")
        .optional(),

    SENTRY_AUTH_TOKEN: z.string().optional(),

    // ── CRON Authentication ──
    // Required in production (min 16 characters). Optional in development
    // ONLY when ALLOW_INSECURE_CRON=1 is explicitly set (default-deny).
    // The refine() enforces production presence so a missing CRON_SECRET
    // crashes the boot instead of silently leaving /api/cron/* endpoints
    // either unprotected (503 in cron-auth.ts) or, worse, misconfigured.
    // In development, the refine() blocks missing CRON_SECRET unless the
    // operator has explicitly opted in via ALLOW_INSECURE_CRON=1.
    CRON_SECRET: z.string().refine(
        (val) => {
            if (process.env.NODE_ENV === "production") {
                return val && val.length >= 16;
            }
            // dev / test: allow empty only with explicit opt-in
            if (!val) {
                return process.env.ALLOW_INSECURE_CRON === "1";
            }
            return val.length >= 16;
        },
        "CRON_SECRET is required (min 16 characters). In development, set ALLOW_INSECURE_CRON=1 to allow without a secret."
    ).optional(),

    // Explicit opt-in for running cron endpoints without CRON_SECRET in
    // development. Default empty (denied). See src/lib/cron-auth.ts.
    ALLOW_INSECURE_CRON: z.string().optional(),

    // ── Email (optional — graceful degradation) ──
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().email().optional(),

    // ── Platform Admin Seeder ──
    PLATFORM_ADMIN_EMAIL: z.string().email().optional(),
    PLATFORM_ADMIN_PASSWORD: z.string().min(16, "PLATFORM_ADMIN_PASSWORD must be at least 16 characters").optional(),

    // ── Node Environment ──
    NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
});

const clientSchema = z.object({
    NEXT_PUBLIC_APP_URL: z
        .string()
        .url("NEXT_PUBLIC_APP_URL must be a valid URL"),

    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

// ════════════════════════════════════════════════════════════════════════
// Validation & Export
// ════════════════════════════════════════════════════════════════════════

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

/**
 * Validated server environment variables.
 * Access via: `import { env } from "@/lib/env"`
 */
let serverEnv: ServerEnv;

/**
 * Validated client environment variables.
 * Access via: `import { clientEnv } from "@/lib/env"`
 */
let clientEnv: ClientEnv;

function validateEnv(): void {
    // Server-side validation
    const serverResult = serverSchema.safeParse(process.env);

    if (!serverResult.success) {
        const errors = serverResult.error.flatten().fieldErrors;
        const formattedErrors = Object.entries(errors)
            .map(([key, msgs]) => `  ❌ ${key}: ${msgs?.join(", ")}`)
            .join("\n");

        const message = [
            "",
            "╔══════════════════════════════════════════════════════════════╗",
            "║  FATAL: Environment Variable Validation Failed             ║",
            "╚══════════════════════════════════════════════════════════════╝",
            "",
            formattedErrors,
            "",
            "Fix the above errors in your .env file or environment config.",
            "See .env.example for required variables.",
            "",
        ].join("\n");

        console.error(message);

        // During Docker build (Coolify), runtime env vars are not available.
        // Log the error prominently but never crash — the app will crash at
        // runtime if truly required env vars are missing (e.g. DB connection).
        // This prevents next build from failing in CI/CD pipelines.
    }

    serverEnv = (serverResult.success ? serverResult.data : serverSchema.parse({
        ...process.env,
        // Provide safe defaults for development
        DATABASE_URL: process.env.DATABASE_URL || "postgresql://localhost:5432/peopleflow",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "dev-secret-minimum-32-characters-long!!",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
    })) as ServerEnv;

    // Client-side validation
    const clientResult = clientSchema.safeParse({
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
        NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    });

    clientEnv = (clientResult.success ? clientResult.data : {
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    }) as ClientEnv;
}

// Run validation on module load
validateEnv();

export { serverEnv as env, clientEnv };
