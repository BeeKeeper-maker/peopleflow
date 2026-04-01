/**
 * Unit Tests: API Key Authentication
 */

import { describe, it, expect } from "vitest";
import { hashApiKey, generateApiKey } from "@/lib/api-key-auth";

describe("API Key Authentication", () => {
    describe("generateApiKey", () => {
        it("generates a live key with correct prefix", () => {
            const key = generateApiKey("live");
            expect(key).toMatch(/^pf_live_/);
            expect(key.length).toBeGreaterThan(20);
        });

        it("generates a test key with correct prefix", () => {
            const key = generateApiKey("test");
            expect(key).toMatch(/^pf_test_/);
        });

        it("generates unique keys each time", () => {
            const key1 = generateApiKey("live");
            const key2 = generateApiKey("live");
            expect(key1).not.toBe(key2);
        });
    });

    describe("hashApiKey", () => {
        it("returns consistent hash for same input", () => {
            const key = "pf_live_test123";
            const hash1 = hashApiKey(key);
            const hash2 = hashApiKey(key);
            expect(hash1).toBe(hash2);
        });

        it("returns different hash for different input", () => {
            const hash1 = hashApiKey("pf_live_key1");
            const hash2 = hashApiKey("pf_live_key2");
            expect(hash1).not.toBe(hash2);
        });

        it("returns a 64-character hex string (SHA256)", () => {
            const hash = hashApiKey("pf_live_test");
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });
    });
});
