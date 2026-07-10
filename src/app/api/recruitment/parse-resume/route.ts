import { NextResponse } from "next/server";
import { requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import type { AuthContext } from "@/lib/api-auth";
import { parseResume, mergeParsedResume } from "@/lib/resume-parser";
import { apiLogger } from "@/lib/logger";

/**
 * POST /api/recruitment/parse-resume
 *
 * Accepts resume text (extracted from PDF/DOCX client-side) and returns
 * structured candidate data that can be used to auto-fill the candidate
 * creation form.
 *
 * Body:
 *   { "text": "John Doe\nSoftware Engineer\n..." }
 *
 * Returns:
 *   {
 *     "parsed": {
 *       "firstName": "John",
 *       "lastName": "Doe",
 *       "email": "john@example.com",
 *       "phone": "+8801712345678",
 *       "skills": ["JavaScript", "React", "Node.js"],
 *       "yearsOfExperience": 5,
 *       "currentTitle": "Software Engineer",
 *       "currentCompany": "Tech Corp",
 *       "education": "B.Sc in Computer Science",
 *       "linkedinUrl": "https://linkedin.com/in/johndoe",
 *       "confidence": 0.8,
 *       "warnings": []
 *     },
 *     "merged": { ...all fields ready for form... }
 *   }
 *
 * Authorization: admin / hr_admin
 */
export async function POST(req: Request) {
    const auth = await requireAdminOrHR();
    if (!isAuthenticated(auth)) return auth;
    const ctx = auth as AuthContext;

    try {
        // P17-BUGS-15: Wrap JSON parsing in try/catch so a malformed body
        // returns 400 Bad Request instead of crashing the route with a 500.
        // Previously `await req.json()` would throw a SyntaxError on invalid
        // JSON, which fell through to the generic 500 handler below — making
        // it look like a server bug rather than a client error.
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { error: "Invalid JSON body" },
                { status: 400 },
            );
        }
        const text = typeof (body as { text?: unknown })?.text === "string"
            ? (body as { text: string }).text
            : "";

        if (!text || text.trim().length < 20) {
            return NextResponse.json(
                { error: "Resume text is required (minimum 20 characters)" },
                { status: 400 },
            );
        }

        // Cap text length for safety (prevent abuse)
        const cappedText = text.substring(0, 50000);

        const parsed = parseResume(cappedText);
        const merged = mergeParsedResume(parsed, {});

        apiLogger.info(
            {
                confidence: parsed.confidence,
                fieldsExtracted: Object.keys(merged).length,
                skillsCount: parsed.skills.length,
                orgId: ctx.organizationId,
            },
            "Resume parsed",
        );

        return NextResponse.json({
            success: true,
            parsed,
            merged,
            message: parsed.confidence > 0.5
                ? `Resume parsed with ${Math.round(parsed.confidence * 100)}% confidence. ${parsed.warnings.length > 0 ? "Some fields may need manual review." : "All fields extracted successfully."}`
                : `Resume parsed with low confidence (${Math.round(parsed.confidence * 100)}%). Please review all fields manually.`,
        });
    } catch (error) {
        apiLogger.error({ err: error }, "PARSE_RESUME_ERROR");
        return NextResponse.json(
            { error: "Failed to parse resume" },
            { status: 500 },
        );
    }
}
