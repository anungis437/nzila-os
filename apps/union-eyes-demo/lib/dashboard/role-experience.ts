/**
 * Demo-local dashboard role-experience shim.
 *
 * Wave 0 §2 remediation: replaces `@/lib/dashboard/role-experience` (which
 * would resolve into the operational app) with a demo-native
 * implementation.
 *
 * Demo-specific semantics:
 *
 *   - `isCupe4373DemoRuntime()` — in this build unit it is ALWAYS `true`.
 *     The demo app is, by definition, the CUPE 4373 demo. It never renders
 *     an operational fallback.
 *   - `getDashboardExperience(role)` — maps demo role sentinels to the
 *     four demo dashboard views (member, staff, governance, admin).
 */

import { UserRole } from '../auth/roles';

export type DashboardExperience = 'member' | 'staff' | 'governance' | 'admin';

/**
 * ALWAYS `true` in the demo build unit. Present only so demo pages that
 * were formerly gated by this call still type-check; downstream
 * simplifications should delete callers entirely.
 */
export function isCupe4373DemoRuntime(): boolean {
  return true;
}

export function getDashboardExperience(role?: string | null): DashboardExperience {
  const normalized = (role ?? UserRole.MEMBER).toLowerCase();
  if (normalized === UserRole.ADMIN) return 'admin';
  if (normalized === UserRole.OFFICER) return 'governance';
  if (normalized === UserRole.STEWARD) return 'staff';
  return 'member';
}
