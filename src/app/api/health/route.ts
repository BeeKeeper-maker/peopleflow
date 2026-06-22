/**
 * Health Check API Endpoint
 *
 * Default mode is intentionally lightweight for Docker/Coolify healthchecks:
 * it verifies the HTTP server process is alive without touching DB/Redis.
 *
 * Use `/api/health?deep=1` for dependency diagnostics. Deep checks are kept
 * opt-in because Redis/DB latency or retries can otherwise slow every health
 * probe and create avoidable load on the web container.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const startTime = Date.now();
    const deep = request.nextUrl.searchParams.get("deep") === "1";

    const healthStatus: Record<string, unknown> = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        uptime: process.uptime(),
        mode: deep ? "deep" : "light",
        checks: {
            server: { status: "healthy" },
            memory: { status: "healthy" as string },
        },
    };

    if (deep) {
        // Check database connectivity (non-fatal — reported in body only)
        try {
            const { prisma } = await import("@/lib/prisma");
            const dbStart = Date.now();
            await prisma.$queryRaw`SELECT 1`;
            (healthStatus.checks as Record<string, unknown>).database = {
                status: "healthy",
                latency: Date.now() - dbStart,
            };
        } catch {
            (healthStatus.checks as Record<string, unknown>).database = {
                status: "unreachable",
                latency: -1,
            };
        }

        // Check Redis connectivity (non-fatal — reported in body only)
        try {
            const { getRedis, isRedisDisabledForRuntime } = await import("@/lib/redis");
            if (isRedisDisabledForRuntime()) {
                (healthStatus.checks as Record<string, unknown>).redis = {
                    status: "skipped",
                    latency: 0,
                };
            } else {
                const redisStart = Date.now();
                await getRedis().ping();
                (healthStatus.checks as Record<string, unknown>).redis = {
                    status: "healthy",
                    latency: Date.now() - redisStart,
                };
            }
        } catch {
            (healthStatus.checks as Record<string, unknown>).redis = {
                status: "unreachable",
                latency: -1,
            };
        }
    }

    // Check memory usage
    try {
        const memoryUsage = process.memoryUsage();
        const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
        (healthStatus.checks as Record<string, unknown>).memory = {
            status: heapUsedPercent > 90 ? "warning" : "healthy",
            heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        };
    } catch {
        // Memory check is non-critical
    }

    return NextResponse.json(
        {
            ...healthStatus,
            responseTime: Date.now() - startTime,
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        }
    );
}
