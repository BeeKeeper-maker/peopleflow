import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

async function login(browser: Browser, email: string) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Admin@123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    return { context, page };
}

async function closeAll(...items: Array<{ context: BrowserContext; page: Page } | undefined>) {
    for (const item of items) {
        await item?.page.close().catch(() => undefined);
        await item?.context.close().catch(() => undefined);
    }
}

function uniqueFutureDate(seedOffset = 0) {
    const date = new Date(Date.UTC(2035, 0, 1));
    date.setUTCDate(date.getUTCDate() + (Date.now() % 3000) + seedOffset);
    return date.toISOString().slice(0, 10);
}

function reusableExpenseCategory<T extends { id: string; name?: string }>(categories: T[]): T {
    return categories.find((category) => category.name === 'Office Supplies') ?? categories[0];
}

test.describe('Core office workflow happy paths', () => {
    test('employee submits expense and HR/admin approves it', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');
        const hr = await login(browser, 'rahim@demo.com');

        try {
            const categoriesResponse = await employee.context.request.get('/api/expenses/categories?active=true');
            expect(categoriesResponse.ok()).toBeTruthy();
            const categories = await categoriesResponse.json();
            expect(categories.length).toBeGreaterThan(0);

            const title = `Office workflow expense ${Date.now()}`;
            const createResponse = await employee.context.request.post('/api/expenses/claims', {
                data: {
                    title,
                    description: 'Created by automated happy-path regression',
                    amount: 321,
                    categoryId: reusableExpenseCategory(categories).id,
                    expenseDate: new Date().toISOString(),
                    status: 'submitted',
                },
            });
            expect(createResponse.status()).toBe(201);
            const claim = await createResponse.json();
            expect(claim.status).toBe('submitted');

            const pendingResponse = await hr.context.request.get('/api/expenses/claims?pending=true');
            expect(pendingResponse.ok()).toBeTruthy();
            const pendingClaims = await pendingResponse.json();
            expect(pendingClaims.some((item: { id: string }) => item.id === claim.id)).toBeTruthy();

            // Default expense approval is multi-step: manager → HR/Finance.
            const managerStepResponse = await hr.context.request.patch(`/api/expenses/claims/${claim.id}`, {
                data: { action: 'approve', notes: 'Manager step approved by workflow regression' },
            });
            expect(managerStepResponse.ok()).toBeTruthy();
            const managerStep = await managerStepResponse.json();
            expect(managerStep.approvalTrail.status).toBe('in_progress');

            const hrStepResponse = await hr.context.request.patch(`/api/expenses/claims/${claim.id}`, {
                data: { action: 'approve', notes: 'HR/Finance final approval by workflow regression' },
            });
            expect(hrStepResponse.ok()).toBeTruthy();
            const hrStep = await hrStepResponse.json();
            expect(hrStep.approvalTrail.status).toBe('approved');

            const employeeClaimsResponse = await employee.context.request.get('/api/expenses/claims');
            expect(employeeClaimsResponse.ok()).toBeTruthy();
            const employeeClaims = await employeeClaimsResponse.json();
            const updated = employeeClaims.find((item: { id: string }) => item.id === claim.id);
            expect(updated).toBeTruthy();
            expect(updated.status).toBe('approved');
        } finally {
            await closeAll(employee, hr);
        }
    });

    test('employee applies for half-day leave and HR/admin approval updates balance', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');
        const hr = await login(browser, 'rahim@demo.com');

        try {
            const allocationsBeforeResponse = await employee.context.request.get('/api/leaves/allocations');
            expect(allocationsBeforeResponse.ok()).toBeTruthy();
            const allocationsBefore = await allocationsBeforeResponse.json();
            const allocationBefore = allocationsBefore.find((item: { leaveType: { code?: string }, remainingDays: number }) => item.leaveType.code !== 'ML' && item.remainingDays >= 0.5);
            expect(allocationBefore).toBeTruthy();

            const leaveTypeId = allocationBefore.leaveType.id;
            const usedBefore = Number(allocationBefore.usedDays ?? 0);

            const date = uniqueFutureDate(11);

            const createResponse = await employee.context.request.post('/api/leaves/applications', {
                data: {
                    leaveTypeId,
                    fromDate: date,
                    toDate: date,
                    halfDay: true,
                    halfDayType: 'first_half',
                    reason: 'Automated happy-path regression',
                },
            });
            expect(createResponse.ok()).toBeTruthy();
            const application = await createResponse.json();
            expect(application.status).toBe('pending');
            expect(Number(application.totalDays)).toBe(0.5);

            const pendingResponse = await hr.context.request.get('/api/leaves/applications?status=pending');
            expect(pendingResponse.ok()).toBeTruthy();
            const pendingPayload = await pendingResponse.json();
            expect(pendingPayload.data.some((item: { id: string }) => item.id === application.id)).toBeTruthy();

            // Default leave approval is multi-step: manager → HR.
            const managerStepResponse = await hr.context.request.put(`/api/leaves/applications/${application.id}`, {
                data: { status: 'approved', managerComment: 'Manager step approved by workflow regression' },
            });
            expect(managerStepResponse.ok()).toBeTruthy();
            const managerStep = await managerStepResponse.json();
            expect(managerStep.status).toBe('in_progress');

            const hrStepResponse = await hr.context.request.put(`/api/leaves/applications/${application.id}`, {
                data: { status: 'approved', managerComment: 'HR final approval by workflow regression' },
            });
            expect(hrStepResponse.ok()).toBeTruthy();
            const hrStep = await hrStepResponse.json();
            expect(hrStep.status).toBe('approved');

            const approvedResponse = await employee.context.request.get(`/api/leaves/applications/${application.id}`);
            expect(approvedResponse.ok()).toBeTruthy();
            const approved = await approvedResponse.json();
            expect(approved.status).toBe('approved');

            const allocationsAfterResponse = await employee.context.request.get('/api/leaves/allocations');
            expect(allocationsAfterResponse.ok()).toBeTruthy();
            const allocationsAfter = await allocationsAfterResponse.json();
            const allocationAfter = allocationsAfter.find((item: { leaveType: { id: string } }) => item.leaveType.id === leaveTypeId);
            expect(allocationAfter).toBeTruthy();
            expect(Number(allocationAfter.usedDays)).toBeCloseTo(usedBefore + 0.5, 5);
        } finally {
            await closeAll(employee, hr);
        }
    });
});
