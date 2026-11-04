/**
 * Test-authentication / risk-bypass guard (product-owner directive
 * 2026-11-04, item 4).
 *
 * Union Eyes staging and production must never carry a switch that lets a
 * request skip real authentication, skip login risk scoring, or run with
 * test-harness behaviour. The old staging Container App carried three such
 * switches; this guard makes the application refuse to serve when any of
 * them is present in a deployed environment.
 *
 * Enforcement points (all call `evaluateTestBypassGuard`):
 *   - `instrumentation.ts`  — refuses to boot (process exit 1).
 *   - `proxy.ts`            — every request except `/api/ready` gets HTTP 503.
 *   - `app/api/ready`       — reports `ready: false` with the reason code.
 *
 * Static companion: `lib/reality/__tests__/infra-test-bypass-settings.test.ts`
 * fails CI if Bicep or a GitHub workflow sets one of these switches outside
 * an allow-listed ephemeral e2e job.
 *
 * Environment classification reuses `@nzila/reality-env`
 * (`normalizeTargetEnvironment`, `isDevTarget`): only `local`, `development`
 * and `test` may carry a switch. Every other value — `staging`, `pilot`,
 * `production`, `prod`, `demo`, or anything unrecognised — is treated as
 * deployed. When no environment marker is set at all, `NODE_ENV` decides,
 * and an unset or `production` NODE_ENV is treated as deployed (fail
 * closed: an unidentified production build is not assumed to be local).
 *
 * This module is edge-safe: no Node APIs, and it reads `process.env` with
 * static property access only (see `readTestBypassGuardEnv`).
 *
 * Inventory and rationale: docs/union-eyes/production/TEST_BYPASS_SWITCHES.md
 */
import { isDevTarget, normalizeTargetEnvironment } from '@nzila/reality-env';

export const TEST_BYPASS_REASON_CODE = 'UE_TEST_BYPASS_IN_DEPLOYED_ENVIRONMENT' as const;

export interface TestBypassSwitch {
  /** Environment variable name. */
  readonly name: string;
  /** What the switch unlocks when set. */
  readonly unlocks: string;
}

/**
 * Every switch that weakens authentication, risk scoring or production
 * behaviour for test harnesses. A switch counts as "set" when it has any
 * non-empty value — including `false`: deployed environments must not
 * carry the setting at all.
 */
export const TEST_BYPASS_SWITCHES: readonly TestBypassSwitch[] = [
  {
    name: 'PLAYWRIGHT_TEST_AUTH',
    unlocks:
      'packages/platform-auth password login skips risk scoring and MFA step-up for user agents containing ' +
      '"playwright-e2e-auth"; together with QA_TEST_ENV it enables the ue-seed-session-* fake session tokens; ' +
      'next.config.ts drops HSTS and CSP upgrade-insecure-requests when present at build time.',
  },
  {
    name: 'UE_E2E_RISK_BYPASS',
    unlocks:
      'packages/platform-auth assessRisk() returns score 0 / "allow" for every login, disabling failed-login, ' +
      'new-IP and privileged-role risk signals and the MFA step-up and soft lockout they drive.',
  },
  {
    name: 'UNION_EYES_ACCEPTANCE_AUTH_ENABLED',
    unlocks:
      'packages/platform-auth auth()/currentUser() accept a signed acceptance token (x-unioneyes-acceptance-auth ' +
      'header or ue_acceptance_auth cookie) as an identity without Entra or a password session, in staging.',
  },
  {
    name: 'QA_TEST_ENV',
    unlocks:
      'Login and workflow-transition 500 responses include error detail and stack traces; /api/feature-flags ' +
      'reports pilot-mode enabled; next.config.ts drops HSTS and CSP upgrade-insecure-requests; enables the ' +
      'ue-seed-session-* fake session tokens together with PLAYWRIGHT_TEST_AUTH.',
  },
] as const;

/** Environment markers consulted, in the order they are reported. */
export const ENVIRONMENT_MARKERS = [
  'UE_ENVIRONMENT',
  'UE_DEPLOYMENT_TYPE',
  'NEXT_PUBLIC_APP_ENV',
  'TARGET_ENVIRONMENT',
  'NZILA_MODE',
  'NZILA_DEPLOYMENT_TYPE',
  'DEPLOYMENT_ENVIRONMENT',
] as const;

