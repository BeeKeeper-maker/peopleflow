import { NextResponse } from "next/server";
import { requireAuth, requireAdminOrHR, isAuthenticated } from "@/lib/api-auth";
import { leaveLogger } from "@/lib/logger";
import type { Prisma } from "@/generated/prisma";

function normalizeLeaveTypePayload(json: Record<string, unknown>): Record<string, unknown> {
    const {
        isProRata,
        requireDocument,
        maxCarryForward,
        ...rest
    } = json;

    return {
        ...rest,
        ...(isProRata !== undefined ? { proRataEnabled: Boolean(isProRata) } : {}),
        ...(requireDocument !== undefined ? { requiresDocument: Boolean(requireDocument) } : {}),
        ...(maxCarryForward !== undefined
            ? { carryForwardLimit: maxCarryForward === "" || maxCarryForward === null ? null : Number(maxCarryForward) }
            : {}),
    };
}

export async function GET(req: Request) {
    try {
        const auth = await requireAuth();
        if (!isAuthenticated(auth)) return auth;

        const { searchParams } = new URL(req.url);
        const fetchAll = searchParams.get("all") === "true";

        const where: Prisma.LeaveTypeWhereInput = {
            organizationId: auth.organizationId,
        };

        if (!fetchAll) {
            where.isActive = true;
        }

        const leaveTypes = await auth.withDB((db) =>
            db.leaveType.findMany({
                where,
                orderBy: { name: "asc" },
            }),
        );

        return NextResponse.json(leaveTypes);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        leaveLogger.error({ err: error, errorId }, "GET_LEAVE_TYPES_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        // Require HR admin role for creating leave types
        const auth = await requireAdminOrHR();
        if (!isAuthenticated(auth)) {
            return auth;
        }

        const json = await req.json();
        const payload = normalizeLeaveTypePayload(json);
        const code = String(payload.code ?? "").trim();
        const { code: _code, ...rest } = payload;
        void _code;

        if (!code) {
            return new NextResponse("Leave type code is required", { status: 400 });
        }

        // Check if code exists
        const existingCode = await auth.withDB((db) =>
            db.leaveType.findFirst({
                where: {
                    organizationId: auth.organizationId,
                    code,
                },
            }),
        );

        if (existingCode) {
            return new NextResponse("Leave type code already exists", { status: 409 });
        }

        const leaveType = await auth.withDB((db) =>
            db.leaveType.create({
                data: {
                    code,
                    organizationId: auth.organizationId,
                    ...rest,
                } as Prisma.LeaveTypeUncheckedCreateInput,
            }),
        );

        return NextResponse.json(leaveType);
    } catch (error) {
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        leaveLogger.error({ err: error, errorId }, "CREATE_LEAVE_TYPE_ERROR");
        return NextResponse.json(
            { error: "Internal server error", errorId },
            { status: 500 }
        );
    }
}
