import { test, expect } from "@playwright/test";

/**
 * Public Pages E2E Tests
 *
 * Verifies that the unauthenticated surface of the app — the marketing
 * page, legal pages, and the health-check endpoints — renders and
 * responds as expected. No DB or Redis required.
 */

test.describe("Public Pages", () => {
    test("marketing page loads", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("body")).toBeVisible();
    });

    test("health endpoint returns 200", async ({ request }) => {
        const response = await request.get("/api/health");
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.status).toBe("healthy");
    });

    test("deep health endpoint returns 200", async ({ request }) => {
        const response = await request.get("/api/health?deep=1");
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.mode).toBe("deep");
    });

    test("terms page loads", async ({ page }) => {
        await page.goto("/legal/terms");
        await expect(page.locator("body")).toBeVisible();
    });

    test("privacy page loads", async ({ page }) => {
        await page.goto("/legal/privacy");
        await expect(page.locator("body")).toBeVisible();
    });
});
