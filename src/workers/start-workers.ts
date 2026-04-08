/**
 * PeopleFlow Worker Process — Entry Point
 *
 * Starts all BullMQ workers. Run as a separate container:
 *   docker-compose service: worker
 *   command: npm run worker
 *
 * Add new workers here as the system scales.
 */

import { eventLogger } from "@/lib/logger";

eventLogger.info("═══════════════════════════════════════════");
eventLogger.info("  PeopleFlow Worker Process Starting...");
eventLogger.info("═══════════════════════════════════════════");

// Import workers (side-effect: starts the BullMQ consumers)
import "./event-worker";

eventLogger.info("All workers registered. Listening for jobs...");

// Graceful shutdown
const shutdown = async (signal: string) => {
    eventLogger.info(`Received ${signal}. Shutting down workers...`);
    const { eventWorker } = await import("./event-worker");
    await eventWorker.close();
    eventLogger.info("Workers shut down gracefully.");
    process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
