import { defineConfig, devices } from '@playwright/test'

/**
 * Real-browser journeys against the owned production-build runtime (tooling/scripts/ue-runtime-up.mjs up --prod).
 * Desktop Chromium, a mobile Chromium viewport and mobile WebKit, each in English and French (the spec loops over both).
 */
process.env.PLAYWRIGHT_TEST_AUTH ??= 'false'
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002'

export default defineConfig({
  testDir: 'e2e/runtime-browser',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['json', { outputFile: process.env.UE_RUNTIME_REPORT ?? 'test-results/browser-report.json' }]],
  outputDir: process.env.UE_RUNTIME_ARTIFACTS ?? 'test-results/browser',
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'on', video: 'off', navigationTimeout: 90_000, actionTimeout: 30_000 },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] } },
  ],
})
