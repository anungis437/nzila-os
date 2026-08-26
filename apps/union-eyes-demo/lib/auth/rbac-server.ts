/**
 * Demo-local RBAC-server shim.
 *
 * Wave 0 §2 remediation: replaces `@/lib/auth/rbac-server` imports (which
 * would resolve into the operational app) with a demo-safe implementation.
 *
 * In the demo, roles come from the persona resolver in
 * `lib/demo/cupe4373-member-view.ts` and the demo cognition core. There is
 * NO operational role table lookup — this function ALWAYS returns
 * `UserRole.MEMBER` unless the demo cognition core explicitly overrides via
 * environment.
 */

import { UserRole } from './roles';

export async function getUserRole(
  _userId: string,
  _organizationId: string,
): Promise<UserRole> {
  // Demo default: every user is a MEMBER unless the persona resolver
  // overrides. Steward / officer views are selected by the demo persona
  // mapping in `lib/demo/cupe4373-cognition-core.ts` and its callers,
  // not by an operational RBAC query.
  return UserRole.MEMBER;
}
