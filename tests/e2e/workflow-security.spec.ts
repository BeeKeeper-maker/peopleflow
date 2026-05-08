import { createHash, randomBytes } from 'crypto';
import { test, expect, type Browser, type BrowserContext, type Page, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

test.afterAll(async () => {
    await prisma.$disconnect();
});

async function login(browser: Browser, email: string, password = 'Admin@123') {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    return { context, page };
}


async function registerVerifiedTenant(browser: Browser, request: APIRequestContext) {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `tenant-security-${suffix}@example.com`;
    const password = 'Admin@12345';

    const registerResponse = await request.post('/api/auth/register', {
        data: {
            organizationName: `Tenant Security ${suffix}`,
            industry: 'Technology',
            name: 'Tenant Security Admin',
            email,
            password,
        },
    });
    expect(registerResponse.status()).toBe(201);

    const token = await prisma.emailVerificationToken.findFirst({ where: { email } });
    expect(token).toBeTruthy();
    const verifyResponse = await request.get(`/api/auth/verify-email?token=${token!.token}`);
    expect(verifyResponse.ok()).toBeTruthy();

    const tenant = await login(browser, email, password);
    await tenant.page.waitForURL('**/dashboard', { timeout: 30000 });
    return { ...tenant, email, password };
}

async function closeAll(...items: Array<{ context: BrowserContext; page: Page } | undefined>) {
    for (const item of items) {
        await item?.page.close().catch(() => undefined);
        await item?.context.close().catch(() => undefined);
    }
}

function uniqueFutureDate(seedOffset = 0) {
    const date = new Date(Date.UTC(2045, 0, 1));
    date.setUTCDate(date.getUTCDate() + (Date.now() % 10000) + seedOffset);
    return date.toISOString().slice(0, 10);
}

function reusableExpenseCategory<T extends { id: string; name?: string }>(categories: T[]): T {
    return categories.find((category) => category.name === 'Office Supplies') ?? categories[0];
}

test.describe('Role workflow security', () => {
    test('non-reporting manager cannot view another employee full HR profile', async ({ browser }) => {
        const manager = await login(browser, 'karim@demo.com');
        const admin = await login(browser, 'admin@demo.com');

        try {
            const employeesResponse = await admin.context.request.get('/api/employees?limit=100');
            expect(employeesResponse.ok()).toBeTruthy();
            const employeesPayload = await employeesResponse.json();
            const employees = employeesPayload.data || employeesPayload;
            const fatima = employees.find((employee: { email?: string }) => employee.email === 'fatima@demo.com');
            expect(fatima?.id).toBeTruthy();

            const managerGet = await manager.context.request.get(`/api/employees/${fatima.id}`);
            expect(managerGet.ok()).toBeTruthy();
            const managerView = await managerGet.json();
            expect(managerView.salaryAssignments).toBeUndefined();
            expect(managerView.nidNumber).toBeUndefined();
            expect(managerView.accountNumber).toBeUndefined();

            const adminGet = await admin.context.request.get(`/api/employees/${fatima.id}`);
            expect(adminGet.ok()).toBeTruthy();
            const adminView = await adminGet.json();
            expect(adminView.salaryAssignments).toBeDefined();
        } finally {
            await closeAll(manager, admin);
        }
    });

    test('non-reporting manager cannot inspect or approve another employee expense claim', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');
        const manager = await login(browser, 'karim@demo.com');
        const admin = await login(browser, 'admin@demo.com');

        try {
            const categoriesResponse = await employee.context.request.get('/api/expenses/categories?active=true');
            expect(categoriesResponse.ok()).toBeTruthy();
            const categories = await categoriesResponse.json();
            expect(categories.length).toBeGreaterThan(0);

            const createResponse = await employee.context.request.post('/api/expenses/claims', {
                data: {
                    title: `Security regression expense ${Date.now()}`,
                    description: 'Created by automated workflow security test',
                    amount: 123,
                    categoryId: reusableExpenseCategory(categories).id,
                    expenseDate: new Date().toISOString(),
                    status: 'submitted',
                },
            });
            expect(createResponse.status()).toBe(201);
            const claim = await createResponse.json();

            const managerGet = await manager.context.request.get(`/api/expenses/claims/${claim.id}`);
            expect([403, 404]).toContain(managerGet.status());

            const managerApprove = await manager.context.request.patch(`/api/expenses/claims/${claim.id}`, {
                data: { action: 'approve', notes: 'Should not be allowed' },
            });
            expect([403, 404]).toContain(managerApprove.status());

            const adminGet = await admin.context.request.get(`/api/expenses/claims/${claim.id}`);
            expect(adminGet.ok()).toBeTruthy();
        } finally {
            await closeAll(employee, manager, admin);
        }
    });

    test('non-reporting manager cannot inspect or approve another employee leave application', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');
        const manager = await login(browser, 'karim@demo.com');
        const admin = await login(browser, 'admin@demo.com');

        try {
            const leaveTypesResponse = await employee.context.request.get('/api/leaves/types');
            expect(leaveTypesResponse.ok()).toBeTruthy();
            const leaveTypes = await leaveTypesResponse.json();
            const leaveType = leaveTypes.find((type: { code?: string }) => type.code !== 'ML') ?? leaveTypes[0];
            expect(leaveType).toBeTruthy();

            let application: { id: string } | undefined;
            let lastCreateStatus = 0;
            for (let attempt = 0; attempt < 10; attempt++) {
                const date = uniqueFutureDate(37 + attempt * 17);
                const createResponse = await employee.context.request.post('/api/leaves/applications', {
                    data: {
                        leaveTypeId: leaveType.id,
                        fromDate: date,
                        toDate: date,
                        halfDay: true,
                        halfDayType: 'first_half',
                        reason: 'Automated workflow security regression',
                    },
                });
                lastCreateStatus = createResponse.status();
                if (createResponse.status() === 200) {
                    application = await createResponse.json();
                    break;
                }
            }
            expect(application, `leave creation should eventually avoid overlap; last status ${lastCreateStatus}`).toBeTruthy();
            const applicationId = application!.id;

            const managerGet = await manager.context.request.get(`/api/leaves/applications/${applicationId}`);
            expect([403, 404]).toContain(managerGet.status());

            const managerApprove = await manager.context.request.put(`/api/leaves/applications/${applicationId}`, {
                data: { status: 'approved', managerComment: 'Should not be allowed' },
            });
            expect([403, 404]).toContain(managerApprove.status());

            const adminGet = await admin.context.request.get(`/api/leaves/applications/${applicationId}`);
            expect(adminGet.ok()).toBeTruthy();
        } finally {
            await closeAll(employee, manager, admin);
        }
    });

    test('cross-tenant admin cannot access or process another organization HR/payroll records', async ({ browser, request }) => {
        const admin = await login(browser, 'admin@demo.com');
        const otherTenant = await registerVerifiedTenant(browser, request);

        try {
            const employeesResponse = await admin.context.request.get('/api/employees?limit=100');
            expect(employeesResponse.ok()).toBeTruthy();
            const employeesPayload = await employeesResponse.json();
            const employees = employeesPayload.data || employeesPayload;
            const targetEmployee = employees.find((employee: { email?: string }) => employee.email === 'fatima@demo.com') ?? employees[0];
            expect(targetEmployee?.id).toBeTruthy();

            const employeeDetail = await otherTenant.context.request.get(`/api/employees/${targetEmployee.id}`);
            expect(employeeDetail.status()).toBe(404);

            const employeeList = await otherTenant.context.request.get(`/api/employees?search=${encodeURIComponent(targetEmployee.email || targetEmployee.employeeCode || '')}`);
            expect(employeeList.ok()).toBeTruthy();
            const employeeListPayload = await employeeList.json();
            const visibleEmployees = employeeListPayload.data || employeeListPayload;
            expect(visibleEmployees.some((employee: { id?: string }) => employee.id === targetEmployee.id)).toBe(false);

            const payrollPeriod = { month: 12, year: 2037 };
            const payrollResponse = await admin.context.request.post('/api/payroll/process', {
                data: { ...payrollPeriod, employeeIds: [targetEmployee.id] },
            });
            expect(payrollResponse.ok()).toBeTruthy();

            const slipsResponse = await admin.context.request.get(`/api/payroll/process?employeeId=${targetEmployee.id}&month=${payrollPeriod.month}&year=${payrollPeriod.year}`);
            expect(slipsResponse.ok()).toBeTruthy();
            const slipsPayload = await slipsResponse.json();
            const slip = (slipsPayload.data || []).find((item: { employeeId?: string }) => item.employeeId === targetEmployee.id);
            expect(slip?.id).toBeTruthy();

            const otherTenantPayrollList = await otherTenant.context.request.get(`/api/payroll/process?employeeId=${targetEmployee.id}&month=${payrollPeriod.month}&year=${payrollPeriod.year}`);
            expect(otherTenantPayrollList.ok()).toBeTruthy();
            const otherPayrollPayload = await otherTenantPayrollList.json();
            expect(otherPayrollPayload.data).toHaveLength(0);

            const otherTenantSlipDownload = await otherTenant.context.request.get(`/api/payroll/slips/${slip.id}/download`);
            expect(otherTenantSlipDownload.status()).toBe(404);

            const otherTenantExplicitPayroll = await otherTenant.context.request.post('/api/payroll/process', {
                data: { month: 11, year: 2037, employeeIds: [targetEmployee.id] },
            });
            expect(otherTenantExplicitPayroll.ok()).toBeTruthy();
            const otherTenantExplicitPayload = await otherTenantExplicitPayroll.json();
            expect(otherTenantExplicitPayload.processed).toBe(0);
            expect(otherTenantExplicitPayload.results).toHaveLength(0);
        } finally {
            await closeAll(admin, otherTenant);
        }
    });

    test('expired trial blocks new uploads instead of silently continuing paid features', async ({ browser, request }) => {
        const tenant = await registerVerifiedTenant(browser, request);

        try {
            const user = await prisma.user.findUnique({
                where: { email: tenant.email },
                select: { organizationId: true },
            });
            expect(user?.organizationId).toBeTruthy();

            await prisma.subscription.update({
                where: { organizationId: user!.organizationId! },
                data: {
                    status: 'trialing',
                    trialEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            });

            const upload = await tenant.context.request.post('/api/upload', {
                multipart: {
                    folder: 'receipts',
                    file: {
                        name: 'expired-trial-receipt.pdf',
                        mimeType: 'application/pdf',
                        buffer: Buffer.from('%PDF-1.4\n% expired trial upload test'),
                    },
                },
            });
            expect(upload.status()).toBe(402);
        } finally {
            await closeAll(tenant);
        }
    });

    test('storage plan limit blocks new uploads using live tenant storage usage', async ({ browser, request }) => {
        const tenant = await registerVerifiedTenant(browser, request);

        try {
            const user = await prisma.user.findUnique({
                where: { email: tenant.email },
                select: { organizationId: true },
            });
            expect(user?.organizationId).toBeTruthy();

            await prisma.subscription.update({
                where: { organizationId: user!.organizationId! },
                data: { maxStorageOverride: 0 },
            });

            const upload = await tenant.context.request.post('/api/upload', {
                multipart: {
                    folder: 'receipts',
                    file: {
                        name: 'storage-limit-receipt.pdf',
                        mimeType: 'application/pdf',
                        buffer: Buffer.from('%PDF-1.4\n% storage limit upload test'),
                    },
                },
            });
            expect(upload.status()).toBe(402);
        } finally {
            await closeAll(tenant);
        }
    });

    test('employees cannot list tenant external API keys', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');

        try {
            const response = await employee.context.request.get('/api/v1/keys');
            expect(response.status()).toBe(403);
        } finally {
            await closeAll(employee);
        }
    });

    test('expired subscription blocks external API key data access', async ({ browser, request }) => {
        const tenant = await registerVerifiedTenant(browser, request);

        try {
            const user = await prisma.user.findUnique({
                where: { email: tenant.email },
                select: { organizationId: true },
            });
            expect(user?.organizationId).toBeTruthy();

            const rawKey = `pf_live_${randomBytes(18).toString('base64url')}`;
            await prisma.apiKey.create({
                data: {
                    name: 'Expired subscription regression key',
                    keyHash: createHash('sha256').update(rawKey).digest('hex'),
                    keyPrefix: `${rawKey.substring(0, 12)}...`,
                    permissions: ['employees:read'],
                    organizationId: user!.organizationId!,
                },
            });

            await prisma.subscription.update({
                where: { organizationId: user!.organizationId! },
                data: {
                    status: 'trialing',
                    trialEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            });

            const response = await request.get('/api/v1/employees', {
                headers: { authorization: `Bearer ${rawKey}` },
            });
            expect(response.status()).toBe(402);
        } finally {
            await closeAll(tenant);
        }
    });

    test('sync agent download requires admin session and escapes preconfigured keys', async ({ browser, request }) => {
        const unauthenticated = await request.get('/api/sync-agent/download');
        expect(unauthenticated.status()).toBe(401);

        const admin = await login(browser, 'admin@demo.com');
        try {
            const maliciousKey = 'pf_sync_x";console.log("pwn")//';
            const response = await admin.context.request.get(`/api/sync-agent/download?key=${encodeURIComponent(maliciousKey)}`);
            expect(response.ok()).toBeTruthy();
            const script = await response.text();
            expect(script).toContain('const PRE_CONFIGURED_KEY = "pf_sync_x\\";console.log(\\"pwn\\")//";');
            expect(script).not.toContain('const PRE_CONFIGURED_KEY = "pf_sync_x";console.log("pwn")//";');
        } finally {
            await closeAll(admin);
        }
    });

    test('expired subscription blocks sync agent heartbeat', async ({ browser, request }) => {
        const tenant = await registerVerifiedTenant(browser, request);

        try {
            const user = await prisma.user.findUnique({
                where: { email: tenant.email },
                select: { organizationId: true },
            });
            expect(user?.organizationId).toBeTruthy();

            const rawKey = `pf_sync_${randomBytes(32).toString('hex')}`;
            await prisma.syncApiKey.create({
                data: {
                    name: 'Expired sync regression key',
                    key: createHash('sha256').update(rawKey).digest('hex'),
                    keyPrefix: rawKey.substring(0, 16),
                    organizationId: user!.organizationId!,
                },
            });

            await prisma.subscription.update({
                where: { organizationId: user!.organizationId! },
                data: {
                    status: 'trialing',
                    trialEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    currentPeriodEnd: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
            });

            const response = await request.post('/api/v1/sync/heartbeat', {
                headers: { authorization: `Bearer ${rawKey}` },
                data: { agentVersion: 'test' },
            });
            expect(response.status()).toBe(402);
        } finally {
            await closeAll(tenant);
        }
    });

    test('password change invalidates existing authenticated API session', async ({ browser, request }) => {
        const tenant = await registerVerifiedTenant(browser, request);

        try {
            const beforeChange = await tenant.context.request.get('/api/employees?limit=1');
            expect(beforeChange.ok()).toBeTruthy();

            const changePassword = await tenant.context.request.post('/api/auth/change-password', {
                data: {
                    currentPassword: 'Admin@12345',
                    newPassword: 'NewAdmin@12345',
                },
            });
            expect(changePassword.ok()).toBeTruthy();

            const afterChange = await tenant.context.request.get('/api/employees?limit=1');
            expect(afterChange.status()).toBe(401);
        } finally {
            await closeAll(tenant);
        }
    });

    test('loan APIs stay scoped to employee self or manager direct reportees', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');
        const manager = await login(browser, 'karim@demo.com');
        const admin = await login(browser, 'admin@demo.com');

        try {
            const employeesResponse = await admin.context.request.get('/api/employees?limit=100');
            expect(employeesResponse.ok()).toBeTruthy();
            const employeesPayload = await employeesResponse.json();
            const employees = employeesPayload.data || employeesPayload;
            const otherEmployee = employees.find((item: { email?: string }) => item.email && item.email !== 'fatima@demo.com');
            expect(otherEmployee?.id).toBeTruthy();

            const forbiddenCreate = await employee.context.request.post('/api/loans', {
                data: {
                    employeeId: otherEmployee.id,
                    type: 'emergency',
                    amount: 10000,
                    tenure: 5,
                    reason: 'Should not create loan for another employee',
                },
            });
            expect([403, 404]).toContain(forbiddenCreate.status());

            const selfEmployeeResponse = await employee.context.request.get('/api/employees/me');
            expect(selfEmployeeResponse.ok()).toBeTruthy();
            const selfEmployeePayload = await selfEmployeeResponse.json();
            const selfEmployeeId = selfEmployeePayload.data.employee.id;

            const createLoan = await employee.context.request.post('/api/loans', {
                data: {
                    employeeId: selfEmployeeId,
                    type: 'emergency',
                    amount: 12000,
                    tenure: 6,
                    reason: 'Workflow security loan scope regression',
                },
            });
            expect(createLoan.ok()).toBeTruthy();
            const loan = await createLoan.json();

            const managerList = await manager.context.request.get('/api/loans');
            expect(managerList.ok()).toBeTruthy();
            const visibleLoans = await managerList.json();
            expect(visibleLoans.some((item: { id?: string }) => item.id === loan.id)).toBe(false);

            const managerApprove = await manager.context.request.put(`/api/loans/${loan.id}`, {
                data: { status: 'approved', notes: 'Should not approve non-reportee loan' },
            });
            expect([403, 404]).toContain(managerApprove.status());
        } finally {
            await closeAll(employee, manager, admin);
        }
    });

    test('upload access is scoped by folder sensitivity and expense ownership', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');
        const manager = await login(browser, 'karim@demo.com');
        const admin = await login(browser, 'admin@demo.com');

        try {
            const forbiddenDocumentUpload = await employee.context.request.post('/api/upload', {
                multipart: {
                    folder: 'documents',
                    file: {
                        name: 'private.pdf',
                        mimeType: 'application/pdf',
                        buffer: Buffer.from('%PDF-1.4\n% private test document'),
                    },
                },
            });
            expect(forbiddenDocumentUpload.status()).toBe(403);

            const receiptUpload = await employee.context.request.post('/api/upload', {
                multipart: {
                    folder: 'receipts',
                    file: {
                        name: 'receipt.pdf',
                        mimeType: 'application/pdf',
                        buffer: Buffer.from('%PDF-1.4\n% receipt test document'),
                    },
                },
            });
            expect(receiptUpload.ok()).toBeTruthy();
            const receiptPayload = await receiptUpload.json();
            const receiptUrl = receiptPayload.url || receiptPayload.data?.url;
            expect(receiptUrl).toBeTruthy();

            const ownerReceiptGet = await employee.context.request.get(receiptUrl);
            expect(ownerReceiptGet.ok()).toBeTruthy();

            const managerReceiptBeforeClaim = await manager.context.request.get(receiptUrl);
            expect(managerReceiptBeforeClaim.status()).toBe(403);

            const categoriesResponse = await employee.context.request.get('/api/expenses/categories?active=true');
            expect(categoriesResponse.ok()).toBeTruthy();
            const categories = await categoriesResponse.json();
            expect(categories.length).toBeGreaterThan(0);

            const createClaim = await employee.context.request.post('/api/expenses/claims', {
                data: {
                    title: `Receipt file security expense ${Date.now()}`,
                    description: 'Created by automated upload security test',
                    amount: 456,
                    categoryId: reusableExpenseCategory(categories).id,
                    expenseDate: new Date().toISOString(),
                    receiptUrl,
                    receiptName: 'receipt.pdf',
                    status: 'submitted',
                },
            });
            expect(createClaim.status()).toBe(201);

            const managerReceiptAfterClaim = await manager.context.request.get(receiptUrl);
            expect(managerReceiptAfterClaim.status()).toBe(403);

            const adminReceiptGet = await admin.context.request.get(receiptUrl);
            expect(adminReceiptGet.ok()).toBeTruthy();
        } finally {
            await closeAll(employee, manager, admin);
        }
    });

    test('manager expense list employee filter stays scoped to self or direct reportees', async ({ browser }) => {
        const employee = await login(browser, 'fatima@demo.com');
        const manager = await login(browser, 'karim@demo.com');

        try {
            const categoriesResponse = await employee.context.request.get('/api/expenses/categories?active=true');
            expect(categoriesResponse.ok()).toBeTruthy();
            const categories = await categoriesResponse.json();
            expect(categories.length).toBeGreaterThan(0);

            const createResponse = await employee.context.request.post('/api/expenses/claims', {
                data: {
                    title: `Manager list privacy expense ${Date.now()}`,
                    description: 'Created by automated workflow security test',
                    amount: 321,
                    categoryId: reusableExpenseCategory(categories).id,
                    expenseDate: new Date().toISOString(),
                    status: 'submitted',
                },
            });
            expect(createResponse.status()).toBe(201);
            const claim = await createResponse.json();

            const listResponse = await manager.context.request.get(`/api/expenses/claims?employeeId=${claim.employeeId}`);
            expect(listResponse.ok()).toBeTruthy();
            const visibleClaims = await listResponse.json();
            expect(visibleClaims.some((item: { id?: string }) => item.id === claim.id)).toBe(false);
        } finally {
            await closeAll(employee, manager);
        }
    });

});