export type TestBypassGuardEnv = Partial<
  Record<(typeof ENVIRONMENT_MARKERS)[number] | 'NODE_ENV' | string, string | undefined>
>;

export interface TestBypassGuardResult {
  ok: boolean;
  /** Present only when `ok` is false. */
  reasonCode?: typeof TEST_BYPASS_REASON_CODE;
  /** True when the environment is anything other than local/development/test. */
  deployed: boolean;
  /** Markers that classified the environment, e.g. `UE_ENVIRONMENT=staging`. */
  classifiedBy: string[];
  /** Names (never values) of the switches that are set. */
  switchesPresent: string[];
  /** Human-readable reason; contains names only, never values. */
  reason?: string;
}

function firstToken(value: string | undefined): string {
  // Tolerate the malformed legacy form "production NEXT_PUBLIC_APP_ENV=staging".
  return (value ?? '').trim().toLowerCase().split(/\s+/)[0] ?? '';
}

function classifyDeployment(env: TestBypassGuardEnv): { deployed: boolean; classifiedBy: string[] } {
  const classifiedBy: string[] = [];
  let deployed = false;

  for (const marker of ENVIRONMENT_MARKERS) {
    const raw = firstToken(env[marker]);
    if (!raw) continue;
    classifiedBy.push(`${marker}=${raw}`);
    if (!isDevTarget(normalizeTargetEnvironment(raw))) deployed = true;
  }

  if (classifiedBy.length > 0) return { deployed, classifiedBy };

  const nodeEnv = firstToken(env.NODE_ENV);
  classifiedBy.push(`NODE_ENV=${nodeEnv || '(unset)'}`);
  return { deployed: !(nodeEnv === 'test' || nodeEnv === 'development'), classifiedBy };
}

export function evaluateTestBypassGuard(env: TestBypassGuardEnv): TestBypassGuardResult {
  const switchesPresent = TEST_BYPASS_SWITCHES.filter(
    (sw) => (env[sw.name] ?? '').trim().length > 0,
  ).map((sw) => sw.name);
  const { deployed, classifiedBy } = classifyDeployment(env);

  if (switchesPresent.length === 0 || !deployed) {
    return { ok: true, deployed, classifiedBy, switchesPresent };
  }

  return {
    ok: false,
    reasonCode: TEST_BYPASS_REASON_CODE,
    deployed,
    classifiedBy,
    switchesPresent,
    reason:
      `test-authentication / risk-bypass setting(s) ${switchesPresent.join(', ')} are forbidden in a deployed ` +
      `environment (${classifiedBy.join(', ')}). Remove them from the Container App configuration.`,
  };
}

/**
 * Snapshot of exactly the variables the guard reads. Static property access
 * keeps this working where `process.env` is not enumerable (edge runtime).
 */
export function readTestBypassGuardEnv(): TestBypassGuardEnv {
  return {
    PLAYWRIGHT_TEST_AUTH: process.env.PLAYWRIGHT_TEST_AUTH,
    UE_E2E_RISK_BYPASS: process.env.UE_E2E_RISK_BYPASS,
    UNION_EYES_ACCEPTANCE_AUTH_ENABLED: process.env.UNION_EYES_ACCEPTANCE_AUTH_ENABLED,
    QA_TEST_ENV: process.env.QA_TEST_ENV,
    UE_ENVIRONMENT: process.env.UE_ENVIRONMENT,
    UE_DEPLOYMENT_TYPE: process.env.UE_DEPLOYMENT_TYPE,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    TARGET_ENVIRONMENT: process.env.TARGET_ENVIRONMENT,
    NZILA_MODE: process.env.NZILA_MODE,
    NZILA_DEPLOYMENT_TYPE: process.env.NZILA_DEPLOYMENT_TYPE,
    DEPLOYMENT_ENVIRONMENT: process.env.DEPLOYMENT_ENVIRONMENT,
    NODE_ENV: process.env.NODE_ENV,
  };
}
