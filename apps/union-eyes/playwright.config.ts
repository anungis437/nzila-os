import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { getE2EEnv } from './tests/e2e/e2e-env';

process.env.PLAYWRIGHT_TEST_AUTH ??= 'true';

/**
 * Union-Eyes Playwright E2E Configuration
 *
 * Run with: pnpm -C apps/union-eyes e2e
 * Debug with: pnpm -C apps/union-eyes e2e --headed
 *
 * Phase 0C.2 §8 — Project structure:
 *   The 11-project topology below binds each spec file to a persona (via
 *   pre-generated storageState from `playwright/.auth/<role>.json`) or to
 *   a non-authenticated category (public / security / bilingual /
 *   accessibility). Every persona/security/bilingual/accessibility
 *   project depends on the `setup` project, which enforces that the
 *   auth-state summary exists, `allOk===true`, and every expected role
 *   has a valid storageState file on disk before the run begins.
 *
 *   Even though existing specs still self-authenticate via `loginAsRole`,
 *   the persona projects add three durable properties: (a) a fail-fast
 *   auth-state health gate, (b) a stable "default identity" that matches
 *   each spec's dominant persona for debugging, and (c) an evolution
 *   path where specs can drop their in-test login calls once the
 *   pre-loaded storageState is trusted end-to-end (Phase 0C.2 §10-§11).
 */

// --- Constants (single source of truth) ----------------------------------

const AUTH_DIR = 'playwright/.auth';

const STORAGE_STATE_PATHS = {
  member: `${AUTH_DIR}/member.json`,
  steward: `${AUTH_DIR}/steward.json`,
  staff: `${AUTH_DIR}/staff.json`,
  executive: `${AUTH_DIR}/executive.json`,
  admin: `${AUTH_DIR}/admin.json`,
} as const;

const SETUP_TEST_MATCH = ['playwright/setup/auth-state.setup.ts'];

const PUBLIC_TEST_MATCH = [
  'e2e/smoke.spec.ts',
  'e2e/pilot-mode-gating.spec.ts',
  'e2e/no-fsm-overexposure.spec.ts',
];

const MEMBER_TEST_MATCH = [
  'e2e/member-journey.spec.ts',
  'tests/e2e/member-intake.spec.ts',
];

const STEWARD_TEST_MATCH = [
  'tests/e2e/steward-review.spec.ts',
  'e2e/permission-boundaries.spec.ts',
];

const STAFF_TEST_MATCH = [
  'tests/e2e/case-escalation.spec.ts',
  'tests/e2e/case-resolution.spec.ts',
  'tests/e2e/external-ux-tester.spec.ts',
  'tests/e2e/auditor-readonly.spec.ts',
];

const EXECUTIVE_TEST_MATCH = ['e2e/cba-intelligence.spec.ts'];

// Admin-primary and multi-persona flows. Admin has highest privilege, so
// its pre-loaded storageState is the safest default for tests that
// switch personas mid-test via loginAsRole().
const ADMIN_TEST_MATCH = [
  'tests/e2e/admin-assignment.spec.ts',
  'e2e/dashboard.spec.ts',
  'e2e/missing-routes.spec.ts',
  'e2e/cape-features.spec.ts',
  'e2e/empty-states.spec.ts',
  'e2e/authenticated-role-navigation.spec.ts',
  'e2e/pilot-journey.spec.ts',
  'e2e/ocra-adaptive-flow.spec.ts',
  'e2e/stakeholder-demo-journeys.spec.ts',
  'e2e/ue-workflow.spec.ts',
  'e2e/governance/deployment-legitimacy-visibility.spec.ts',
];

const SECURITY_TEST_MATCH = [
  'tests/e2e/cross-org-block.spec.ts',
  'tests/e2e/org-isolation-negative.spec.ts',
  'tests/e2e/auth-failure-handling.spec.ts',
  'tests/e2e/auth-session-switch.spec.ts',
  'tests/e2e/evidence-misuse.spec.ts',
  'tests/e2e/negative-workflow-transitions.spec.ts',
];

