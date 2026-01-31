/**
 * Health Check API Endpoint
 * Used for monitoring and load balancer health checks
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    const healthStatus = {
        status: "healthy" as "healthy" | "degraded" | "unhealthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        uptime: process.uptime(),
        checks: {
            database: { status: "unknown" as "healthy" | "unhealthy", latency: 0 },
            memory: { status: "healthy" as "healthy" | "unhealthy", usage: {} as NodeJS.MemoryUsage },
        },
    };

    // Check database connectivity
    try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        healthStatus.checks.database = {
            status: "healthy",
            latency: Date.now() - dbStart,
        };
    } catch (error) {
        healthStatus.checks.database = {
            status: "unhealthy",
            latency: -1,
        };
        healthStatus.status = "unhealthy";
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    healthStatus.checks.memory = {
        status: heapUsedPercent > 90 ? "unhealthy" : "healthy",
        usage: memoryUsage,
    };

    if (heapUsedPercent > 90) {
        healthStatus.status = healthStatus.status === "unhealthy" ? "unhealthy" : "degraded";
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
        {
            ...healthStatus,
            responseTime,
        },
        {
            status: healthStatus.status === "unhealthy" ? 503 : 200,
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        }
    );
}
