/**
 * PeopleFlow Biometric Attendance Ingest — ADMS/iCloud entry point
 *
 * This file now delegates to the canonical punch processor at
 * @/lib/biometric/punch-processor. The old inline implementation had
 * a partial-batch overwrite bug (a single-punch ADMS push would
 * overwrite a previously-known check-in). The canonical processor
 * merges correctly: min(checkIn), max(checkOut).
 *
 * Re-exports are kept for backward compatibility with any code that
 * imported helpers from this module.
 */

export {
    ingestBiometricPunches,
    startOfBusinessDay,
    addBusinessDays,
    buildBusinessDateTime,
    getShiftDate,
    calculateShiftMetrics,
    parseTime,
    getBusinessLocalDate,
    BUSINESS_TIMEZONE_OFFSET_MINUTES,
    buildEmployeeBiometricMap,
    type BiometricPunchRecord,
    type BiometricIngestResult,
} from "./punch-processor";

// Re-export the legacy type name for any code that imported it
import type { BiometricIngestResult as LegacyResult } from "./punch-processor";
export type { LegacyResult };
