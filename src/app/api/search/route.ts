/**
 * Global Search API
 * 
 * Features:
 * - Multi-entity search (Employees, Departments, Jobs, etc.)
 * - Relevance scoring
 * - Result grouping
 * - Search suggestions
 * - Recent searches (client-side)
 *
 * SECURITY: All Prisma reads go through `requireAuth()` + `auth.withDB()` so
 * they are RLS-scoped to the caller's organization and protected by
 * sessionVersion / isActive / org-status checks enforced in requireAuth().
 */

import { NextRequest } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";
import { errorResponse, successResponse, ErrorCodes } from "@/lib/api-response";
import { rateLimit, RATE_LIMIT_CONFIGS } from "@/lib/rate-limit";
import { apiLogger } from "@/lib/logger";

interface SearchResult {
    id: string;
    type: "employee" | "department" | "designation" | "job" | "leave" | "expense";
    title: string;
    subtitle?: string;
    description?: string;
    url: string;
    relevance: number;
    metadata?: Record<string, unknown>;
}

interface SearchResponse {
    query: string;
    total: number;
    results: SearchResult[];
    grouped: Record<string, SearchResult[]>;
    suggestions?: string[];
}

export async function GET(req: NextRequest) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        // Per-user rate limit (heavy multi-entity query)
        const rl = await rateLimit(req, RATE_LIMIT_CONFIGS.read, auth.userId);
        if (!rl.allowed) return rl.response!;

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim() || "";
        const types = searchParams.get("types")?.split(",") || ["all"];
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

        if (!query || query.length < 2) {
            return errorResponse(ErrorCodes.VALIDATION_ERROR, "Search query must be at least 2 characters");
        }

        const organizationId = auth.organizationId;
        const results: SearchResult[] = [];

        // Search Employees
        if (types.includes("all") || types.includes("employee")) {
            const employees = await auth.withDB((db) => db.employee.findMany({
                where: {
                    organizationId,
                    deletedAt: null,
                    OR: [
                        { firstName: { contains: query } },
                        { lastName: { contains: query } },
                        { email: { contains: query } },
                        { employeeCode: { contains: query } },
                        { phone: { contains: query } },
                    ],
                },
                include: {
                    department: { select: { name: true } },
                    designation: { select: { name: true } },
                },
                take: limit,
            }));

            for (const emp of employees) {
                results.push({
                    id: emp.id,
                    type: "employee",
                    title: `${emp.firstName} ${emp.lastName}`,
                    subtitle: emp.employeeCode,
                    description: `${emp.designation?.name || ""} • ${emp.department?.name || ""}`.trim(),
                    url: `/employees/${emp.id}`,
                    relevance: calculateRelevance(query, `${emp.firstName} ${emp.lastName} ${emp.employeeCode}`),
                    metadata: {
                        email: emp.email,
                        status: emp.employmentStatus,
                        photo: emp.photoUrl,
                    },
                });
            }
        }

        // Search Departments
        if (types.includes("all") || types.includes("department")) {
            const departments = await auth.withDB((db) => db.department.findMany({
                where: {
                    organizationId,
                    isActive: true,
                    OR: [
                        { name: { contains: query } },
                        { code: { contains: query } },
                        { nameBn: { contains: query } },
                    ],
                },
                include: {
                    _count: { select: { employees: true } },
                },
                take: limit,
            }));

            for (const dept of departments) {
                results.push({
                    id: dept.id,
                    type: "department",
                    title: dept.name,
                    subtitle: dept.code || undefined,
                    description: `${dept._count.employees} employees`,
                    url: `/departments/${dept.id}`,
                    relevance: calculateRelevance(query, `${dept.name} ${dept.code || ""}`),
                });
            }
        }

        // Search Designations
        if (types.includes("all") || types.includes("designation")) {
            const designations = await auth.withDB((db) => db.designation.findMany({
                where: {
                    organizationId,
                    isActive: true,
                    OR: [
                        { name: { contains: query } },
                        { code: { contains: query } },
                    ],
                },
                include: {
                    _count: { select: { employees: true } },
                },
                take: limit,
            }));

            for (const des of designations) {
                results.push({
                    id: des.id,
                    type: "designation",
                    title: des.name,
                    subtitle: des.code || undefined,
                    description: `Grade ${des.grade || "N/A"} • ${des._count.employees} employees`,
                    url: `/designations/${des.id}`,
                    relevance: calculateRelevance(query, `${des.name} ${des.code || ""}`),
                });
            }
        }

        // Search Job Postings
        if (types.includes("all") || types.includes("job")) {
            const jobs = await auth.withDB((db) => db.jobPosting.findMany({
                where: {
                    organizationId,
                    OR: [
                        { title: { contains: query } },
                        { description: { contains: query } },
                    ],
                },
                include: {
                    department: { select: { name: true } },
                    _count: { select: { applications: true } },
                },
                take: limit,
            }));

            for (const job of jobs) {
                results.push({
                    id: job.id,
                    type: "job",
                    title: job.title,
                    subtitle: job.status,
                    description: `${job.department?.name || "No dept"} • ${job._count.applications} applications`,
                    url: `/recruitment/jobs/${job.id}`,
                    relevance: calculateRelevance(query, job.title),
                    metadata: {
                        status: job.status,
                        openings: job.openings,
                    },
                });
            }
        }

        // Sort by relevance
        results.sort((a, b) => b.relevance - a.relevance);

        // Group results by type
        const grouped: Record<string, SearchResult[]> = {};
        for (const result of results) {
            if (!grouped[result.type]) {
                grouped[result.type] = [];
            }
            grouped[result.type].push(result);
        }

        // Generate suggestions (simple implementation)
        const suggestions = generateSuggestions(query, results);

        const response: SearchResponse = {
            query,
            total: results.length,
            results: results.slice(0, limit),
            grouped,
            suggestions,
        };

        return successResponse(response);

    } catch (error) {
        apiLogger.error({ err: error }, "SEARCH_ERROR:");
        return errorResponse(ErrorCodes.INTERNAL_ERROR, "Search failed");
    }
}

/**
 * Calculate relevance score (0-100)
 */
function calculateRelevance(query: string, text: string): number {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match
    if (textLower === queryLower) return 100;

    // Starts with query
    if (textLower.startsWith(queryLower)) return 90;

    // Contains query as word
    const words = textLower.split(/\s+/);
    if (words.some(w => w === queryLower)) return 80;

    // Contains query
    if (textLower.includes(queryLower)) return 70;

    // Fuzzy match - check character overlap
    let matchCount = 0;
    for (const char of queryLower) {
        if (textLower.includes(char)) matchCount++;
    }
    const fuzzyScore = (matchCount / queryLower.length) * 50;

    return Math.round(fuzzyScore);
}

/**
 * Generate search suggestions
 */
function generateSuggestions(query: string, results: SearchResult[]): string[] {
    const suggestions: Set<string> = new Set();

    // Extract unique words from results
    for (const result of results.slice(0, 10)) {
        const words = result.title.split(/\s+/);
        for (const word of words) {
            if (word.toLowerCase().startsWith(query.toLowerCase()) && word.length > query.length) {
                suggestions.add(word);
            }
        }
    }

    return Array.from(suggestions).slice(0, 5);
}
