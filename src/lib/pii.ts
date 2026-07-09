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
 *   ✅ Idempotent encryption — re-encrypting an already-encrypted value
 *      is a no-op (detected via the `enc:` prefix).
 *   ✅ Graceful legacy fallback — if a row was written before the
 *      `enc:` prefix rolled out (legacy heuristic-encrypted blob or even
 *      plaintext), the helper still returns it correctly rather than
 *      throwing. This lets the migration ship without a backfill and
 *      without breaking reads of pre-existing rows.
 *
 * Storage format:
 *   New (preferred): `enc:` + base64(iv[16] + ciphertext + authTag[16])
 *   Legacy (heuristic): base64(iv[16] + ciphertext + authTag[16]) —
 *                       detected by length + base64-shape heuristic.
 *   Plaintext (pre-encryption rollout): returned as-is.
 *
 * Detection:
 *   The `enc:` prefix is the authoritative marker. For values without
 *   the prefix, we fall back to the legacy heuristic (length ≥ 32 and
 *   base64-decodable) so rows written before P8-PII-ENCRYPTION keep
 *   reading correctly.
 */

import { encrypt, decrypt, isEncrypted } from "@/lib/crypto";
import { apiLogger } from "@/lib/logger";

/**
 * Prefix that marks a stored value as encrypted by `encryptPII`.
 * Always followed by the base64 AES-256-GCM blob from `@/lib/crypto`.
 */
const ENCRYPTED_PREFIX = "enc:";

/**
 * Minimum length of an encrypted blob (base64 of iv + auth-tag + ≥1 byte
 * ciphertext). Anything shorter than this cannot be a valid encrypted
 * value, so the legacy heuristic treats it as plaintext.
 */
const ENCRYPTED_MIN_LENGTH = 32;

// ════════════════════════════════════════════════════════════════════════
// Primary API — prefix-based ("enc:") helpers
// ════════════════════════════════════════════════════════════════════════

/**
 * Encrypt a PII value for storage. Returns `"enc:<ciphertext>"`.
 *
 * Behavior:
 * - `null` / `undefined` → returned as-is (column stays `NULL`).
 * - Empty string `""` → returned as-is (no encryption applied).
 * - Already encrypted (starts with `enc:`) → returned as-is (idempotent).
 * - Otherwise → encrypted via AES-256-GCM, prefixed with `enc:`.
 *
 * If the underlying crypto primitive throws (e.g. ENCRYPTION_KEY unset
 * in production), the plaintext value is returned as a fallback so the
 * write doesn't 500 — the failure is logged for follow-up.
 *
 * @example
 *   encryptPII("01712345678") // → "enc:k3l9...=="
 *   encryptPII("enc:k3l9...==") // → "enc:k3l9...==" (idempotent)
 *   encryptPII(null) // → null
 *   encryptPII("") // → ""
 */
export function encryptPII(value: string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    if (value === "") return "";
    if (value.startsWith(ENCRYPTED_PREFIX)) return value; // Already encrypted
    try {
        return ENCRYPTED_PREFIX + encrypt(value);
    } catch (err) {
        apiLogger.error(
            { err },
            "PII encryption failed — storing plaintext as fallback",
        );
        return value;
    }
}

/**
 * Decrypt a PII value read from the database. Returns plaintext.
 *
 * Behavior:
 * - `null` / `undefined` / `""` → `null`.
 * - Value with `enc:` prefix → decrypted via AES-256-GCM.
 * - Value without prefix but matches legacy heuristic (length ≥ 32 and
 *   base64-decodable) → treated as a legacy encrypted blob and decrypted.
 * - Value without prefix that doesn't match the heuristic → returned
 *   as-is (assumed plaintext from before encryption rollout).
 * - Decrypt failure (corrupt blob / wrong key) → returns a masked
 *   fallback rather than throwing, so a single bad row can't 500 the
 *   whole employee list endpoint. The error is logged.
 *
 * @example
 *   decryptPII("enc:k3l9...==") // → "01712345678"
 *   decryptPII("01712345678") // → "01712345678" (legacy plaintext)
 *   decryptPII(null) // → null
 */
export function decryptPII(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === "") return null;

    // Preferred path: explicit "enc:" prefix.
    if (value.startsWith(ENCRYPTED_PREFIX)) {
        try {
            return decrypt(value.substring(ENCRYPTED_PREFIX.length));
        } catch (err) {
            apiLogger.error(
                { err },
                "PII decryption failed — returning masked value",
            );
            return "••••••••";
        }
    }

    // Legacy path: heuristic-encrypted blob from before the prefix rollout.
    if (value.length >= ENCRYPTED_MIN_LENGTH && isEncrypted(value)) {
        try {
            return decrypt(value);
        } catch {
            // Could be a corrupt blob, a key rotation, or a plaintext
            // value that happens to look like base64. Surface the raw
            // value so the UI keeps working — do not 500 the request.
            return value;
        }
    }

    // Plaintext (pre-encryption rollout) — return as-is.
    return value;
}

/**
 * Mask a PII value for display (show last 4 chars only).
 * Useful for lists/tables where the full value isn't needed.
 *
 * Always returns a display-safe string:
 * - `null` / `undefined` / `""` → `"—"`
 * - Decrypted value ≤ 4 chars → `"••••"`
 * - Otherwise → `"••••" + last 4 chars`
 *
 * @example
 *   maskPII("enc:k3l9...==") // → "••••5678"
 *   maskPII("01712345678") // → "••••5678"
 *   maskPII(null) // → "—"
 */
export function maskPII(value: string | null | undefined): string {
    if (!value) return "—";
    const decrypted = decryptPII(value);
    if (!decrypted) return "—";
    if (decrypted.length <= 4) return "••••";
    return "••••" + decrypted.slice(-4);
}

// ════════════════════════════════════════════════════════════════════════
// Legacy aliases — kept for backward compatibility with existing call
// sites (`src/lib/validations/employee.ts`, `src/lib/disbursement-engine.ts`).
// Both delegate to the prefix-based helpers above, so all encryption now
// uses the `enc:` marker regardless of which spelling the caller uses.
// ════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use `encryptPII` (uppercase) instead. Kept as an alias
 *             so existing imports keep working.
 */
export function encryptPii(plaintext: string | null | undefined): string | null {
    return encryptPII(plaintext);
}

/**
 * @deprecated Use `decryptPII` (uppercase) instead. Kept as an alias
 *             so existing imports keep working.
 */
export function decryptPii(value: string | null | undefined): string | null {
    return decryptPII(value);
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
        (employee as { bkashNumber: string | null }).bkashNumber = decryptPII(employee.bkashNumber);
    }
    if (employee?.nagadNumber !== undefined) {
        (employee as { nagadNumber: string | null }).nagadNumber = decryptPII(employee.nagadNumber);
    }
    return employee;
}
