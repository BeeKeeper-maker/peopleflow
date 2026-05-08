import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PrismaClient } from '../../src/generated/prisma';

const prisma = new PrismaClient();

test.afterAll(async () => {
    await prisma.$disconnect();
});

async function login(browser: Browser, email: string, password: string) {
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

function unwrapData(payload: unknown) {
    if (Array.isArray(payload)) return payload;
    if (payload && typeof payload === 'object' && 'data' in payload) return (payload as { data: unknown }).data;
    return payload;
}

test.describe('Client onboarding registration', () => {
    test('new organization is provisioned with usable setup defaults and email verification gate', async ({ browser, request }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const email = `owner-${suffix}@example.com`;
        const password = 'Admin@12345';
        const organizationName = `PeopleFlow Onboarding ${suffix}`;

        const registerResponse = await request.post('/api/auth/register', {
            data: {
                organizationName,
                industry: 'Technology',
                name: 'Owner Admin',
                email,
                password,
            },
        });
        expect(registerResponse.status()).toBe(201);
        const registerPayload = await registerResponse.json();
        expect(registerPayload.requiresVerification).toBe(true);

        const createdUser = await prisma.user.findUnique({
            where: { email },
            include: { organization: true },
        });
        expect(createdUser).toBeTruthy();
        expect(createdUser?.emailVerified).toBeNull();
        expect(createdUser?.organization?.name).toBe(organizationName);

        const subscription = await prisma.subscription.findUnique({
            where: { organizationId: createdUser!.organizationId! },
            include: { plan: true },
        });
        expect(subscription?.status).toBe('trialing');
        expect(subscription?.plan.slug).toBe('starter');
        expect(subscription?.plan.maxEmployees).toBeGreaterThan(0);

        const blockedLogin = await login(browser, email, password);
        await expect(blockedLogin.page).toHaveURL(/\/login/);
        await closeAll(blockedLogin);

        const token = await prisma.emailVerificationToken.findFirst({ where: { email } });
        expect(token).toBeTruthy();
        const verifyResponse = await request.get(`/api/auth/verify-email?token=${token!.token}`);
        expect(verifyResponse.ok()).toBeTruthy();

        const verifiedLogin = await login(browser, email, password);
        await verifiedLogin.page.waitForURL('**/dashboard', { timeout: 30000 });

        const [departments, designations, branches, shifts, leaveTypes, salaryStructuresPayload] = await Promise.all([
            verifiedLogin.context.request.get('/api/departments?all=true').then(async (res) => { expect(res.ok()).toBeTruthy(); return res.json(); }),
            verifiedLogin.context.request.get('/api/designations?all=true').then(async (res) => { expect(res.ok()).toBeTruthy(); return res.json(); }),
            verifiedLogin.context.request.get('/api/branches').then(async (res) => { expect(res.ok()).toBeTruthy(); return res.json(); }),
            verifiedLogin.context.request.get('/api/shifts').then(async (res) => { expect(res.ok()).toBeTruthy(); return res.json(); }),
            verifiedLogin.context.request.get('/api/leaves/types?all=true').then(async (res) => { expect(res.ok()).toBeTruthy(); return res.json(); }),
            verifiedLogin.context.request.get('/api/payroll/structures').then(async (res) => { expect(res.ok()).toBeTruthy(); return res.json(); }),
        ]);

        const salaryStructures = unwrapData(salaryStructuresPayload) as Array<{ code?: string; name?: string }>;
        expect(departments.some((item: { code?: string }) => item.code === 'ADMIN')).toBeTruthy();
        expect(departments.some((item: { code?: string }) => item.code === 'OPS')).toBeTruthy();
        expect(designations.some((item: { code?: string }) => item.code === 'ADMIN')).toBeTruthy();
        expect(designations.some((item: { code?: string }) => item.code === 'EMP')).toBeTruthy();
        expect(branches.some((item: { code?: string; isHeadOffice?: boolean }) => item.code === 'HO' && item.isHeadOffice)).toBeTruthy();
        expect((unwrapData(shifts) as Array<{ isDefault?: boolean }>).some((item) => item.isDefault)).toBeTruthy();
        expect(leaveTypes.length).toBeGreaterThanOrEqual(5);
        expect(salaryStructures.some((item) => item.code === 'STD')).toBeTruthy();

        await closeAll(verifiedLogin);
    });
});
