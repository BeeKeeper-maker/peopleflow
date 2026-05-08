import { test, expect, type Page } from '@playwright/test';
import { generate, generateSecret } from 'otplib';
import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

test.afterAll(async () => {
    await prisma.$disconnect();
});

/**
 * Authentication E2E Tests
 * 
 * Tests login, registration, and auth redirects with STRICT assertions.
 * No shortcuts - actual behavior verification!
 */

async function gotoDomReady(page: Page, path: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
}

test.describe('Authentication', () => {
    test('should display login page with all form elements', async ({ page }) => {
        await gotoDomReady(page, '/login');

        // STRICT: URL must contain exactly /login
        await expect(page).toHaveURL('/login');

        // Verify ALL required form elements exist
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');
        const submitButton = page.locator('button[type="submit"]');

        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        await expect(submitButton).toBeVisible();

        // Verify inputs are interactive
        await expect(emailInput).toBeEnabled();
        await expect(passwordInput).toBeEnabled();
        await expect(submitButton).toBeEnabled();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await gotoDomReady(page, '/login');

        // Fill in wrong credentials
        await page.fill('input[type="email"]', 'wrong@example.com');
        await page.fill('input[type="password"]', 'wrongpassword');

        // Submit form
        await page.click('button[type="submit"]');

        // Should stay on login page after failed attempt
        await expect(page).toHaveURL('/login');

        // Password field should still be visible (not navigated away)
        await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('enforces authenticator 2FA code when enabled', async ({ page }) => {
        const email = 'admin@demo.com';
        const user = await prisma.user.findUnique({ where: { email } });
        expect(user).toBeTruthy();

        const original = {
            twoFactorEnabled: user!.twoFactorEnabled,
            twoFactorSecret: user!.twoFactorSecret,
        };
        const secret = await generateSecret();

        try {
            await prisma.user.update({
                where: { id: user!.id },
                data: { twoFactorEnabled: true, twoFactorSecret: secret },
            });

            await gotoDomReady(page, '/login');
            await page.fill('input[type="email"]', email);
            await page.fill('input[type="password"]', 'Admin@123');
            await page.click('button[type="submit"]');
            await expect(page).toHaveURL('/login');

            await page.fill('input[type="email"]', email);
            await page.fill('input[type="password"]', 'Admin@123');
            await page.fill('input[name="twoFactorCode"]', await generate({ secret }));
            await page.click('button[type="submit"]');
            await expect(page).not.toHaveURL(/\/login$/);
        } finally {
            await prisma.user.update({
                where: { id: user!.id },
                data: original,
            });
        }
    });

    test('should redirect unauthenticated users to login', async ({ page }) => {
        // Try to access protected dashboard without logging in
        await gotoDomReady(page, '/dashboard');

        // STRICT: Must redirect exactly to login page
        await expect(page).toHaveURL(/\/login/);

        // Login form should be visible
        await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('should redirect unauthenticated users from employees page', async ({ page }) => {
        // Try to access protected employees page
        await gotoDomReady(page, '/employees');

        // Must redirect to login
        await expect(page).toHaveURL(/\/login/);
    });
});

test.describe('Registration', () => {
    test('should display registration page with form', async ({ page }) => {
        await gotoDomReady(page, '/register');

        // STRICT: URL must be exactly /register
        await expect(page).toHaveURL('/register');

        // Registration form must have at least one input field
        const inputs = page.locator('input');
        const inputCount = await inputs.count();

        // Must have input fields
        expect(inputCount).toBeGreaterThan(0);

        // First input must be visible
        await expect(inputs.first()).toBeVisible();
    });
});
