import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 * 
 * E2E Testing setup for PeopleFlow HRMS
 */
export default defineConfig({
    // Test directory
    testDir: './tests/e2e',

    // Run tests in parallel
    fullyParallel: true,

    // Fail the build on CI if you accidentally left test.only
    forbidOnly: !!process.env.CI,

    // Retry once locally, twice on CI
    retries: process.env.CI ? 2 : 1,

    // Limit workers on CI
    workers: process.env.CI ? 1 : undefined,

    // Reporter to use
    reporter: [
        ['html', { open: 'never' }],
        ['list'],
    ],

    // Shared settings for all tests
    use: {
        // Base URL for tests
        baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',

        // Collect trace when retrying the failed test
        trace: 'on-first-retry',

        // Take screenshot on failure
        screenshot: 'only-on-failure',

        // Record video on failure
        video: 'on-first-retry',

        // Timeout for each action
        actionTimeout: 10000,

        // Timeout for navigation
        navigationTimeout: 30000,
    },

    // Timeout for each test
    timeout: 60000,

    // Configure projects for Chromium only (faster)
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    // Run local dev server before tests
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
