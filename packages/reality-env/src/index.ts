/**
 * @nzila/reality-env — the single authoritative environment-identity
 * contract for the Nzila platform's reality-remediation programme.
 *
 * Wave 0 §5 promotes what were previously TWO drifted copies of the
 * demo-profile guard logic (`tooling/reality/demo-deployment-guard.ts`
 * and `apps/union-eyes/lib/reality/demo-deployment-guard.ts`) into a
 * single canonical module. Both guards, plus the demo app's boot
 * assertion, now delegate to the helpers exported here.
 *
 * This package is pure TypeScript with zero runtime dependencies so
 * it can be imported by:
 *   - `tooling/reality/*` (CI scripts, run via tsx)
 *   - `apps/union-eyes/instrumentation.ts` (runtime guard)
 *   - `apps/union-eyes-demo/env.ts` (boot assertion)
 *
 * Do NOT re-implement environment classification elsewhere.
 */

/** The exhaustive set of environments the platform recognises. */
export const TARGET_ENVIRONMENTS = [
  'development',
  'local',
  'test',
  'demo',
  'staging',
  'pilot',
  'production',
] as const;
export type TargetEnvironment = (typeof TARGET_ENVIRONMENTS)[number];

/** Environments where a demo profile is permitted. */
export const DEV_TARGETS = ['development', 'local', 'test'] as const;
export type DevTarget = (typeof DEV_TARGETS)[number];

/** Environments where a demo profile is strictly forbidden. */
export const DEPLOYED_TARGETS = ['staging', 'pilot', 'production'] as const;
export type DeployedTarget = (typeof DEPLOYED_TARGETS)[number];

/** Recognised values for the demo-profile env vars. */
export const DEMO_PROFILE_VALUES = [
  'demo',
  'sample',
  'placeholder',
  'fixture',
] as const;
export type DemoProfileValue = (typeof DEMO_PROFILE_VALUES)[number];

const DEV_SET: ReadonlySet<string> = new Set(DEV_TARGETS);
const DEPLOYED_SET: ReadonlySet<string> = new Set(DEPLOYED_TARGETS);
const DEMO_SET: ReadonlySet<string> = new Set(DEMO_PROFILE_VALUES);
const TARGET_SET: ReadonlySet<string> = new Set(TARGET_ENVIRONMENTS);

/**
 * Normalise a raw environment string to a canonical `TargetEnvironment`.
 *
 * Aliases: `dev` → `development`, `prod` → `production`.
 * Unknown / missing values fail closed to `production` — a missing
 * signal must never be interpreted as demo.
 */
export function normalizeTargetEnvironment(
  raw: string | null | undefined,
): TargetEnvironment {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'dev') return 'development';
  if (v === 'prod') return 'production';
  if (TARGET_SET.has(v)) return v as TargetEnvironment;
  return 'production';
}

export function isDevTarget(t: TargetEnvironment): t is DevTarget {
  return DEV_SET.has(t);
}
export function isDeployedTarget(t: TargetEnvironment): t is DeployedTarget {
  return DEPLOYED_SET.has(t);
}
export function isDemoTarget(t: TargetEnvironment): t is 'demo' {
  return t === 'demo';
}

/**
 * Detect a demo profile from the two possible env-var slots
 * (`UE_FEATURE_PROFILE` and `NEXT_PUBLIC_UE_DEMO_PROFILE`).
 *
 * Returns the matched value (already lower-cased) or `null`.
 */
export function detectDemoProfile(
  ueFeatureProfile: string | null | undefined,
  publicDemoProfile: string | null | undefined,
): DemoProfileValue | null {
  const uv = (ueFeatureProfile ?? '').trim().toLowerCase();
  if (DEMO_SET.has(uv)) return uv as DemoProfileValue;
  const pv = (publicDemoProfile ?? '').trim().toLowerCase();
  if (DEMO_SET.has(pv)) return pv as DemoProfileValue;
  return null;
}

export interface EnvIdentityInput {
  targetEnvironment?: string | null;
  ueFeatureProfile?: string | null;
  publicDemoProfile?: string | null;
  nodeEnv?: string | null;
}

export interface EnvIdentity {
  /** Canonical target environment. */
  target: TargetEnvironment;
  /** Detected demo profile, or `null` if none set. */
  demoProfile: DemoProfileValue | null;
  /** True iff a demo profile is set in a deployed (staging/pilot/prod) target. */
  forbiddenDemoInDeployed: boolean;
}

/**
 * Resolve a full environment identity from the four canonical env-var
 * signals. Falls back to `nodeEnv` for target when
 * `targetEnvironment` is absent.
 */
export function resolveEnvIdentity(input: EnvIdentityInput): EnvIdentity {
  const target = normalizeTargetEnvironment(
    input.targetEnvironment ?? input.nodeEnv,
  );
  const demoProfile = detectDemoProfile(
    input.ueFeatureProfile,
    input.publicDemoProfile,
  );
  return {
    target,
    demoProfile,
    forbiddenDemoInDeployed: demoProfile !== null && isDeployedTarget(target),
  };
}

/**
 * Assert that `TARGET_ENVIRONMENT` equals the expected value. Throws
 * (never returns) otherwise. If the env var is unset AND `expected`
 * is `'demo'`, this is treated as a local-dev convenience and the
 * function returns `'demo'` without throwing — but only for that
 * specific target. Every deployed artifact MUST set the env
 * explicitly.
 */
export function assertTargetEnvironmentIs(
  expected: TargetEnvironment,
  env: NodeJS.ProcessEnv = process.env,
): TargetEnvironment {
  const raw = env.TARGET_ENVIRONMENT?.trim();
  if (!raw && expected === 'demo') return 'demo';
  const resolved = normalizeTargetEnvironment(raw);
  if (resolved !== expected) {
    throw new Error(
      `[reality-env] TARGET_ENVIRONMENT must be "${expected}" for this artifact; got "${raw ?? '(unset)'}".`,
    );
  }
  return expected;
}

/**
 * Reason string builder for guard failures. Kept as a helper so both
 * legacy guard-result shapes can format identically.
 */
export function forbiddenDemoReason(
  demoProfile: DemoProfileValue,
  target: TargetEnvironment,
): string {
  return (
    `Demo profile "${demoProfile}" is set for target environment "${target}". ` +
    'Demo profiles are only permitted in development/local/test. ' +
    'Unset UE_FEATURE_PROFILE and NEXT_PUBLIC_UE_DEMO_PROFILE for this environment.'
  );
}
