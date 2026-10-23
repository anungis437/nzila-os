import type { MatterGrantId, MatterId, RepresentationAuthorizationId, SubmissionId, UserId } from './ids.ts';
import type { DocumentDisclosureGrant, MatterAccessGrant, Matter, RepresentationAuthorization } from './authorization.ts';
import type { Principal } from './principal.ts';
import { hasAnyRole, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';
import type { Reminder, ReceiptFollowUpTask } from './followup.ts';
import type { Submission } from './submission.ts';

/**
 * Proposed revocation behaviour (WA-R3-008, WA-R3-015, WA-R4-09). Pure
 * specification of what a single atomic revocation must do; it is NOT a patch to
 * apps/union-eyes/lib/services/representation-authority-service.ts.
 *
 * Distinct records: revoking a WSIB DOA ends the right to act as WSIB
 * representative; it does not by itself end a technical grant, and revoking a
 * technical grant does not revoke a DOA. Downstream effects are explicit.
 */
export interface RevocationState {
  readonly authorizations: readonly RepresentationAuthorization[];
  readonly matterGrants: readonly MatterAccessGrant[];
  readonly documentGrants: readonly DocumentDisclosureGrant[];
  readonly tasks: readonly ReceiptFollowUpTask[];
  readonly reminders: readonly Reminder[];
  readonly submissions: readonly Submission[];
  readonly revocationEpoch: number;
}

export interface RevocationResult {
  readonly state: RevocationState;
  /** Scoped session invalidations: only the affected user for the affected matter, never unrelated orgs. */
  readonly sessionInvalidations: readonly { readonly userId: UserId; readonly matterId: MatterId }[];
  /** APPROVED but undispatched submissions that relied on the revoked authority. Must return to REVIEWED. */
  readonly approvalsToInvalidate: readonly SubmissionId[];
  readonly auditEvents: readonly { readonly action: string; readonly target: string }[];
}

export function revokeAuthorization(
  state: RevocationState,
  authorizationId: RepresentationAuthorizationId,
  principal: Principal,
  matter: Pick<Matter, 'id' | 'ownerOrganizationId' | 'specialistOrganizationId'>,
  now: string,
): Result<RevocationResult, 'NOT_AUTHORIZED' | 'NO_SUCH_AUTHORIZATION'> {
  if (!hasAnyRole(principal, [...WORKAID_ROLES, 'UNION_ADMIN'])) return err('NOT_AUTHORIZED', 'role may not revoke');
  if (principal.organizationId !== matter.ownerOrganizationId && principal.organizationId !== matter.specialistOrganizationId) {
    return err('NO_SUCH_AUTHORIZATION', 'unknown authorization');
  }
  const auth = state.authorizations.find((a) => a.id === authorizationId && a.matterId === matter.id);
  if (!auth) return err('NO_SUCH_AUTHORIZATION', 'unknown authorization');

  const authorizations = state.authorizations.map((a) => (a.id === authorizationId ? { ...a, status: 'REVOKED' as const, revokedAt: now } : a));
  const dependentGrants = state.matterGrants.filter((g) => g.sourceAuthorizationId === authorizationId && g.status === 'ACTIVE');
  const dependentIds = new Set<MatterGrantId>(dependentGrants.map((g) => g.id));
  const matterGrants = state.matterGrants.map((g) => (dependentIds.has(g.id) ? { ...g, status: 'REVOKED' as const, revokedAt: now } : g));
  const documentGrants = state.documentGrants.map((g) =>
    g.matterGrantId && dependentIds.has(g.matterGrantId) && g.status === 'ACTIVE' ? { ...g, status: 'REVOKED' as const, revokedAt: now } : g,
  );

  const doaRevoked = auth.type === 'WSIB_DOA';
  const approvalsToInvalidate = doaRevoked
    ? state.submissions.filter((s) => s.matterId === auth.matterId && s.state === 'APPROVED' && s.kind !== 'DOA').map((s) => s.id)
    : [];

  // Reminders for tasks owned by users who just lost their grant are cancelled; tasks stay for human reassignment.
  const lostUsers = new Set(dependentGrants.map((g) => g.userId));
  const reminders = state.reminders.map((r) => {
    const task = state.tasks.find((t) => t.id === r.taskId);
    const affected = !!task && task.matterId === auth.matterId && lostUsers.has(r.recipient);
    return affected && (r.status === 'SCHEDULED' || r.status === 'FAILED_RETRYABLE') ? { ...r, status: 'CANCELLED_SUPERSEDED' as const, lease: null } : r;
  });

  return ok({
    state: { ...state, authorizations, matterGrants, documentGrants, reminders, revocationEpoch: state.revocationEpoch + 1 },
    sessionInvalidations: dependentGrants.map((g) => ({ userId: g.userId, matterId: g.matterId })),
    approvalsToInvalidate,
    auditEvents: [
      { action: 'AUTHORIZATION_REVOKED', target: authorizationId },
      ...dependentGrants.map((g) => ({ action: 'MATTER_GRANT_REVOKED_BY_CASCADE', target: g.id })),
    ],
  });
}
