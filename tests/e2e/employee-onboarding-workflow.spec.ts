import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

async function login(browser: Browser, email: string, password = 'Admin@123') {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.getByRole('button', { name: /sign in/i }).click();
    return { context, page };
}

async function closeAll(...items: Array<{ context: BrowserContext; page: Page } | undefined>) {
    for (const item of items) {
        await item?.page.close().catch(() => undefined);
        await item?.context.close().catch(() => undefined);
    }
}

function pickFirst<T extends { id: string }>(items: T[], label: string): T {
    const item = items[0];
    expect(item, `${label} should exist`).toBeTruthy();
    return item;
}

async function ensureSubscriptionFor(email: string) {
    const admin = await prisma.user.findUnique({ where: { email } });
    expect(admin?.organizationId).toBeTruthy();

    const plan = await prisma.plan.upsert({
        where: { slug: 'starter' },
        create: {
            name: 'Starter',
            slug: 'starter',
            description: 'Starter trial for E2E organizations',
            priceMonthly: 0,
            priceYearly: 0,
            currency: 'BDT',
            maxEmployees: 200,
            maxAdmins: 5,
            maxBranches: 5,
            maxDevices: 0,
            maxStorageMB: 500,
            features: { payroll: true, expenses: true, attendance: true, employeeSelfService: true },
            sortOrder: 1,
        },
        update: { maxEmployees: 200 },
    });

    await prisma.branch.upsert({
        where: { organizationId_code: { organizationId: admin!.organizationId!, code: 'HO' } },
        create: {
            organizationId: admin!.organizationId!,
            name: 'Head Office',
            code: 'HO',
            city: 'Dhaka',
            country: 'Bangladesh',
            isHeadOffice: true,
            isActive: true,
        },
        update: { isHeadOffice: true, isActive: true },
    });

    await prisma.subscription.upsert({
        where: { organizationId: admin!.organizationId! },
        create: {
            organizationId: admin!.organizationId!,
            planId: plan.id,
            status: 'trialing',
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
            trialStart: new Date(),
            trialEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
        },
        update: { status: 'trialing', planId: plan.id },
    });
}

test.afterAll(async () => {
    await prisma.$disconnect();
});

