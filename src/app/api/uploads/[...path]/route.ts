import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import mime from 'mime';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params;
        const filePath = path.join(process.cwd(), "uploads", ...pathSegments);

        // Security check: ensure path is within uploads directory
        const resolvedPath = path.resolve(filePath);
        const uploadsDir = path.resolve(process.cwd(), "uploads");
        if (!resolvedPath.startsWith(uploadsDir)) {
            return new NextResponse("Access Denied", { status: 403 });
        }

        // Check if file exists
        try {
            await stat(filePath);
        } catch (e) {
            return new NextResponse("File not found", { status: 404 });
        }

        // Read file
        const fileBuffer = await readFile(filePath);

        // Determine mime type
        const mimeType = mime.getType(filePath) || 'application/octet-stream';

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": mimeType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error) {
        console.error("SERVE_FILE_ERROR", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
