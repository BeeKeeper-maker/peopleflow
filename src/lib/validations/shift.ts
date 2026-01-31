/**
 * Shift Validation Schemas
 */
import * as z from "zod";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const shiftSchema = z.object({
    name: z.string().min(1, "Shift name is required"),
    nameBn: z.string().optional(),
    startTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
    endTime: z.string().regex(timeRegex, "Invalid time format (HH:MM)"),
    graceMinutes: z.coerce.number().int().min(0).default(15),
    isOvernight: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
});

export type ShiftFormValues = z.infer<typeof shiftSchema>;
