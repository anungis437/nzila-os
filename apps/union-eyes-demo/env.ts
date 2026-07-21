/**
 * Environment identity contract — Union Eyes Demo.
 *
 * Wave 0 §3 + §5: the demo app is REQUIRED to run with
 * `TARGET_ENVIRONMENT=demo`. It is a compile-time and runtime
 * invariant that this app never boots in `pilot` or `production`.
 *
 * A single authoritative env-identity module lives in
 * `tooling/reality/env-identity.ts` (added in §5). This module
 * re-exports the demo-scoped narrowing so demo application code can
 * import it directly without reaching into `tooling/`.
 */
import 'server-only';

export const DEMO_TARGET_ENVIRONMENT = 'demo' as const;

export type DemoTargetEnvironment = typeof DEMO_TARGET_ENVIRONMENT;

/**
 * Assert at boot time that we are running as the demo artifact.
 *
 * Throws (never returns) if `TARGET_ENVIRONMENT` is set to anything
 * other than `"demo"`. Empty / unset is treated as `"demo"` so local
 * `pnpm dev` works out of the box.
 */
export function assertDemoEnvironment(): DemoTargetEnvironment {
  const raw = process.env.TARGET_ENVIRONMENT?.trim();
  if (raw && raw !== DEMO_TARGET_ENVIRONMENT) {
    throw new Error(
      `[union-eyes-demo] TARGET_ENVIRONMENT must be "${DEMO_TARGET_ENVIRONMENT}" ` +
        `for this artifact. Got "${raw}". Refusing to boot.`,
    );
  }
  return DEMO_TARGET_ENVIRONMENT;
}

/** Cached value; safe to read after `assertDemoEnvironment()` runs. */
export const DEMO_ENV = assertDemoEnvironment();
