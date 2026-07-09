import { test, expect } from "@playwright/test";

/**
 * Authentication E2E Tests
 *
 * Smoke-level coverage of the public auth surface and the
 * unauthenticated-redirect boundary. These tests do NOT require a
 * database or seeded users — they only assert that:
 *   - Public auth pages render
 *   - Invalid credentials keep the user on /login
 *   - Protected app routes redirect to /login when no session is present
 *
 * Tests run against `playwright.no-server.config.ts` in CI (server provided
 * externally) and against `playwright.config.ts` locally (webServer block
 * starts `next dev`).
 */

test.describe("Authentication", () => {
    test("login page loads", async ({ page }) => {
        await page.goto("/login");
        await expect(
            page.locator("h1, h2, [role='heading']").first(),
        ).toBeVisible();
    });

    test("login with invalid credentials shows error", async ({ page }) => {
        await page.goto("/login");
        await page.fill('input[type="email"]', "nonexistent@example.com");
        await page.fill('input[type="password"]', "wrongpassword");
        await page.click('button[type="submit"]');
        // Wait for error message — user should stay on /login
        await expect(page).toHaveURL(/\/login/);
    });

    test("register page loads", async ({ page }) => {
        await page.goto("/register");
        await expect(
            page.locator("h1, h2, [role='heading']").first(),
        ).toBeVisible();
    });

    test("forgot password page loads", async ({ page }) => {
        await page.goto("/forgot-password");
        await expect(
            page.locator("h1, h2, [role='heading']").first(),
        ).toBeVisible();
    });

    test("unauthenticated user redirected from dashboard", async ({ page }) => {
        await page.goto("/dashboard");
        await expect(page).toHaveURL(/\/login/);
    });

    test("unauthenticated user redirected from ESS", async ({ page }) => {
        await page.goto("/ess/dashboard");
        await expect(page).toHaveURL(/\/login/);
    });

    test("unauthenticated user redirected from manager", async ({ page }) => {
        await page.goto("/manager/dashboard");
        await expect(page).toHaveURL(/\/login/);
    });

    test("platform login page loads", async ({ page }) => {
        await page.goto("/platform/login");
        await expect(
            page.locator("h1, h2, [role='heading']").first(),
        ).toBeVisible();
    });
});
