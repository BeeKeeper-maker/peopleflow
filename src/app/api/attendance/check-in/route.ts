import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfDay, differenceInMinutes, parse, set } from "date-fns";
import { attendanceLogger } from "@/lib/logger";

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { employee: { include: { shift: true } } },
        });

        if (!user?.employee) {
            return new NextResponse("Employee profile not found", { status: 400 });
        }

        const { location, source } = await req.json(); // { lat, lng, address }

        const now = new Date();
        const today = startOfDay(now);

        // Check if already checked in
        const existing = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: user.employee.id,
                    date: today,
                }
            }
        });

        if (existing) {
            return new NextResponse("Already checked in today", { status: 400 });
        }

        // Calculate Late Status
        let lateMinutes = 0;
        let status = "present";

        if (user.employee.shift) {
            // Parse shift start time (HH:mm)
            const [hours, minutes] = user.employee.shift.startTime.split(':').map(Number);
            const shiftStart = set(now, { hours, minutes, seconds: 0, milliseconds: 0 });

            // Add grace period
            const lateThreshold = new Date(shiftStart.getTime() + (user.employee.shift.graceMinutes || 15) * 60000);

            if (now > lateThreshold) {
                lateMinutes = differenceInMinutes(now, shiftStart);
                status = "late"; // Or keep 'present' but with late minutes
            }
        }

        const attendance = await prisma.attendance.create({
            data: {
                employeeId: user.employee.id,
                date: today,
                checkIn: now,
                checkInLocation: location ? JSON.stringify(location) : null,
                source: source || "web",
                status,
                lateMinutes,
            }
        });

        return NextResponse.json(attendance);

    } catch (error) {
        attendanceLogger.error({ err: error }, "CHECK_IN_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { employee: { include: { shift: true } } },
        });

        if (!user?.employee) {
            return new NextResponse("Employee profile not found", { status: 400 });
        }

        const { location } = await req.json();

        const now = new Date();
        const today = startOfDay(now);

        const attendance = await prisma.attendance.findUnique({
            where: {
                employeeId_date: {
                    employeeId: user.employee.id,
                    date: today,
                }
            }
        });

        if (!attendance) {
            return new NextResponse("No check-in record found for today", { status: 404 });
        }

        if (attendance.checkOut) {
            return new NextResponse("Already checked out", { status: 400 });
        }

        // Calculate Early Leave / Overtime
        let earlyLeaveMinutes = 0;
        let overtimeMinutes = 0;

        if (user.employee.shift) {
            const [hours, minutes] = user.employee.shift.endTime.split(':').map(Number);
            const shiftEnd = set(now, { hours, minutes, seconds: 0, milliseconds: 0 });

            if (now < shiftEnd) {
                earlyLeaveMinutes = differenceInMinutes(shiftEnd, now);
            } else {
                overtimeMinutes = differenceInMinutes(now, shiftEnd);
            }
        } else {
            // Default 8 hours from CheckIn if no shift?? Or just 0.
            // For now assume 0 if no shift.
        }

        const updated = await prisma.attendance.update({
            where: { id: attendance.id },
            data: {
                checkOut: now,
                checkOutLocation: location ? JSON.stringify(location) : null,
                earlyLeaveMinutes,
                overtimeMinutes,
            }
        });

        return NextResponse.json(updated);

    } catch (error) {
        attendanceLogger.error({ err: error }, "CHECK_OUT_ERROR");
        return new NextResponse("Internal Error", { status: 500 });
    }
}
