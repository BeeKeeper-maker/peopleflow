/**
 * Attendance Validation Schemas
 */
import * as z from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const checkInSchema = z.object({
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    notes: z.string().optional(),
});

export const checkOutSchema = z.object({
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    notes: z.string().optional(),
});

export const manualAttendanceSchema = z.object({
    employeeId: z.string().min(1, "Employee is required"),
    date: z.coerce.date(),
    checkIn: z.string().regex(timeRegex, "Invalid time format (HH:MM)").optional(),
    checkOut: z.string().regex(timeRegex, "Invalid time format (HH:MM)").optional(),
    // NOTE: "late" is NOT a valid status — late employees are stored as
    // status="present" with lateMinutes > 0. See schema.prisma Attendance model.
    status: z.enum(["present", "absent", "half_day", "on_leave", "holiday", "weekend"]),
    notes: z.string().max(500).optional(),
}).refine(
    (data) => data.checkOut ? !!data.checkIn : true,
    { message: "checkIn is required when checkOut is provided", path: ["checkIn"] },
);

export const attendanceReportQuerySchema = z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    departmentId: z.string().optional(),
    employeeId: z.string().optional(),
    format: z.enum(["json", "csv", "excel"]).optional().default("json"),
}).refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
});

export type CheckInInput = z.infer<typeof checkInSchema>;
export type CheckOutInput = z.infer<typeof checkOutSchema>;
export type ManualAttendanceInput = z.infer<typeof manualAttendanceSchema>;
