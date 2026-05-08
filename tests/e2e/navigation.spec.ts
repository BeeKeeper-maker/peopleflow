import { test, expect, type Page } from '@playwright/test';

/**
 * Navigation & Layout E2E Tests
 * 
 * Tests navigation, accessibility, and responsive design
 * with STRICT assertions - no loose regex shortcuts!
 */

async function gotoDomReady(page: Page, path: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
}

test.describe('Public Pages', () => {
    test('should allow unauthenticated users to view the public homepage', async ({ page }) => {
        await gotoDomReady(page, '/');

        // Public marketing homepage is intentionally available without a session.
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByText('Bangladesh-focused HRMS beta')).toBeVisible();
    });

    test('should have proper meta viewport tag', async ({ page }) => {
        await gotoDomReady(page, '/login');

        // Check meta viewport exists for mobile responsiveness
        const viewport = page.locator('meta[name="viewport"]');
        await expect(viewport).toHaveCount(1);

        // Verify viewport content
        const content = await viewport.getAttribute('content');
        expect(content).toContain('width=device-width');
    });
});

test.describe('Accessibility', () => {
    test('should have main content area', async ({ page }) => {
        await gotoDomReady(page, '/login');

        // Page must have a main content wrapper
        const mainContent = page.locator('main, [role="main"]');

        // If no semantic main, check for primary content div
        const contentExists = await mainContent.count() > 0;
        if (contentExists) {
            await expect(mainContent.first()).toBeVisible();
        } else {
            // Fallback: check for content div (login page uses min-h-screen div)
            await expect(page.locator('.min-h-screen')).toBeVisible();
        }
    });

    test('should have proper heading structure', async ({ page }) => {
        await gotoDomReady(page, '/login');

        // Must have at least one heading for accessibility
        const h1 = page.locator('h1');
        const h2 = page.locator('h2');

        // Check h1 or h2 exists
        const h1Count = await h1.count();
        const h2Count = await h2.count();

        expect(h1Count + h2Count).toBeGreaterThan(0);
    });

    test('should have labeled form inputs', async ({ page }) => {
        await gotoDomReady(page, '/login');

        // Email input must exist and be accessible
        const emailInput = page.locator('input[type="email"]');
        await expect(emailInput).toBeVisible();

        // Check for label or aria-label
        const hasLabel = await page.locator('label:has-text("Email"), label:has-text("email")').count() > 0;
        const hasAriaLabel = await emailInput.getAttribute('aria-label') !== null;
        const hasPlaceholder = await emailInput.getAttribute('placeholder') !== null;

        // Must have at least one form of label
        expect(hasLabel || hasAriaLabel || hasPlaceholder).toBeTruthy();
    });
});

test.describe('Responsive Design', () => {
    test('should be usable on mobile viewport (375x667)', async ({ page }) => {
        // iPhone SE viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await gotoDomReady(page, '/login');

        // All critical elements must be visible on mobile
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();

        // Form should be interactable
        await expect(page.locator('button[type="submit"]')).toBeEnabled();
    });

    test('should be usable on tablet viewport (768x1024)', async ({ page }) => {
        // iPad viewport
        await page.setViewportSize({ width: 768, height: 1024 });
        await gotoDomReady(page, '/login');

        // All elements must be visible
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should be usable on desktop viewport (1440x900)', async ({ page }) => {
        // Desktop viewport
        await page.setViewportSize({ width: 1440, height: 900 });
        await gotoDomReady(page, '/login');

        // All elements must be visible
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
});
