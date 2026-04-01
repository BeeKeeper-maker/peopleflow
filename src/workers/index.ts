/**
 * Worker Entrypoint
 *
 * Starts all BullMQ workers and registers CRON job schedules.
 * Run separately from the Next.js app server:
 *
 *   npx tsx src/workers/index.ts
 *
 * In production, this runs as a separate Docker container
 * or Coolify service alongside the main Next.js app.
 */

import { registerCronJobs } from "@/lib/queue";

// Import workers to activate them
import "./subscription-lifecycle";
import "./impersonation-cleanup";
import "./usage-tracking";

// ── Biometric & Attendance Workers ──
import "./biometric-sync";
import "./device-health";
import "./attendance-reconciliation";

async function main() {
    console.log("════════════════════════════════════════════════");
    console.log("  PeopleFlow SaaS — Background Worker Service  ");
    console.log("════════════════════════════════════════════════");
    console.log(`  Started at: ${new Date().toISOString()}`);
    console.log(`  Redis URL:  ${process.env.REDIS_URL || "redis://localhost:6379"}`);
    console.log("  Workers:    subscription, impersonation, usage,");
    console.log("              biometric-sync, device-health, reconciliation");
    console.log("════════════════════════════════════════════════");

    // Register CRON schedules
    await registerCronJobs();

    console.log("\n✅ All workers started. Listening for jobs...\n");

    // Keep the process alive
    process.on("SIGTERM", async () => {
        console.log("[WORKER] Received SIGTERM. Gracefully shutting down...");
        process.exit(0);
    });

    process.on("SIGINT", async () => {
        console.log("[WORKER] Received SIGINT. Gracefully shutting down...");
        process.exit(0);
    });
}

main().catch((err) => {
    console.error("[WORKER] Fatal error:", err);
    process.exit(1);
});
