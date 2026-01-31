import { test, expect } from '@playwright/test';

/**
 * API Security & Authentication Tests
 * 
 * Verifies that ALL protected API endpoints require authentication
 * and return proper 401 Unauthorized responses.
 * 
 * Industry-standard: Strict status code checks, no shortcuts!
 */

test.describe('API Authentication Security', () => {

    test('employees API should require authentication', async ({ request }) => {
        // Access employees API without auth cookie/session
        const response = await request.get('/api/employees');

        // STRICT: Must be exactly 401 Unauthorized
        expect(response.status()).toBe(401);

        // Response should have proper error format
        const data = await response.json();
        expect(data).toHaveProperty('error');
        expect(data.error).toBe('Unauthorized');
        expect(data).toHaveProperty('code');
        expect(data.code).toBe('AUTH_REQUIRED');
    });

    test('departments API should require authentication', async ({ request }) => {
        const response = await request.get('/api/departments');

        // STRICT: Must be exactly 401 Unauthorized
        expect(response.status()).toBe(401);

        const data = await response.json();
        expect(data.code).toBe('AUTH_REQUIRED');
    });

    test('attendance API should require authentication', async ({ request }) => {
        const response = await request.get('/api/attendance');

        // STRICT: Must be exactly 401 Unauthorized
        expect(response.status()).toBe(401);

        const data = await response.json();
        expect(data.code).toBe('AUTH_REQUIRED');
    });

    test('leaves API should require authentication', async ({ request }) => {
        const response = await request.get('/api/leaves/applications');

        // STRICT: Must be exactly 401 Unauthorized
        expect(response.status()).toBe(401);

        const data = await response.json();
        expect(data.code).toBe('AUTH_REQUIRED');
    });

    test('payroll API should require authentication', async ({ request }) => {
        const response = await request.get('/api/payroll/structures');

        // STRICT: Must be exactly 401 Unauthorized
        expect(response.status()).toBe(401);

        const data = await response.json();
        expect(data.code).toBe('AUTH_REQUIRED');
    });
});

test.describe('API Endpoints Exist', () => {
    test('health check endpoint returns proper response', async ({ request }) => {
        const response = await request.get('/api/health');

        // Should return 200 OK
        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data).toHaveProperty('status');
    });

    test('auth providers endpoint exists', async ({ request }) => {
        const response = await request.get('/api/auth/providers');

        // NextAuth providers endpoint should return 200
        expect(response.status()).toBe(200);
    });

    test('search endpoint requires authentication', async ({ request }) => {
        const response = await request.get('/api/search?q=test');

        // Search should require auth
        expect(response.status()).toBe(401);
    });
});
