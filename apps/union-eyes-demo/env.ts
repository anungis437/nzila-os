/**
 * Environment identity contract — Union Eyes Demo.
 *
 * Wave 0 §3 + §5: the demo app MUST run with
 * `TARGET_ENVIRONMENT=demo`. This is both a compile-time and runtime
 * invariant — the demo artifact is never allowed to boot in pilot or
 * production.
 *
 * The canonical env-identity contract lives in `@nzila/reality-env`.
 * This module re-exports the demo-scoped narrowing so demo
 * application code can import it directly without touching the
 * lower-level package or reaching into `tooling/`.
 */
import 'server-only';
import { assertTargetEnvironmentIs } from '@nzila/reality-env';

export const DEMO_TARGET_ENVIRONMENT = 'demo' as const;

export type DemoTargetEnvironment = typeof DEMO_TARGET_ENVIRONMENT;

/**
 * Assert at boot time that we are running as the demo artifact.
 *
 * Delegates to `@nzila/reality-env`. Throws (never returns) if
 * `TARGET_ENVIRONMENT` is set to anything other than `"demo"`. Empty
 * / unset is tolerated only for `"demo"` so local `pnpm dev` works
 * without extra configuration.
 */
export function assertDemoEnvironment(): DemoTargetEnvironment {
  assertTargetEnvironmentIs(DEMO_TARGET_ENVIRONMENT);
  return DEMO_TARGET_ENVIRONMENT;
}

/** Cached value; safe to read after `assertDemoEnvironment()` runs. */
export const DEMO_ENV = assertDemoEnvironment();
