/**
 * Vitest Setup File
 *
 * Runs before all test suites.
 * Sets up mocks and environment for unit testing.
 */

// Set test environment variables
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/peopleflow_test";
process.env.REDIS_URL = "redis://localhost:6379/1"; // Use DB 1 for tests
process.env.NEXTAUTH_SECRET = "test-secret-32-characters-long!!";
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock";
// NODE_ENV is automatically set to "test" by Vitest
