/**
 * Health Check API Endpoint
 * Used for Docker healthcheck and monitoring
 * 
 * IMPORTANT: This endpoint MUST always return 200 for Docker healthcheck
 * to work correctly. Database status is reported in the response body
 * but does NOT affect the HTTP status code.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const startTime = Date.now();

    const healthStatus: Record<string, unknown> = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        uptime: process.uptime(),
        checks: {
            server: { status: "healthy" },
            database: { status: "unknown" as string, latency: 0 },
            memory: { status: "healthy" as string },
        },
    };

    // Check database connectivity (non-fatal — server can run without DB temporarily)
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

    const responseTime = Date.now() - startTime;

    // ALWAYS return 200 — Docker healthcheck depends on it
    return NextResponse.json(
        {
            ...healthStatus,
            responseTime,
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        }
    );
}
