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
  testIgnore: ['tests/e2e/ue-workflow.spec.ts', '**/.next/**', '**/node_modules/**'],
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

  // Increase global assertion timeout to 15s.
  // Next.js App Router RSC streaming + client-side hydration can take
  // several seconds on first render; 5s (default) is too tight.
  expect: { timeout: 15_000 },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start local dev server if not running in CI */
  ...(process.env.CI
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
            // Give Next.js more Node heap headroom before it decides to
            // self-restart on memory pressure. The default of ~4 GiB gets
            // consumed midway through the sequential Playwright run once the
            // marketing tree, dashboard tree, and pilot-mode-gating routes are
            // all compiled; without this bump the dev server restarts and any
            // in-flight page.goto() times out at 45s.
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=8192`.trim(),
          },
        },
      }),
});
