import { NextResponse } from "next/server";
import { getOpenApiJson } from "@/lib/openapi-spec";

/**
 * GET /api/v1/docs — OpenAPI 3.0 specification
 *
 * Returns the full OpenAPI spec as JSON. This can be viewed in
 * Swagger UI at https://peopleflowbd.online/api/v1/docs or imported
 * into Postman/Insomnia for testing.
 *
 * No authentication required — the spec is public (but all actual
 * API endpoints require a Bearer token).
 */
export async function GET() {
    return new NextResponse(getOpenApiJson(), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
    });
}
