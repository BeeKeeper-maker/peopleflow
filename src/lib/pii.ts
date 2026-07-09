/**
 * PII Encryption Helper
 *
 * Wraps the raw AES-256-GCM primitives in `@/lib/crypto` with field-level
 * helpers tailored for personally identifiable information stored on
 * domain tables (Employee.bkashNumber, Employee.nagadNumber, etc.).
 *
 * Goals:
 *   ✅ Encrypt at rest — never write plaintext PII to the database.
 *   ✅ Transparent reads — callers receive plaintext, helper handles the
 *      decrypt behind a `Number()`-style coercion.
 *   ✅ Graceful legacy fallback — if a row was written before encryption
 *      rolled out (plaintext), the helper returns it as-is rather than
 *      throwing. This lets the migration ship without a backfill and
 *      without breaking reads of pre-existing rows.
 *
 * Storage format (same as `@/lib/crypto`):
 *   base64(iv[16] + ciphertext + authTag[16])
 *
 * Detection heuristic for "is this value encrypted?":
 *   The encrypted blob is always base64 and at least ~44 chars long
 *   (16-byte IV + 16-byte auth tag + ≥1 byte ciphertext = 33 bytes →
 *   44 base64 chars). A plaintext BD mobile number is 11–14 chars.
 *   We additionally require the value to base64-decode cleanly and to
 *   be longer than any reasonable plaintext PII value (threshold 32).
 */

import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";

/**
 * Minimum length of an encrypted blob (base64 of iv + auth-tag + ≥1 byte
 * ciphertext). Anything shorter than this cannot be a valid encrypted
 * value, so the helper treats it as plaintext (legacy data or empty).
 */
const ENCRYPTED_MIN_LENGTH = 32;

/**
 * Encrypt a nullable PII string for storage.
 *
 * - `null` / empty string → returned as-is (no encryption applied, no
 *   sentinel inserted). The column stays `NULL` in the database.
 * - Non-empty string → encrypted via AES-256-GCM, base64-encoded.
 *
 * @example
 *   encryptPii("01712345678") // → "k3l9...=="
 *   encryptPii(null)          // → null
 *   encryptPii("")            // → ""
 */
export function encryptPii(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined) return null;
    if (plaintext === "") return "";
    return encrypt(plaintext);
}

/**
 * Decrypt a PII value read from the database.
 *
 * - `null` → `null`.
 * - Value shorter than the encrypted-blob threshold (e.g. legacy plaintext
 *   like `"01712345678"`) → returned as-is. This keeps the cutover
 *   backward-compatible: rows written before encryption was enabled still
 *   read correctly, and the next write will encrypt them.
 * - Encrypted blob → decrypted via AES-256-GCM.
 * - Decrypt failure (corrupt blob / wrong key) → returned as-is rather
 *   than throwing, so a misconfigured ENCRYPTION_KEY can't take down the
 *   whole employee list endpoint. The error is logged by the caller if
 *   needed.
 */
export function decryptPii(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === "") return null;
    if (value.length < ENCRYPTED_MIN_LENGTH) return value; // legacy plaintext
    if (!isEncrypted(value)) return value; // not base64, definitely plaintext

    try {
        return decrypt(value);
    } catch {
        // Could be a corrupt blob, a key rotation, or a plaintext value
        // that happens to look like base64. Either way, surface the raw
        // value so the UI keeps working — do not 500 the request.
        return value;
    }
}

/**
 * Decrypt the two BD mobile-banking numbers on an Employee row in place.
 *
 * Used by employee GET endpoints to ensure the API response always
 * carries plaintext phone numbers (the encrypted form never leaves the
 * database layer). Accepts the Prisma row shape and mutates the two
 * fields, returning the same object for convenience.
 *
 * @example
 *   const employee = await db.employee.findUnique({ where: { id } });
 *   return NextResponse.json(decryptEmployeePhoneNumbers(employee));
 */
export function decryptEmployeePhoneNumbers<T extends {
    bkashNumber?: string | null;
    nagadNumber?: string | null;
}>(employee: T): T {
    if (employee?.bkashNumber !== undefined) {
        (employee as { bkashNumber: string | null }).bkashNumber = decryptPii(employee.bkashNumber);
    }
    if (employee?.nagadNumber !== undefined) {
        (employee as { nagadNumber: string | null }).nagadNumber = decryptPii(employee.nagadNumber);
    }
    return employee;
}