// Bilingual & accessibility projects — testMatch points at directories
// populated by Phase 0C.2 §13 (bilingual smoke, 7 areas) and §14
// (accessibility smoke, 5 areas). Until those specs exist the projects
// match zero files: intentional scaffolding, not a broken config.
const BILINGUAL_EN_TEST_MATCH = ['e2e/bilingual/**/*.en.spec.ts'];
const BILINGUAL_FR_TEST_MATCH = ['e2e/bilingual/**/*.fr.spec.ts'];
const ACCESSIBILITY_TEST_MATCH = ['e2e/a11y/**/*.spec.ts'];

// Public + shared exports so unit tests and setup helpers reuse the same
// constants (no drift between config and the setup runner).
export const PLAYWRIGHT_AUTH_DIR = AUTH_DIR;
export const PLAYWRIGHT_STORAGE_STATE_PATHS = STORAGE_STATE_PATHS;
export const PLAYWRIGHT_PROJECT_MANIFEST = {
  setup: SETUP_TEST_MATCH,
  public: PUBLIC_TEST_MATCH,
  member: MEMBER_TEST_MATCH,
  steward: STEWARD_TEST_MATCH,
  staff: STAFF_TEST_MATCH,
  executive: EXECUTIVE_TEST_MATCH,
  admin: ADMIN_TEST_MATCH,
  security: SECURITY_TEST_MATCH,
  'bilingual-en': BILINGUAL_EN_TEST_MATCH,
  'bilingual-fr': BILINGUAL_FR_TEST_MATCH,
  accessibility: ACCESSIBILITY_TEST_MATCH,
} as const;

// --- Config --------------------------------------------------------------

const config: PlaywrightTestConfig = defineConfig({
  testDir: '.',
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
    // ── setup ──────────────────────────────────────────────────────────
    // Runs first. Verifies that the auth-state generator (Phase 0C.2 §7)
    // has produced a fresh summary.json with allOk=true and all expected
    // storageState files on disk. Fails the whole run early if not.
    {
      name: 'setup',
      testMatch: SETUP_TEST_MATCH,
    },

    // ── public ─────────────────────────────────────────────────────────
    // Unauthenticated flows — no dependency on `setup` because they
    // consume no storageState.
    {
      name: 'public',
      testMatch: PUBLIC_TEST_MATCH,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── member ─────────────────────────────────────────────────────────
    {
      name: 'member',
      dependencies: ['setup'],
      testMatch: MEMBER_TEST_MATCH,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATHS.member,
      },
    },

    // ── steward ────────────────────────────────────────────────────────
    {
      name: 'steward',
      dependencies: ['setup'],
      testMatch: STEWARD_TEST_MATCH,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATHS.steward,
      },
    },

    // ── staff (support agent / rep) ────────────────────────────────────
    {
      name: 'staff',
      dependencies: ['setup'],
      testMatch: STAFF_TEST_MATCH,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATHS.staff,
      },
    },

    // ── admin ──────────────────────────────────────────────────────────
    {
      name: 'admin',
      dependencies: ['setup'],
      testMatch: ADMIN_TEST_MATCH,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATHS.admin,
      },
    },

    // ── executive (leadership) ─────────────────────────────────────────
    {
      name: 'executive',
      dependencies: ['setup'],
      testMatch: EXECUTIVE_TEST_MATCH,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATHS.executive,
      },
    },

    // ── security ───────────────────────────────────────────────────────
    // Negative and cross-org tests. MUST start unauthenticated (empty
    // storageState) so rejection paths are proven from a cold session.
    // Still depends on `setup` because most specs fixture-login mid-test
    // and thus need the persona seed to exist.
    {
      name: 'security',
      dependencies: ['setup'],
      testMatch: SECURITY_TEST_MATCH,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },

    // ── bilingual (EN) ─────────────────────────────────────────────────
    {
      name: 'bilingual-en',
      dependencies: ['setup'],
      testMatch: BILINGUAL_EN_TEST_MATCH,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATHS.member,
        locale: 'en-CA',
      },
    },

    // ── bilingual (FR) ─────────────────────────────────────────────────
    {
      name: 'bilingual-fr',
      dependencies: ['setup'],
      testMatch: BILINGUAL_FR_TEST_MATCH,
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATHS.member,
        locale: 'fr-CA',
      },
    },

    // ── accessibility ──────────────────────────────────────────────────
    {
      name: 'accessibility',
      dependencies: ['setup'],
      testMatch: ACCESSIBILITY_TEST_MATCH,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
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

export default config;
