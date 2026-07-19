import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: 'http://localhost:3014',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
    port: 3014,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NODE_ENV: 'development',
      PLAYWRIGHT_TEST_AUTH: 'true',
      ABR_DEMO_ORG_ID: 'metro-university',
      AUTH_SECRET: 'playwright-proof-auth-secret-32-bytes-minimum',
      NEXTAUTH_SECRET: 'playwright-proof-auth-secret-32-bytes-minimum',
      AZURE_AD_CLIENT_ID: 'playwright-proof-client-id',
      AZURE_AD_CLIENT_SECRET: 'playwright-proof-client-secret',
      AZURE_AD_TENANT_ID: 'playwright-proof-tenant-id',
    },
  },
});