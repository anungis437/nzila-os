import { defineConfig, devices } from '@playwright/test'

/**
 * Runtime convergence acceptance: the real Next.js application over HTTP, backed by native PostgreSQL.
 *
 * No web server is started here. Start the stack first (tooling/scripts/ue-runtime-up.mjs, or see
 * docs/union-eyes/convergence/RUNTIME-ACCEPTANCE.md); PLAYWRIGHT_BASE_URL selects the target.
 *
 * Projects run every acceptance spec at desktop, tablet and mobile sizes.
 */
process.env.PLAYWRIGHT_TEST_AUTH ??= 'true'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'

export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/runtime/**/*.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['json', { outputFile: process.env.UE_RUNTIME_REPORT ?? 'test-results/runtime-report.json' }]],
  outputDir: process.env.UE_RUNTIME_ARTIFACTS ?? 'test-results/runtime',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    navigationTimeout: 90_000,
    actionTimeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
