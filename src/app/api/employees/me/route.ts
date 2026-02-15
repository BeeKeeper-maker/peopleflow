import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/api-auth";

// GET /api/employees/me - Get current employee's profile
export async function GET() {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) {
        return auth;
    }

    try {
        // Get the employee linked to the current user
        const employee = await prisma.employee.findFirst({
            where: {
                organizationId: auth.organizationId,
                userId: auth.userId,
            },
            include: {
                department: {
                    select: { name: true },
                },
                designation: {
                    select: { name: true },
                },
                reportingManager: {
                    select: { firstName: true, lastName: true },
                },
                shift: {
                    select: { name: true },
                },
                branch: {
                    select: { name: true },
                },
            },
        });

        if (!employee) {
            return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
        }

        return NextResponse.json({ data: employee });
    } catch (error) {
        console.error("Error fetching employee profile:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

// PATCH /api/employees/me - Update current employee's profile (limited fields)
export async function PATCH(req: NextRequest) {
    const auth = await requireAuth();
    if (!isAuthenticated(auth)) {
        return auth;
    }

    try {
        const body = await req.json();

        // Only allow updating specific fields
        const allowedFields = [
            "phone",
            "personalEmail",
            "presentAddress",
            "emergencyContactName",
            "emergencyContactPhone",
            "emergencyContactRelation",
        ];

        const updateData: Record<string, string> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        // Find and update the employee
        const employee = await prisma.employee.findFirst({
            where: {
                organizationId: auth.organizationId,
                userId: auth.userId,
            },
        });

        if (!employee) {
            return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
        }

        const updatedEmployee = await prisma.employee.update({
            where: { id: employee.id },
            data: updateData,
            include: {
                department: {
                    select: { name: true },
                },
                designation: {
                    select: { name: true },
                },
                reportingManager: {
                    select: { firstName: true, lastName: true },
                },
                shift: {
                    select: { name: true },
                },
                branch: {
                    select: { name: true },
                },
            },
        });

        return NextResponse.json({ data: updatedEmployee });
    } catch (error) {
        console.error("Error updating employee profile:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
