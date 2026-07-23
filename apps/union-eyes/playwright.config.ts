import { defineConfig, devices } from '@playwright/test';
import { getE2EEnv } from './tests/e2e/e2e-env';

process.env.PLAYWRIGHT_TEST_AUTH ??= 'true';

/**
 * Union-Eyes Playwright E2E Configuration
 *
 * Run with: pnpm -C apps/union-eyes e2e
 * Debug with: pnpm -C apps/union-eyes e2e --headed
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  testIgnore: ['**/.next/**', '**/node_modules/**'],
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['html', { open: 'on-failure' }]],

  use: {
    baseURL: getE2EEnv().PLAYWRIGHT_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /*
   * Start local dev server ONLY in standalone mode.
   *
   * Phase 0C.2 §5 — Managed-server handshake:
   *   When `NZILA_E2E_MANAGED_SERVER=true` is set (governed lifecycle path,
   *   see `scripts/lifecycle/run.ts`), the orchestrator has already booted
   *   the Next.js server on the allocated port AND performed a runId
   *   handshake against `/api/health/managed-server`. Playwright MUST NOT
   *   spawn a second `pnpm dev` in that case — doing so would launch a
   *   competing server on port 3002, corrupt the run, and (worse) attach
   *   Playwright to the wrong DB.
   *
   *   CI is treated the same way: CI orchestrates its own webServer.
   */
  ...(process.env.CI || process.env.NZILA_E2E_MANAGED_SERVER === 'true'
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          port: 3002,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            ...process.env,
            ...getE2EEnv(),
            QA_TEST_ENV: 'true',
            NODE_ENV: 'test',
            PLAYWRIGHT_TEST_AUTH: process.env.PLAYWRIGHT_TEST_AUTH ?? 'true',
            UE_E2E_RISK_BYPASS: 'true',
          },
        },
      }),
});
