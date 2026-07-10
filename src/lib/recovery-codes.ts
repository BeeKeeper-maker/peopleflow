/**
 * PeopleFlow 2FA Recovery Codes
 *
 * Generates, hashes, and verifies single-use recovery codes for 2FA.
 *
 * When a user enables 2FA:
 *   1. 10 recovery codes are generated (format: XXXX-XXXX-XXXX-XXXX)
 *   2. Each code is hashed with bcrypt
 *   3. Hashed codes are stored in User.twoFactorRecoveryCodes[]
 *   4. Plaintext codes are returned to the user ONCE (shown in UI)
 *
 * When a user logs in with a recovery code:
 *   1. The code is compared against all stored hashes (bcrypt.compare)
 *   2. If matched, the code is removed from the array (single-use)
 *   3. Login proceeds normally
 *   4. If < 3 codes remain, a warning notification is sent
 *
 * Regeneration:
 *   - User can regenerate codes at any time via /api/auth/2fa/recovery-codes
 *   - All old codes are invalidated
 *   - New codes are shown ONCE
 */

import bcrypt from "bcryptjs";
import crypto from "crypto";

const CODE_COUNT = 10;
const CODE_SEGMENTS = 4;
const SEGMENT_LENGTH = 4;
const BCRYPT_ROUNDS = 10; // Lower than password hashing (12) since codes are random

/**
 * Generate a single recovery code in format: XXXX-XXXX-XXXX-XXXX
 * Uses crypto.randomBytes for cryptographic randomness.
 * Characters: uppercase letters + digits (no confusing chars: 0, O, I, 1)
 */
function generateSingleCode(): string {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No 0, O, I, 1
    const segments: string[] = [];

    for (let s = 0; s < CODE_SEGMENTS; s++) {
        let segment = "";
        const bytes = crypto.randomBytes(SEGMENT_LENGTH);
        for (let i = 0; i < SEGMENT_LENGTH; i++) {
            segment += charset[bytes[i] % charset.length];
        }
        segments.push(segment);
    }

    return segments.join("-");
}

/**
 * Generate `count` recovery codes and their bcrypt hashes.
 * Returns both plaintext (for one-time display) and hashes (for storage).
 */
export async function generateRecoveryCodes(
    count: number = CODE_COUNT,
): Promise<{ plaintext: string[]; hashes: string[] }> {
    const plaintext: string[] = [];
    const hashes: string[] = [];

    for (let i = 0; i < count; i++) {
        const code = generateSingleCode();
        const hash = await bcrypt.hash(code, BCRYPT_ROUNDS);
        plaintext.push(code);
        hashes.push(hash);
    }

    return { plaintext, hashes };
}

/**
 * Verify a recovery code against the stored hashes.
 * If matched, returns the index of the matched hash (so caller can remove it).
 * If no match, returns null.
 *
 * Note: This is O(n) bcrypt comparisons (n = number of stored codes, ~10).
 * Acceptable for login flows (infrequent).
 */
export async function verifyRecoveryCode(
    code: string,
    storedHashes: string[],
): Promise<number | null> {
    // Normalize: uppercase + add dashes if user typed without them
    const normalized = normalizeCode(code);

    for (let i = 0; i < storedHashes.length; i++) {
        try {
            const match = await bcrypt.compare(normalized, storedHashes[i]);
            if (match) return i;
        } catch {
            // Invalid hash — skip
        }
    }

    return null;
}

/**
 * Normalize a recovery code input:
 *   - Uppercase
 *   - Remove spaces
 *   - Add dashes if missing (e.g., "ABCD1234EFGH5678" → "ABCD-1234-EFGH-5678")
 */
function normalizeCode(input: string): string {
    let normalized = input.trim().toUpperCase().replace(/\s/g, "");

    // If user typed without dashes, add them every 4 characters
    if (!normalized.includes("-") && normalized.length === CODE_SEGMENTS * SEGMENT_LENGTH) {
        const segments: string[] = [];
        for (let i = 0; i < CODE_SEGMENTS; i++) {
            segments.push(normalized.substring(i * SEGMENT_LENGTH, (i + 1) * SEGMENT_LENGTH));
        }
        normalized = segments.join("-");
    }

    return normalized;
}

/**
 * Format a recovery code for display (with monospace-friendly dashes).
 */
export function formatRecoveryCode(code: string): string {
    return code;
}

/**
 * Get the number of remaining recovery codes (for UI display).
 * Does NOT return the codes themselves — only the count.
 */
export function getRemainingCodeCount(storedHashes: string[]): number {
    return storedHashes.length;
}

/**
 * Check if the user should be warned about low recovery codes.
 * Returns true if < 3 codes remain.
 */
export function shouldWarnLowCodes(storedHashes: string[]): boolean {
    return storedHashes.length < 3;
}
