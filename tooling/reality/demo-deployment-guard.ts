/**
 * Demo Deployment Guard
 *
 * Rejects any non-development environment that has demo-profile settings
 * baked in.  Consumed at three layers:
 *
 *   1. **Build layer:**  `pnpm reality:demo-guard` — invoked during CI
 *      before a production build.  Reads `process.env` and the resolved
 *      environment (`NODE_ENV`, `NEXT_PUBLIC_UE_DEMO_PROFILE`,
 *      `UE_FEATURE_PROFILE`, `UE_TARGET_ENVIRONMENT`), and exits non-zero
 *      if a demo profile is set for a target environment that is not
 *      `development` / `test` / `local`.
 *
 *   2. **Runtime layer:**  Import `assertDemoDeploymentGuard()` from the
 *      application startup (Next.js `instrumentation.ts` or a top-level
 *      layout) to fail-closed if a running instance discovers demo
 *      settings in staging / pilot / production at boot.
 *
 *   3. **Deploy layer:**  A GitHub Actions step (added to
 *      `.github/workflows/gitops-deploy.yml`) that greps the resolved
 *      Container App env for a demo profile before rolling forward a
 *      revision — see `docs/union-eyes/reality-remediation/11_CI_CD_AND_QUALITY_GATES.md`.
 *
 * Development / local / test targets remain fully unaffected.
 */

export type ResolvedEnvironment =
  | 'development'
  | 'local'
  | 'test'
  | 'staging'
  | 'pilot'
  | 'production';

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
  demoProfileDetected: string | null;
}

const DEV_TARGETS: ReadonlyArray<ResolvedEnvironment> = ['development', 'local', 'test'];

const DEMO_PROFILE_VALUES = new Set([
  'cupe4373',
  'demo',
  'sample',
  'placeholder',
]);

function normaliseTarget(value: string | undefined): ResolvedEnvironment {
  const v = (value ?? '').trim().toLowerCase();
  switch (v) {
    case 'development':
    case 'dev':
    case 'local':
    case 'test':
    case 'staging':
    case 'pilot':
    case 'production':
    case 'prod':
      return v === 'dev' ? 'development' : v === 'prod' ? 'production' : (v as ResolvedEnvironment);
    default:
      // Absent target defaults to production for safety — a missing
      // signal must not authorise demo mode.
      return 'production';
  }
}

export function evaluateDemoGuard(input: DemoGuardInput): DemoGuardResult {
  const target = normaliseTarget(input.targetEnvironment ?? input.nodeEnv);
  const uv = (input.ueFeatureProfile ?? '').trim().toLowerCase();
  const pv = (input.publicDemoProfile ?? '').trim().toLowerCase();
  const demoDetected =
    (uv && DEMO_PROFILE_VALUES.has(uv) ? uv : null) ??
    (pv && DEMO_PROFILE_VALUES.has(pv) ? pv : null);

  if (demoDetected && !DEV_TARGETS.includes(target)) {
    return {
      ok: false,
      resolvedEnvironment: target,
      demoProfileDetected: demoDetected,
      reason:
        `Demo profile "${demoDetected}" is set for target environment "${target}". ` +
        'Demo profiles are only permitted in development/local/test. ' +
        'Unset UE_FEATURE_PROFILE and NEXT_PUBLIC_UE_DEMO_PROFILE for this environment.',
    };
  }
  return {
    ok: true,
    resolvedEnvironment: target,
    demoProfileDetected: demoDetected,
  };
}

export function assertDemoDeploymentGuard(env: NodeJS.ProcessEnv = process.env): void {
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
    // Use dynamic import.meta only if available.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const url = (import.meta as any).url as string | undefined;
    return typeof url === 'string' && process.argv[1] && new URL(url).pathname.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop() ?? '');
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
