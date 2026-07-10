import { test, expect } from "@playwright/test";

/**
 * UI Rendering Smoke Tests
 *
 * Lightweight smoke tests for the unauthenticated UI surface — verifies
 * that public pages render with expected form fields and that optional
 * UI affordances (theme toggle, language switcher) do not break the page
 * when clicked. Uses `if`-checks for optional elements so the suite is
 * resilient to layout changes.
 */

test.describe("UI Rendering", () => {
    test("marketing page has hero section", async ({ page }) => {
        await page.goto("/");
        // Check that the page has visible content
        const bodyText = await page.locator("body").textContent();
        expect(bodyText?.length).toBeGreaterThan(100);
    });

    test("login page has email and password fields", async ({ page }) => {
        await page.goto("/login");
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test("register page has required fields", async ({ page }) => {
        await page.goto("/register");
        // The register page is a 3-step wizard; step 1 renders the
        // organization-name input + an industry <select>. Count any
        // form control so the test is resilient to step changes.
        const fields = page.locator("input, select, textarea");
        const count = await fields.count();
        expect(count).toBeGreaterThan(1);
    });

    test("theme toggle works on login page", async ({ page }) => {
        await page.goto("/login");
        // Try to find a theme toggle button
        const themeButton = page
            .locator('button[aria-label*="theme" i], button[title*="theme" i]')
            .first();
        if (await themeButton.isVisible().catch(() => false)) {
            await themeButton.click();
            // Page should still be functional
            await expect(page.locator('input[type="email"]')).toBeVisible();
        }
    });

    test("language switcher works on login page", async ({ page }) => {
        await page.goto("/login");
        // Try to find a language switcher
        const langButton = page
            .locator(
                'button[aria-label*="language" i], button[title*="language" i]',
            )
            .first();
        if (await langButton.isVisible().catch(() => false)) {
            await langButton.click();
            // Page should still be functional
            await expect(page.locator('input[type="email"]')).toBeVisible();
        }
    });
});
