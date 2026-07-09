#!/usr/bin/env node
/**
 * Force-encrypt all existing employee PII (bkashNumber, nagadNumber).
 *
 * Run:  node scripts/encrypt-existing-pii.js
 *
 * Why this script exists:
 *   P8-PII-ENCRYPTION migrates Employee.bkashNumber / nagadNumber from
 *   plaintext to AES-256-GCM encrypted form with an `enc:` prefix.
 *   Existing rows written before the cutover still hold plaintext.
 *   `decryptPII()` reads them correctly (backward-compatible), but
 *   they only get re-encrypted on the next write through the Employee
 *   API. This script force-encrypts every row in one pass so a
 *   compliance audit sees no plaintext at rest.
 *
 * What it does:
 *   1. Loads ENCRYPTION_KEY from env (matches `src/lib/crypto.ts`).
 *      Falls back to the dev key in non-production, throws in prod.
 *   2. Reads all employees with non-null bkashNumber or nagadNumber.
 *   3. For each value that isn't already `enc:`-prefixed, encrypts it
 *      using AES-256-GCM with the same format as `src/lib/crypto.ts`
 *      (base64(iv[16] + ciphertext + authTag[16])) and prefixes
 *      `enc:`.
 *   4. Writes the encrypted values back in batches.
 *
 * Idempotent: safe to run multiple times — already-encrypted values
 * are skipped.
 */

const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCRYPTED_PREFIX = "enc:";

/**
 * Resolve the AES-256 key. Mirrors `src/lib/crypto.ts`:
 *   - 64-hex-char ENCRYPTION_KEY env var → used directly.
 *   - Missing/invalid in non-production → deterministic dev key.
 *   - Missing/invalid in production → throw.
 */
function getEncryptionKey() {
    const keyHex = process.env.ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes) in production. " +
                    "Generate with: openssl rand -hex 32",
            );
        }
        const devKey = Buffer.alloc(32, 0);
        Buffer.from("peopleflow-dev-key-not-for-prod!!").copy(devKey);
        return devKey;
    }
    return Buffer.from(keyHex, "hex");
}

/**
 * Encrypt plaintext using AES-256-GCM. Returns base64(iv + ciphertext + authTag).
 * Mirrors `src/lib/crypto.ts` so values are interchangeable.
 */
function encrypt(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

/**
 * Encrypt with the `enc:` prefix. Idempotent — no-op if already prefixed.
 */
function encryptPII(value) {
    if (!value) return null;
    if (value.startsWith(ENCRYPTED_PREFIX)) return value;
    return ENCRYPTED_PREFIX + encrypt(value);
}

async function main() {
    console.log("P8-PII-ENCRYPTION: force-encrypting existing employee PII…\n");

    const employees = await prisma.employee.findMany({
        where: {
            OR: [{ bkashNumber: { not: null } }, { nagadNumber: { not: null } }],
        },
        select: { id: true, employeeCode: true, bkashNumber: true, nagadNumber: true },
    });

    console.log(`Found ${employees.length} employees with PII to inspect.`);

    let updated = 0;
    let skipped = 0;

    for (const emp of employees) {
        const updates = {};

        if (emp.bkashNumber && !emp.bkashNumber.startsWith(ENCRYPTED_PREFIX)) {
            updates.bkashNumber = encryptPII(emp.bkashNumber);
        }

        if (emp.nagadNumber && !emp.nagadNumber.startsWith(ENCRYPTED_PREFIX)) {
            updates.nagadNumber = encryptPII(emp.nagadNumber);
        }

        if (Object.keys(updates).length === 0) {
            skipped++;
            continue;
        }

        await prisma.employee.update({ where: { id: emp.id }, data: updates });
        updated++;
        console.log(`  ✓ ${emp.employeeCode}: encrypted ${Object.keys(updates).join(", ")}`);
    }

    console.log(`\nDone. ${updated} employees updated, ${skipped} already encrypted (skipped).`);
}

main()
    .catch((err) => {
        console.error("FATAL:", err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
