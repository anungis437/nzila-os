import { defineConfig, devices } from '@playwright/test'

/**
 * Private-document delivery acceptance over real HTTP: the real application, native PostgreSQL, Redis and an Azure Blob emulator.
 * Start the owned stack first (see docs/union-eyes/staging/UE_V2_PR1309_FINAL_ENGINEERING_CONVERGENCE.md); PLAYWRIGHT_BASE_URL selects it.
 */
process.env.PLAYWRIGHT_TEST_AUTH ??= 'false'

export default defineConfig({
  testDir: 'e2e/runtime-documents',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['json', { outputFile: process.env.UE_RUNTIME_REPORT ?? 'test-results/documents-report.json' }]],
  outputDir: process.env.UE_RUNTIME_ARTIFACTS ?? 'test-results/documents',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL, trace: 'retain-on-failure', navigationTimeout: 90_000, actionTimeout: 30_000 },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
})
