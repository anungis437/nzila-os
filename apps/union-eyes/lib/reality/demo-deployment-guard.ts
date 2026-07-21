/**
 * Runtime companion to `tooling/reality/demo-deployment-guard.ts`.
 *
 * The tooling module is a CLI + pure function used by CI. This file
 * mirrors the same pure logic so `apps/union-eyes/instrumentation.ts`
 * can fail-closed at process start without pulling a cross-package
 * relative import through Turbopack.
 *
 * KEEP THIS FILE IN SYNC with `tooling/reality/demo-deployment-guard.ts`.
 * Both are covered by tests:
 *  - `tooling/reality/__tests__/demo-deployment-guard.test.ts`
 *  - `apps/union-eyes/lib/reality/__tests__/demo-deployment-guard.test.ts`
 *
 * See docs/union-eyes/reality-remediation/16_ANTI_THEATRE_BASELINE.md.
 */

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

const DEV_TARGETS = new Set(['development', 'local', 'test']);
const DEMO_VALUES = new Set(['cupe4373', 'demo', 'sample', 'placeholder']);

function isDemoProfile(value: string | undefined): boolean {
  if (!value) return false;
  return DEMO_VALUES.has(value.trim().toLowerCase());
}

export function evaluateDemoGuard(env: DemoGuardEnv): DemoGuardResult {
  // Fail-closed default: if the caller did not specify a target, treat
  // this as production.
  const resolvedEnvironment = (env.targetEnvironment ?? 'production').trim().toLowerCase();
  const demoProfileDetected = isDemoProfile(env.ueFeatureProfile) || isDemoProfile(env.publicDemoProfile);

  if (!demoProfileDetected) {
    return { ok: true, resolvedEnvironment, demoProfileDetected: false };
  }

  if (DEV_TARGETS.has(resolvedEnvironment)) {
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
