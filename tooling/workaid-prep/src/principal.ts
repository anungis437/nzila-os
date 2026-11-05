import type { MemberId, OrganizationId, UserId } from './ids.ts';

export type Role =
  | 'UNION_REFERRAL_REP'
  | 'UNION_VIEWER'
  | 'UNION_ADMIN'
  | 'MEMBER'
  | 'WORKAID_SPECIALIST'
  | 'WORKAID_PRINCIPAL'
  | 'UE_PLATFORM_OPS';

/**
 * A principal is the output of the trusted server-side resolver (session ->
 * one scoped active membership). Nothing in this package derives a principal
 * from request bodies, headers or other client-controlled input. Functions that
 * take a client-asserted identity (for example a `claimedApprover` string)
 * must compare it to the principal and reject any mismatch.
 */
export interface Principal {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly roles: readonly Role[];
  /** False when the session or membership has been invalidated server-side. */
  readonly sessionActive: boolean;
  /** Present only for MEMBER principals; resolved server-side, never client-supplied. */
  readonly subjectMemberId?: MemberId;
}

export const WORKAID_ROLES: readonly Role[] = ['WORKAID_SPECIALIST', 'WORKAID_PRINCIPAL'];
export const UNION_ROLES: readonly Role[] = ['UNION_REFERRAL_REP', 'UNION_VIEWER', 'UNION_ADMIN'];

export function hasAnyRole(p: Principal, roles: readonly Role[]): boolean {
  return p.sessionActive && p.roles.some((r) => roles.includes(r));
}
