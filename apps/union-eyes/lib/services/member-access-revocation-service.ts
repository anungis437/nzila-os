import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema';
import { withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { authDb, withAuthContext } from '@nzila/platform-auth/auth-execution';

/** Callers retain their administrator guard; bind every auth write to the real actor. */
async function withMemberAuthMutation<T>(
  input: { authUserId: string; organizationId: string },
  operation: 'revoke-sessions' | 'membership-state',
  callback: () => Promise<T>,
): Promise<T> {
  const { auth } = await import('@nzila/platform-auth/entra/server');
  const actor = await auth();
  if (!actor.userId) throw new Error('Authenticated member administrator required');
  return withAuthContext({
    phase: 'system', operation, actorUserId: actor.userId,
    targetUserId: input.authUserId, organizationId: input.organizationId.toLowerCase(),
    reason: 'Administrator member access enforcement',
  }, callback);
}

export interface RevokeMemberAccessInput {
  /** organizationMembers.id — the membership row's own identity. */
  membershipId: string;
  /**
   * organizationMembers.userId — the REAL authenticated user principal.
   * Never pass membershipId here: sessions/case-access/auth-membership are
   * all keyed by this value, not the membership row id.
   */
  authUserId: string;
  organizationId: string;
  newLocalStatus: 'inactive' | 'deleted';
  /** The authenticated administrator performing the offboarding; recorded in the durable audit. */
  actorUserId: string;
}

export interface RevokeMemberAccessResult {
  success: boolean;
  sessionsRevoked: boolean;
  authMembershipDisabled: boolean;
  caseAccessRevokedCount: number;
  localStatusUpdated: boolean;
  errors: string[];
}

export interface ReactivateMemberAccessInput {
  /** organizationMembers.id — the membership row's own identity. */
  membershipId: string;
  /** organizationMembers.userId — the REAL authenticated user principal. */
  authUserId: string;
  organizationId: string;
  /** The authenticated administrator performing the reactivation; recorded in the durable audit. */
  actorUserId: string;
}

export interface ReactivateMemberAccessResult {
  success: boolean;
  authMembershipReenabled: boolean;
  localStatusUpdated: boolean;
  errors: string[];
}

/**
 * PR #752 round 12: the ONE idempotent security-enforcement primitive for
 * offboarding a member — replaces the previous "fire an event and hope a
 * listener is registered" model
 * (lib/events/pilot-event-listeners.ts's 'member.status_changed' handler),
 * which (a) received the wrong identifier (membershipId instead of
 * authUserId — sessions/case-access are keyed by the real auth user, not
 * the membership row's own UUID), (b) swallowed every revocation error,
 * and (c) depended on a side-effect import registering the listener in an
 * unrelated route bundle (app/api/cases/intake/route.ts).
 *
 * FAILS CLOSED: every step is attempted and its own failure recorded
 * independently (one failing step does not short-circuit the others —
 * maximizes access-denial coverage), but `success` is only true if EVERY
 * step succeeded. Callers MUST return non-2xx and must NOT claim
 * successful offboarding when `success` is false. Every step is safe to
 * retry (idempotent): re-revoking an already-revoked session/assignment,
 * or re-disabling an already-disabled auth membership, is a no-op, not an
 * error.
 *
 * Canonical auth deployments use the dedicated auth-system gateway rather than
 * either business database client. Each auth mutation binds the authenticated
 * administrator, target user, organization, operation and reason. The session
 * helper uses its native auth executor; no raw business-client override is used.
 */
export async function revokeMemberAccess(input: RevokeMemberAccessInput): Promise<RevokeMemberAccessResult> {
  const errors: string[] = [];
  let sessionsRevoked = false;
  let authMembershipDisabled = false;
  let caseAccessRevokedCount = 0;
  let localStatusUpdated = false;

  // 1. Revoke all active sessions for the REAL auth user id, via the
  // SYSTEM auth DB credential (cross-user operation).
  try {
    const { revokeAllUserSessions } = await import('@nzila/platform-auth/password');
    await withMemberAuthMutation(input, 'revoke-sessions', () => revokeAllUserSessions(input.authUserId));
    sessionsRevoked = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`session_revocation_failed: ${message}`);
    logger.error('session_revocation_failed', { authUserId: input.authUserId, error: err });
  }

  // 2. Disable the durable platform-auth organization membership — the
  // canonical role resolver checks authOrganizationUsers BEFORE falling
  // back to organizationMembers, so leaving it active would let the user
  // re-establish authorized access even after sessions are revoked. Runs
  // via the SYSTEM auth DB credential (cross-user operation).
  try {
    const { authOrganizationUsers } = await import('@nzila/db/schema');
    await withMemberAuthMutation(input, 'membership-state', () => authDb
      .update(authOrganizationUsers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(authOrganizationUsers.userId, input.authUserId),
          eq(authOrganizationUsers.organizationId, input.organizationId),
        ),
      ));
    authMembershipDisabled = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`auth_membership_disable_failed: ${message}`);
    logger.error('auth_membership_disable_failed', {
      authUserId: input.authUserId,
      organizationId: input.organizationId,
      error: err,
    });
  }

  // 3. Case access. Kernel case relationships are only ever effective for an ACTIVE membership: the kernel checks the
  // membership on every decision, so disabling it above ends every relationship at once, without rewriting any
  // governed record. This step only counts the relationships that were live, for the revocation report.
  try {
    await withSystemContext(async (_tx) => {
      const rows = await db.execute(sql`
        SELECT count(*)::int AS n FROM ue_authority_resource_relationships
         WHERE organization_id = ${input.organizationId}::uuid AND principal_user_id = ${input.authUserId}
           AND resource_type = 'case' AND status = 'active' AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > now())`);
      const list = (Array.isArray(rows) ? rows : (rows as { rows?: { n: number }[] }).rows ?? []) as { n: number }[];
      caseAccessRevokedCount = Number(list[0]?.n ?? 0);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`case_access_revocation_failed: ${message}`);
    logger.error('case_access_revocation_failed', {
      authUserId: input.authUserId,
      organizationId: input.organizationId,
      error: err,
    });
  }

  // 4. Persist local membership state — done under SYSTEM_RUNTIME since a
  // platform-admin caller (see app/api/admin/users/[userId]/route.ts) has
  // no ordinary tenant RLS context for an arbitrary target organization.
  try {
    // The local state change and the revocation audit commit together; an outcome that records earlier-step
    // failures is audited as a failure, but the local denial is still applied.
    await withSystemContext(async (tx) => {
      if (input.newLocalStatus === 'deleted') {
        await tx
          .update(organizationMembers)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(organizationMembers.id, input.membershipId));
      } else {
        await tx
          .update(organizationMembers)
          .set({ status: 'inactive', updatedAt: new Date() })
          .where(eq(organizationMembers.id, input.membershipId));
      }
      await persistAtomicAudit(
        tx as RLSTx,
        {
          organizationId: input.organizationId,
          userId: input.actorUserId,
          action: input.newLocalStatus === 'deleted' ? 'member.access.delete' : 'member.access.deactivate',
          resourceType: 'organization_members',
          resourceId: input.membershipId,
          details: {
            targetUserId: input.authUserId,
            sessionsRevoked,
            authMembershipDisabled,
            liveCaseRelationships: caseAccessRevokedCount,
            incompleteSteps: errors.length > 0 ? errors : undefined,
          },
        },
        errors.length > 0 ? 'failure' : 'success',
      );
    });
    localStatusUpdated = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`local_status_update_failed: ${message}`);
    logger.error('local_status_update_failed', { membershipId: input.membershipId, error: err });
  }

  const success = errors.length === 0;
  if (!success) {
    logger.error('member_access_revocation_incomplete', {
      membershipId: input.membershipId,
      authUserId: input.authUserId,
      organizationId: input.organizationId,
      errors,
    });
  }

  return {
    success,
    sessionsRevoked,
    authMembershipDisabled,
    caseAccessRevokedCount,
    localStatusUpdated,
    errors,
  };
}

