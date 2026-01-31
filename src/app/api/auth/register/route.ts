import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, isValidEmail, validatePassword } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { organizationName, industry, name, email, password } = body;

        // Validate required fields
        if (!organizationName || !name || !email || !password) {
            return NextResponse.json(
                { error: "All fields are required" },
                { status: 400 }
            );
        }

        // Validate email format
        if (!isValidEmail(email)) {
            return NextResponse.json(
                { error: "Please enter a valid email address" },
                { status: 400 }
            );
        }

        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return NextResponse.json(
                { error: passwordValidation.errors[0] },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "An account with this email already exists" },
                { status: 400 }
            );
        }

        // Generate organization slug
        let slug = slugify(organizationName);
        const existingOrg = await prisma.organization.findUnique({
            where: { slug },
        });

        if (existingOrg) {
            // Add random suffix if slug exists
            slug = `${slug}-${Math.random().toString(36).substr(2, 4)}`;
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create organization and admin user in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create organization
            const organization = await tx.organization.create({
                data: {
                    name: organizationName,
                    slug,
                    industry: industry || null,
                    settings: JSON.stringify({
                        weekends: [5, 6], // Friday, Saturday
                        workingHours: { start: "09:00", end: "18:00" },
                        currencyFormat: "BDT",
                    }),
                },
            });

            // Create admin user
            const user = await tx.user.create({
                data: {
                    email: email.toLowerCase(),
                    name,
                    password: hashedPassword,
                    role: "admin",
                    organizationId: organization.id,
                    isActive: true,
                },
            });

            // Create default leave types for Bangladesh
            const leaveTypes = [
                { name: "Casual Leave", code: "CL", color: "#3B82F6", annualAllocation: 10 },
                { name: "Sick Leave", code: "SL", color: "#EF4444", annualAllocation: 14 },
                { name: "Earned Leave", code: "EL", color: "#10B981", annualAllocation: 10, carryForwardLimit: 20 },
                { name: "Maternity Leave", code: "ML", color: "#EC4899", annualAllocation: 112, applicableGender: "female" },
                { name: "Paternity Leave", code: "PL", color: "#8B5CF6", annualAllocation: 10, applicableGender: "male" },
                { name: "Festival Leave", code: "FL", color: "#F59E0B", annualAllocation: 2 },
                { name: "Compensatory Off", code: "CO", color: "#06B6D4", annualAllocation: 0 },
            ];

            // Create leave types individually (SQLite doesn't support createMany natively)
            for (const lt of leaveTypes) {
                await tx.leaveType.create({
                    data: {
                        ...lt,
                        organizationId: organization.id,
                    },
                });
            }

            // Create default shift
            await tx.shift.create({
                data: {
                    name: "General Shift",
                    code: "GEN",
                    startTime: "09:00",
                    endTime: "18:00",
                    breakDuration: 60,
                    graceMinutes: 15,
                    isDefault: true,
                    organizationId: organization.id,
                },
            });

            // Create default salary structure
            await tx.salaryStructure.create({
                data: {
                    name: "Standard Structure",
                    code: "STD",
                    description: "Default salary structure with standard components",
                    basicPercentage: 50,
                    houseRentPercent: 50,
                    medicalPercent: 10,
                    pfEmployeePercent: 10,
                    pfEmployerPercent: 10,
                    isActive: true,
                    organizationId: organization.id,
                },
            });

            return { organization, user };
        });

        return NextResponse.json(
            {
                message: "Account created successfully",
                organizationId: result.organization.id,
                userId: result.user.id,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { error: "An error occurred during registration" },
            { status: 500 }
        );
    }
}
