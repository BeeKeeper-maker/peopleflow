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

async function employeeIdFor(context: BrowserContext, email: string) {
    const response = await context.request.get(`/api/employees?search=${encodeURIComponent(email)}`);
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    const employees = Array.isArray(payload) ? payload : payload.data;
    const employee = employees.find((item: { email?: string }) => item.email === email);
    expect(employee).toBeTruthy();
    return employee.id as string;
}

async function nextOpenPayrollPeriod(context: BrowserContext, employeeId: string) {
    const response = await context.request.get('/api/payroll/payslips');
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    const existing = new Set((payload.data ?? [])
        .filter((item: { employeeId: string }) => item.employeeId === employeeId)
        .map((item: { month: number; year: number }) => `${item.year}-${item.month}`));

    for (let year = 2030; year <= 2099; year++) {
        for (let month = 1; month <= 12; month++) {
            if (!existing.has(`${year}-${month}`)) return { month, year };
        }
    }
    throw new Error('No open payroll test period available');
}

async function ensureSalaryAssignment(context: BrowserContext, employeeId: string) {
    const structuresResponse = await context.request.get('/api/payroll/structures');
    expect(structuresResponse.ok()).toBeTruthy();
    const structuresPayload = await structuresResponse.json();
    let structures = Array.isArray(structuresPayload) ? structuresPayload : structuresPayload.data;

    if (!structures || structures.length === 0) {
        const createStructureResponse = await context.request.post('/api/payroll/structures', {
            data: {
                name: `Standard Structure ${Date.now()}`,
                basicPercentage: 50,
                houseRentPercent: 40,
                medicalPercent: 10,
                conveyanceFixed: 2000,
                pfEmployeePercent: 0,
                pfEmployerPercent: 0,
                description: 'Created by payroll workflow regression',
            },
        });
        expect(createStructureResponse.ok()).toBeTruthy();
        structures = [await createStructureResponse.json()];
    }

    const assignmentsResponse = await context.request.get(`/api/payroll/assignments?employeeId=${employeeId}&active=true`);
    expect(assignmentsResponse.ok()).toBeTruthy();
    const assignments = await assignmentsResponse.json();
    if (assignments.length > 0) return assignments[0];

    const assignmentResponse = await context.request.post('/api/payroll/assignments', {
        data: {
            employeeId,
            salaryStructureId: structures[0].id,
            grossSalary: 50000,
            effectiveFrom: '2026-01-01',
        },
    });
    expect(assignmentResponse.ok()).toBeTruthy();
    return assignmentResponse.json();
}

test.describe('Payroll and attendance office workflows', () => {
    test('HR processes payroll and employee can see generated payslip', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');
        const hr = await login(browser, 'rahim@demo.com');

        try {
            const employeeId = await employeeIdFor(hr.context, 'fatima@demo.com');
            await ensureSalaryAssignment(hr.context, employeeId);

            const { month: payrollMonth, year: payrollYear } = await nextOpenPayrollPeriod(employee.context, employeeId);
            const processResponse = await hr.context.request.post('/api/payroll/process', {
                data: {
                    month: payrollMonth,
                    year: payrollYear,
                    employeeIds: [employeeId],
                },
            });
            expect(processResponse.ok()).toBeTruthy();
            const processPayload = await processResponse.json();
            expect(processPayload.processed).toBeGreaterThanOrEqual(1);
            expect(processPayload.results.some((item: { employeeId: string }) => item.employeeId === employeeId)).toBeTruthy();

            const payslipsResponse = await employee.context.request.get('/api/payroll/payslips');
            expect(payslipsResponse.ok()).toBeTruthy();
            const payslipsPayload = await payslipsResponse.json();
            const payslip = payslipsPayload.data.find((item: { employeeId: string; month: number; year: number }) => (
                item.employeeId === employeeId && item.month === payrollMonth && item.year === payrollYear
            ));
            expect(payslip).toBeTruthy();
            expect(Number(payslip.netSalary)).toBeGreaterThanOrEqual(0);
            expect(payslip.status).toBe('draft');
        } finally {
            await closeAll(employee, hr);
        }
    });

    test('employee attendance appears in employee self-view but not unrelated manager team view', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');
        const manager = await login(browser, 'karim@demo.com');
        const hr = await login(browser, 'rahim@demo.com');

        try {
            const employeeId = await employeeIdFor(hr.context, 'fatima@demo.com');
            const today = new Date().toISOString().slice(0, 10);

            const checkInResponse = await employee.context.request.post('/api/attendance/check-in', {
                data: { source: 'web' },
            });
            expect([200, 400]).toContain(checkInResponse.status());

            const selfAttendanceResponse = await employee.context.request.get(`/api/attendance?date=${today}`);
            expect(selfAttendanceResponse.ok()).toBeTruthy();
            const selfAttendance = await selfAttendanceResponse.json();
            expect(selfAttendance.some((item: { employeeId: string }) => item.employeeId === employeeId)).toBeTruthy();

            const managerEmployeeResponse = await manager.context.request.get(`/api/attendance?employeeId=${employeeId}&date=${today}`);
            expect([403, 404]).toContain(managerEmployeeResponse.status());

            const managerTeamResponse = await manager.context.request.get(`/api/attendance?date=${today}`);
            expect(managerTeamResponse.ok()).toBeTruthy();
            const managerTeam = await managerTeamResponse.json();
            expect(managerTeam.some((item: { employeeId: string }) => item.employeeId === employeeId)).toBeFalsy();
        } finally {
            await closeAll(employee, manager, hr);
        }
    });
});
