import { test, expect, type Page } from '@playwright/test';

async function loginAsEmployee(page: Page) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    const email = page.locator('input[type="email"]');
    const password = page.locator('input[type="password"]');
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();
    await email.fill('fatima@demo.com');
    await password.fill('Admin@123');
    await expect(email).toHaveValue('fatima@demo.com');
    await expect(password).toHaveValue('Admin@123');

    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/ess/dashboard', { timeout: 30000 });
}

async function expectNoHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.clientWidth + 2);
    expect(overflow.bodyScrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

test.describe('Employee mobile experience', () => {
    test('employee login lands on ESS dashboard with install CTA and bottom navigation', async ({ page }) => {
        await loginAsEmployee(page);

        await expect(page.getByText('PeopleFlow mobile app')).toBeVisible();

        const quickNav = page.getByRole('navigation', { name: 'Employee quick actions' });
        await expect(quickNav).toBeVisible();
        await expect(quickNav.getByText('Home')).toBeVisible();
        await expect(quickNav.getByText('Time')).toBeVisible();
        await expect(quickNav.getByText('Leave')).toBeVisible();
        await expect(quickNav.getByText('Pay')).toBeVisible();
        await expect(quickNav.getByText('Profile')).toBeVisible();

        await expectNoHorizontalOverflow(page);
    });

    test('employee bottom navigation opens critical ESS pages on phone width', async ({ page }) => {
        await loginAsEmployee(page);
        const quickNav = page.getByRole('navigation', { name: 'Employee quick actions' });

        await quickNav.getByText('Time').click();
        await page.waitForURL('**/ess/attendance');
        await expectNoHorizontalOverflow(page);

        await quickNav.getByText('Leave').click();
        await page.waitForURL('**/ess/leaves');
        await expectNoHorizontalOverflow(page);

        await quickNav.getByText('Pay').click();
        await page.waitForURL('**/ess/payslips');
        await expectNoHorizontalOverflow(page);

        await quickNav.getByText('Profile').click();
        await page.waitForURL('**/ess/profile');
        await expectNoHorizontalOverflow(page);
    });

    test('authenticated employee is redirected away from admin dashboard and login page', async ({ page }) => {
        await loginAsEmployee(page);

        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await page.waitForURL('**/ess/dashboard');

        await page.goto('/login', { waitUntil: 'domcontentloaded' });
        await page.waitForURL('**/ess/dashboard');
    });
});