/**
 * PR #752 round 13: reactivation counterpart to revokeMemberAccess().
 * Deactivation disables authOrganizationUsers, revokes sessions, and
 * revokes case access; reactivation must symmetrically re-enable the
 * durable auth membership — restoring only organizationMembers.status
 * left the platform-auth membership disabled, so a "successfully
 * reactivated" member could still fail the canonical role resolver.
 *
 * Deliberately does NOT:
 *   - mint or restore a session (the user authenticates normally after
 *     reactivation; no automatic re-login);
 *   - restore previously-revoked grievance case-access assignments
 *     (revoked access stays revoked by default — a case-access grant is a
 *     separate, explicit decision, not an automatic side effect of
 *     reactivating membership).
 *
 * PR #752 round 14: unlike revokeMemberAccess() (where partial success is
 * safe — a step that fails to revoke access only leaves MORE access
 * revoked, never less), reactivation's two writes each independently
 * grant authority: the canonical role resolver checks authOrganizationUsers
 * FIRST, then falls back to organizationMembers — so EITHER write
 * succeeding alone can already authorize the user, regardless of the
 * other. Two independent try/catch blocks (round 13's original shape)
 * could report success:false (502) while one store was already active.
 * Both writes run inside a SINGLE scoped auth-system transaction (one physical
 * connection, spanning both the user_management and public schemas on
 * the same database) with RETURNING-based affected-row assertions — a
 * missing row or any error rolls back BOTH writes, so authority is never
 * partially restored.
 */