test.describe('Employee lifecycle onboarding', () => {
    test('admin-created employee receives linked ESS account, salary setup, branch, and first-login reset flow', async ({ browser }) => {
        await ensureSubscriptionFor('admin@demo.com');

        const admin = await login(browser, 'admin@demo.com');
        await expect(admin.page).not.toHaveURL(/\/login$/);

        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const employeeEmail = `new-employee-${suffix}@example.com`;
        const employeeCode = `E2E-${suffix}`.slice(0, 24).toUpperCase();
        const employeePassword = 'Employee@12345';

        const [departmentsRes, designationsRes, shiftsRes, structuresRes] = await Promise.all([
            admin.context.request.get('/api/departments?all=true'),
            admin.context.request.get('/api/designations?all=true'),
            admin.context.request.get('/api/shifts'),
            admin.context.request.get('/api/payroll/structures'),
        ]);
        expect(departmentsRes.ok()).toBeTruthy();
        expect(designationsRes.ok()).toBeTruthy();
        expect(shiftsRes.ok()).toBeTruthy();
        expect(structuresRes.ok()).toBeTruthy();

        const departments = await departmentsRes.json();
        const designations = await designationsRes.json();
        const shiftsPayload = await shiftsRes.json();
        const structuresPayload = await structuresRes.json();
        const shifts = Array.isArray(shiftsPayload) ? shiftsPayload : shiftsPayload.data;
        const structures = Array.isArray(structuresPayload) ? structuresPayload : structuresPayload.data;

        const department = pickFirst(departments, 'department');
        const designation = pickFirst(designations, 'designation');
        const shift = pickFirst(shifts, 'shift');
        const structure = pickFirst(structures, 'salary structure');

        const employeePayload = {
            firstName: 'Nusrat',
            lastName: 'Jahan',
            email: employeeEmail,
            phone: '+8801700000000',
            employeeCode,
            departmentId: department.id,
            designationId: designation.id,
            shiftId: shift.id,
            joiningDate: '2026-05-08',
            employmentType: 'permanent',
            employmentStatus: 'active',
            grossSalary: 42000,
            salaryStructureId: structure.id,
            nationality: 'Bangladeshi',
            pfEnabled: true,
        };

        const createResponse = await admin.context.request.post('/api/employees', {
            data: employeePayload,
        });
        const createText = await createResponse.text();
        expect(createResponse.ok(), createText).toBeTruthy();
        const employee = JSON.parse(createText);
        expect(employee.email).toBe(employeeEmail);
        expect(employee.onboardingInvitationSent).toBe(true);
        expect(employee.invitationToken).toBeUndefined();
        expect(employee.leaveAllocationsCreated).toBeGreaterThan(0);

        const dbEmployee = await prisma.employee.findUnique({
            where: { id: employee.id },
            include: {
                user: true,
                branch: true,
                salaryAssignments: { where: { isActive: true } },
                leaveAllocations: { where: { year: new Date().getFullYear() }, include: { leaveType: true } },
            },
        });
        expect(dbEmployee?.user?.email).toBe(employeeEmail);
        expect(dbEmployee?.user?.role).toBe('employee');
        expect(dbEmployee?.user?.password).toBeNull();
        expect(dbEmployee?.user?.emailVerified).toBeNull();
        expect(dbEmployee?.branch?.isHeadOffice).toBe(true);
        expect(dbEmployee?.salaryAssignments[0]?.grossSalary).toBe(42000);
        expect(dbEmployee?.leaveAllocations.length).toBeGreaterThan(0);
        expect(dbEmployee?.leaveAllocations.every((allocation) => allocation.allocatedDays > 0)).toBe(true);

        const blockedEmployee = await login(browser, employeeEmail, employeePassword);
        await expect(blockedEmployee.page).toHaveURL(/\/login/);
        await closeAll(blockedEmployee);

        const invitationToken = await prisma.passwordResetToken.findFirst({
            where: { email: employeeEmail, used: false },
            orderBy: { createdAt: 'desc' },
        });
        expect(invitationToken).toBeTruthy();

        const resetResponse = await admin.context.request.post('/api/auth/reset-password', {
            data: {
                token: invitationToken!.token,
                password: employeePassword,
                confirmPassword: employeePassword,
            },
        });
        expect(resetResponse.ok()).toBeTruthy();

        const activatedUser = await prisma.user.findUnique({ where: { email: employeeEmail } });
        expect(activatedUser?.emailVerified).toBeTruthy();

        const employeeLogin = await login(browser, employeeEmail, employeePassword);
        await employeeLogin.page.waitForURL('**/ess/dashboard', { timeout: 30000 });

        const meResponse = await employeeLogin.context.request.get('/api/employees/me');
        expect(meResponse.ok()).toBeTruthy();
        const mePayload = await meResponse.json();
        expect(mePayload.data.employee.email).toBe(employeeEmail);

        const offboardResponse = await admin.context.request.delete(`/api/employees/${employee.id}`);
        expect(offboardResponse.status()).toBe(204);

        const offboardedEmployee = await prisma.employee.findUnique({
            where: { id: employee.id },
            include: { user: true, salaryAssignments: { where: { isActive: true } } },
        });
        expect(offboardedEmployee?.employmentStatus).toBe('terminated');
        expect(offboardedEmployee?.deletedAt).toBeTruthy();
        expect(offboardedEmployee?.user?.isActive).toBe(false);
        expect(offboardedEmployee?.user?.password).toBeNull();
        expect(offboardedEmployee?.user?.emailVerified).toBeNull();
        expect(offboardedEmployee?.salaryAssignments).toHaveLength(0);

        const staleSessionResponse = await employeeLogin.context.request.get('/api/employees/me');
        expect(staleSessionResponse.status()).toBe(401);

        const staleCheckInResponse = await employeeLogin.context.request.post('/api/attendance/check-in', {
            data: { source: 'web' },
        });
        expect([401, 403]).toContain(staleCheckInResponse.status());

        const staleExpenseResponse = await employeeLogin.context.request.post('/api/expenses/claims', {
            data: {
                title: 'Should be blocked after offboarding',
                amount: 100,
                categoryId: 'blocked-category',
                expenseDate: new Date().toISOString(),
                status: 'submitted',
            },
        });
        expect([401, 403]).toContain(staleExpenseResponse.status());

        const staleLeaveResponse = await employeeLogin.context.request.post('/api/leaves/applications', {
            data: {
                leaveTypeId: 'blocked-leave-type',
                fromDate: '2026-06-01',
                toDate: '2026-06-01',
                reason: 'Should be blocked after offboarding',
            },
        });
        expect([401, 403]).toContain(staleLeaveResponse.status());

        const blockedAfterOffboarding = await login(browser, employeeEmail, employeePassword);
        await expect(blockedAfterOffboarding.page).toHaveURL(/\/login/);
        await closeAll(blockedAfterOffboarding);

        await admin.page.goto(`/employees/${employee.id}/edit`, { waitUntil: 'domcontentloaded' });
        await expect(admin.page.getByTestId('employee-reactivation-guidance')).toContainText('fresh reset invitation');

        const reactivateResponse = await admin.context.request.put(`/api/employees/${employee.id}`, {
            data: {
                ...employeePayload,
                employmentStatus: 'active',
                grossSalary: 43000,
            },
        });
        const reactivateText = await reactivateResponse.text();
        expect(reactivateResponse.ok(), reactivateText).toBeTruthy();
        const reactivated = JSON.parse(reactivateText);
        expect(reactivated.deletedAt).toBeNull();
        expect(reactivated.reactivationInvitationSent).toBe(true);

        const reactivatedEmployee = await prisma.employee.findUnique({
            where: { id: employee.id },
            include: { user: true, salaryAssignments: { where: { isActive: true } } },
        });
        expect(reactivatedEmployee?.employmentStatus).toBe('active');
        expect(reactivatedEmployee?.deletedAt).toBeNull();
        expect(reactivatedEmployee?.user?.isActive).toBe(true);
        expect(reactivatedEmployee?.user?.password).toBeNull();
        expect(reactivatedEmployee?.user?.emailVerified).toBeNull();
        expect(reactivatedEmployee?.salaryAssignments[0]?.grossSalary).toBe(43000);

        const staleAfterReactivation = await employeeLogin.context.request.get('/api/employees/me');
        expect(staleAfterReactivation.status()).toBe(401);

        const blockedBeforeReset = await login(browser, employeeEmail, employeePassword);
        await expect(blockedBeforeReset.page).toHaveURL(/\/login/);
        await closeAll(blockedBeforeReset);

        const reactivationToken = await prisma.passwordResetToken.findFirst({
            where: { email: employeeEmail, used: false },
            orderBy: { createdAt: 'desc' },
        });
        expect(reactivationToken).toBeTruthy();

        const resetAfterReactivationResponse = await admin.context.request.post('/api/auth/reset-password', {
            data: {
                token: reactivationToken!.token,
                password: employeePassword,
                confirmPassword: employeePassword,
            },
        });
        expect(resetAfterReactivationResponse.ok()).toBeTruthy();

        const loginAfterReactivation = await login(browser, employeeEmail, employeePassword);
        await loginAfterReactivation.page.waitForURL('**/ess/dashboard', { timeout: 30000 });
        const meAfterReactivation = await loginAfterReactivation.context.request.get('/api/employees/me');
        expect(meAfterReactivation.ok()).toBeTruthy();

        const finalOffboardResponse = await admin.context.request.delete(`/api/employees/${employee.id}`);
        expect(finalOffboardResponse.status()).toBe(204);

        const finalPayrollResponse = await admin.context.request.post('/api/payroll/process', {
            data: {
                month: 1,
                year: 2031,
                employeeIds: [employee.id],
            },
        });
        const finalPayrollText = await finalPayrollResponse.text();
        expect(finalPayrollResponse.ok(), finalPayrollText).toBeTruthy();
        const finalPayroll = JSON.parse(finalPayrollText);
        expect(finalPayroll.processed).toBe(1);
        expect(finalPayroll.results[0].employeeId).toBe(employee.id);

        const employeeAfterFinalPayroll = await prisma.employee.findUnique({
            where: { id: employee.id },
            include: { user: true, salaryAssignments: { where: { isActive: true } } },
        });
        expect(employeeAfterFinalPayroll?.employmentStatus).toBe('terminated');
        expect(employeeAfterFinalPayroll?.user?.isActive).toBe(false);
        expect(employeeAfterFinalPayroll?.salaryAssignments).toHaveLength(0);

        await closeAll(admin, employeeLogin, loginAfterReactivation);
    });
});
