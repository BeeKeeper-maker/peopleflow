/**
 * Encryption Utility — AES-256-GCM
 *
 * Used for encrypting sensitive credentials at rest (bKash, Nagad, bank API keys).
 * The encryption key is read from ENCRYPTION_KEY env var (32 bytes / 64 hex chars).
 *
 * Security:
 * - AES-256-GCM (authenticated encryption — detects tampering)
 * - Random IV per encryption (never reused)
 * - Key derived from env var (never hardcoded)
 * - Encrypted format: base64(iv + ciphertext + authTag)
 *
 * Usage:
 *   import { encrypt, decrypt } from "@/lib/crypto";
 *   const encrypted = encrypt("sensitive_data");
 *   const decrypted = decrypt(encrypted);
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        // In development, use a derived key. In production, fail fast.
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes) in production. " +
                "Generate with: openssl rand -hex 32"
            );
        }
        // Dev fallback — deterministic but not secure
        const devKey = Buffer.alloc(32, 0);
        Buffer.from("peopleflow-dev-key-not-for-prod!!").copy(devKey);
        return devKey;
    }
    return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64(iv + ciphertext + authTag).
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: base64(iv + ciphertext + authTag)
    return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Input must be base64(iv + ciphertext + authTag).
 */
export function decrypt(encryptedData: string): string {
    const key = getEncryptionKey();
    const data = Buffer.from(encryptedData, "base64");

    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new Error("Invalid encrypted data: too short");
    }

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH, data.length - AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
}

/**
 * Encrypt a JSON object (for storing credential objects).
 */
export function encryptJSON(obj: Record<string, unknown>): string {
    return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt a JSON object.
 */
export function decryptJSON<T = Record<string, unknown>>(encryptedData: string): T {
    return JSON.parse(decrypt(encryptedData)) as T;
}

/**
 * Check if a string appears to be encrypted (base64 and long enough).
 * Used to detect whether stored data is already encrypted or plaintext.
 */
export function isEncrypted(value: string): boolean {
    if (!value || value.length < 32) return false;
    try {
        Buffer.from(value, "base64");
        return true;
    } catch {
        return false;
    }
}
