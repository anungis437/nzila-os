/**
 * Demo Deployment Guard (CLI + pure function).
 *
 * Wave 0 §5: all classification logic is delegated to
 * `@nzila/reality-env` (the single authoritative env-identity
 * contract). This file preserves its historical `DemoGuardResult`
 * shape for backwards compatibility with existing callers and tests.
 *
 * Consumed at three layers:
 *
 *   1. **Build layer:**  `pnpm reality:demo-guard` — CI step before
 *      a production build.
 *   2. **Runtime layer:**  `assertDemoDeploymentGuard()` — invoked
 *      from `apps/union-eyes/instrumentation.ts` via the runtime
 *      companion at `apps/union-eyes/lib/reality/demo-deployment-guard.ts`.
 *   3. **Deploy layer:**  GitHub Actions env-scan step in
 *      `.github/workflows/gitops-deploy.yml`.
 */
import {
  detectDemoProfile,
  forbiddenDemoReason,
  isDevTarget,
  normalizeTargetEnvironment,
  type DemoProfileValue,
  type TargetEnvironment,
} from '@nzila/reality-env';

export type ResolvedEnvironment = TargetEnvironment;

export interface DemoGuardInput {
  targetEnvironment: string | undefined;
  ueFeatureProfile: string | undefined;
  publicDemoProfile: string | undefined;
  nodeEnv: string | undefined;
}

export interface DemoGuardResult {
  ok: boolean;
  reason?: string;
  resolvedEnvironment: ResolvedEnvironment;
  demoProfileDetected: DemoProfileValue | null;
}

export function evaluateDemoGuard(input: DemoGuardInput): DemoGuardResult {
  const target = normalizeTargetEnvironment(
    input.targetEnvironment ?? input.nodeEnv,
  );
  const demoProfile = detectDemoProfile(
    input.ueFeatureProfile,
    input.publicDemoProfile,
  );
  if (demoProfile && !isDevTarget(target)) {
    return {
      ok: false,
      resolvedEnvironment: target,
      demoProfileDetected: demoProfile,
      reason: forbiddenDemoReason(demoProfile, target),
    };
  }
  return {
    ok: true,
    resolvedEnvironment: target,
    demoProfileDetected: demoProfile,
  };
}

export function assertDemoDeploymentGuard(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const result = evaluateDemoGuard({
    targetEnvironment: env.UE_TARGET_ENVIRONMENT,
    ueFeatureProfile: env.UE_FEATURE_PROFILE,
    publicDemoProfile: env.NEXT_PUBLIC_UE_DEMO_PROFILE,
    nodeEnv: env.NODE_ENV,
  });
  if (!result.ok) {
    throw new Error(`[demo-deployment-guard] ${result.reason}`);
  }
}

async function cli(): Promise<void> {
  const result = evaluateDemoGuard({
    targetEnvironment: process.env.UE_TARGET_ENVIRONMENT,
    ueFeatureProfile: process.env.UE_FEATURE_PROFILE,
    publicDemoProfile: process.env.NEXT_PUBLIC_UE_DEMO_PROFILE,
    nodeEnv: process.env.NODE_ENV,
  });
  if (!result.ok) {
    console.error(`❌ ${result.reason}`);
    process.exit(1);
  }
  console.log(
    `✅ demo-deployment-guard: target=${result.resolvedEnvironment}, demo-profile=${
      result.demoProfileDetected ?? 'none'
    }`,
  );
}

// Run as a CLI only when executed directly.
const isDirect = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = (import.meta as any).url as string | undefined;
    return (
      typeof url === 'string' &&
      process.argv[1] &&
      new URL(url).pathname.endsWith(
        process.argv[1].replace(/\\/g, '/').split('/').pop() ?? '',
      )
    );
  } catch {
    return false;
  }
})();
if (isDirect) {
  cli().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
