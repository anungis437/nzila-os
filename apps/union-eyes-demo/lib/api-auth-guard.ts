/**
 * Demo-local api-auth-guard shim.
 *
 * Wave 0 §2 remediation: the demo app must not import from the operational
 * `apps/union-eyes/lib/api-auth-guard.ts`. This shim exposes ONLY the two
 * helpers the demo pages actually use (`requireUser`, `hasMinRole`) with
 * demo-safe semantics:
 *
 *   - `requireUser()` — resolves the current platform-auth user; throws if
 *     none. Callers `redirect('/login')` on failure.
 *   - `hasMinRole()` — always returns `true` in the demo (no operational
 *     RBAC hierarchy; every authenticated demo user sees the demo consoles).
 *
 * Do NOT expand this shim to mirror the operational surface — the demo
 * boundary rule (Wave 0 §2) prohibits sharing operational auth logic.
 */

import { auth } from '@nzila/platform-auth/entra/server';

export async function requireUser(): Promise<{ userId: string }> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('DEMO_UNAUTHENTICATED');
  }
  return { userId };
}

/**
 * Demo-local minimum-role check. Every authenticated user in the demo
 * has access to every demo console (there are no real permissions to
 * enforce against fixture data). Returns `true` iff a session exists.
 */
export async function hasMinRole(_minRole: string): Promise<boolean> {
  const { userId } = await auth();
  return Boolean(userId);
}
