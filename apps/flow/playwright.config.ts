import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: 'http://localhost:3003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],

  webServer: {
    command: process.env.CI
      ? 'DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/flow_test} AUTH_SECRET=${AUTH_SECRET:-playwright-test-secret} NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-playwright-test-secret} pnpm build && DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/flow_test} AUTH_SECRET=${AUTH_SECRET:-playwright-test-secret} NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-playwright-test-secret} pnpm start'
      : 'DATABASE_URL=${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/flow_test} AUTH_SECRET=${AUTH_SECRET:-playwright-test-secret} NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-playwright-test-secret} pnpm dev',
    port: 3003,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
