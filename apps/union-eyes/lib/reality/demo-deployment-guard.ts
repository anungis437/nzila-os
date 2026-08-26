/**
 * Runtime companion to `tooling/reality/demo-deployment-guard.ts`.
 *
 * Wave 0 §5: this file now delegates to `@nzila/reality-env`, the
 * single authoritative env-identity contract. Both this runtime
 * helper and the CLI/tooling helper share the exact same
 * classification rules.
 *
 * This module is imported from `apps/union-eyes/instrumentation.ts`
 * so the running server fails-closed at boot if a demo profile is
 * detected in staging / pilot / production.
 *
 * The historical result shape (with a boolean `demoProfileDetected`)
 * is preserved for backwards compatibility with existing callers and
 * tests.
 *
 * See docs/union-eyes/reality-remediation/16_ANTI_THEATRE_BASELINE.md.
 */
import {
  detectDemoProfile,
  isDevTarget,
  normalizeTargetEnvironment,
} from '@nzila/reality-env';

export interface DemoGuardEnv {
  targetEnvironment?: string;
  ueFeatureProfile?: string;
  publicDemoProfile?: string;
  nodeEnv?: string;
}

export interface DemoGuardResult {
  ok: boolean;
  reason?: string;
  resolvedEnvironment: string;
  demoProfileDetected: boolean;
}

export function evaluateDemoGuard(env: DemoGuardEnv): DemoGuardResult {
  const resolvedEnvironment = normalizeTargetEnvironment(env.targetEnvironment);
  const demoProfile = detectDemoProfile(
    env.ueFeatureProfile,
    env.publicDemoProfile,
  );
  const demoProfileDetected = demoProfile !== null;

  if (!demoProfileDetected) {
    return { ok: true, resolvedEnvironment, demoProfileDetected: false };
  }

  if (isDevTarget(resolvedEnvironment)) {
    return { ok: true, resolvedEnvironment, demoProfileDetected: true };
  }

  return {
    ok: false,
    resolvedEnvironment,
    demoProfileDetected: true,
    reason: `demo profile (UE_FEATURE_PROFILE=${env.ueFeatureProfile ?? ''} / NEXT_PUBLIC_UE_DEMO_PROFILE=${env.publicDemoProfile ?? ''}) is forbidden in target=${resolvedEnvironment}`,
  };
}

export function assertDemoDeploymentGuard(env: DemoGuardEnv): void {
  const verdict = evaluateDemoGuard(env);
  if (!verdict.ok) {
    throw new Error(`[demo-deployment-guard] ${verdict.reason}`);
  }
}