export async function reactivateMemberAccess(
  input: ReactivateMemberAccessInput,
): Promise<ReactivateMemberAccessResult> {
  const errors: string[] = [];
  let authMembershipReenabled = false;
  let localStatusUpdated = false;

  const auditEntry = (action: string, details: Record<string, unknown> = {}) => ({
    organizationId: input.organizationId,
    userId: input.actorUserId,
    action,
    resourceType: 'organization_members',
    resourceId: input.membershipId,
    details: { targetUserId: input.authUserId, ...details },
  });

  // Reactivation grants authority in two stores that cannot share the audit transaction. The attempt is therefore
  // made durable first: if it cannot be recorded, nothing is granted.
  try {
    await withSystemContext((tx) => persistAtomicAudit(tx as RLSTx, auditEntry('member.access.reactivate_attempt')));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('reactivation_attempt_audit_failed', { membershipId: input.membershipId, error: err });
    return { success: false, authMembershipReenabled, localStatusUpdated, errors: [`audit_unavailable: ${message}`] };
  }

  try {
    const { authOrganizationUsers } = await import('@nzila/db/schema');

    // The canonical UE membership projection grants only this actor/target/org's
    // status columns to the auth executor, preserving one physical transaction.
    await withMemberAuthMutation(input, 'membership-state', async () => {
      const [authRow] = await authDb
        .update(authOrganizationUsers)
        .set({ isActive: true, updatedAt: new Date() })
        .where(
          and(
            eq(authOrganizationUsers.userId, input.authUserId),
            eq(authOrganizationUsers.organizationId, input.organizationId),
          ),
        )
        .returning({ organizationUserId: authOrganizationUsers.organizationUserId });
      if (!authRow) {
        throw new Error('auth_membership_row_not_found');
      }

      const [localRow] = await authDb
        .update(organizationMembers)
        .set({ status: 'active', updatedAt: new Date() })
        .where(and(
          eq(organizationMembers.id, input.membershipId),
          eq(organizationMembers.userId, input.authUserId),
          eq(organizationMembers.organizationId, input.organizationId),
        ))
        .returning({ id: organizationMembers.id });
      if (!localRow) {
        throw new Error('local_membership_row_not_found');
      }
    });

    authMembershipReenabled = true;
    localStatusUpdated = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`reactivation_transaction_failed: ${message}`);
    logger.error('reactivation_transaction_failed', {
      membershipId: input.membershipId,
      authUserId: input.authUserId,
      organizationId: input.organizationId,
      error: err,
    });
  }

  // The attempt record already exists, so a failure to record the outcome is logged rather than reversing a grant.
  try {
    await withSystemContext((tx) => persistAtomicAudit(
      tx as RLSTx,
      auditEntry('member.access.reactivate', { errors: errors.length > 0 ? errors : undefined }),
      errors.length > 0 ? 'failure' : 'success',
    ));
  } catch (err) {
    logger.error('reactivation_outcome_audit_failed', { membershipId: input.membershipId, error: err });
  }

  const success = errors.length === 0;
  if (!success) {
    logger.error('member_access_reactivation_incomplete', {
      membershipId: input.membershipId,
      authUserId: input.authUserId,
      organizationId: input.organizationId,
      errors,
    });
  }

  return {
    success,
    authMembershipReenabled,
    localStatusUpdated,
    errors,
  };
}
