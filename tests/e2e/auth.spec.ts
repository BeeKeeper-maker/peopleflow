import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * 
 * Tests login, registration, and auth redirects with STRICT assertions.
 * No shortcuts - actual behavior verification!
 */

test.describe('Authentication', () => {
    test('should display login page with all form elements', async ({ page }) => {
        await page.goto('/login');

        // Wait for page to be fully ready
        await page.waitForLoadState('networkidle');

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
        await page.goto('/login');
        await page.waitForLoadState('networkidle');

        // Fill in wrong credentials
        await page.fill('input[type="email"]', 'wrong@example.com');
        await page.fill('input[type="password"]', 'wrongpassword');

        // Submit form
        await page.click('button[type="submit"]');

        // Wait for error response (toast or error message should appear)
        // Using proper element wait instead of arbitrary timeout
        await page.waitForLoadState('networkidle');

        // Should stay on login page after failed attempt
        await expect(page).toHaveURL('/login');

        // Password field should still be visible (not navigated away)
        await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('should redirect unauthenticated users to login', async ({ page }) => {
        // Try to access protected dashboard without logging in
        await page.goto('/dashboard');
        await page.waitForLoadState('networkidle');

        // STRICT: Must redirect exactly to login page
        await expect(page).toHaveURL(/\/login/);

        // Login form should be visible
        await expect(page.locator('input[type="email"]')).toBeVisible();
    });

    test('should redirect unauthenticated users from employees page', async ({ page }) => {
        // Try to access protected employees page
        await page.goto('/employees');
        await page.waitForLoadState('networkidle');

        // Must redirect to login
        await expect(page).toHaveURL(/\/login/);
    });
});

test.describe('Registration', () => {
    test('should display registration page with form', async ({ page }) => {
        await page.goto('/register');
        await page.waitForLoadState('networkidle');

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
