import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { grievanceCaseAccessAssignments } from '@/db/schema/domains/claims/grievance-lifecycle';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

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
 * PR #752 round 13: session revocation and the authOrganizationUsers
 * mutation now execute via @nzila/db/system-client's systemDb (a
 * dedicated SYSTEM_DATABASE_URL connection), not @nzila/db/client's
 * ordinary DATABASE_URL-bound db. A platform-admin offboarding an
 * arbitrary user in an arbitrary organization is a cross-user, cross-org
 * mutation against another user's durable auth membership/sessions — the
 * ordinary per-request runtime credential has no legitimate reason to
 * mutate another user's row, so this must run under the system
 * credential. @nzila/platform-auth/password's revokeAllUserSessions now
 * accepts an optional db-executor override for exactly this reason; do
 * not call it with the default ordinary client from a cross-user
 * platform-admin path.
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
    const { systemDb } = await import('@nzila/db/system-client');
    await revokeAllUserSessions(input.authUserId, systemDb);
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
    const { systemDb } = await import('@nzila/db/system-client');
    const { authOrganizationUsers } = await import('@nzila/db/schema');
    await systemDb
      .update(authOrganizationUsers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(authOrganizationUsers.userId, input.authUserId),
          eq(authOrganizationUsers.organizationId, input.organizationId),
        ),
      );
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

  // 3. Revoke active case-access assignments for the real auth user id.
  try {
    await withSystemContext(async (_tx) => {
      const active = await db
        .select({ id: grievanceCaseAccessAssignments.id })
        .from(grievanceCaseAccessAssignments)
        .where(
          and(
            eq(grievanceCaseAccessAssignments.userId, input.authUserId),
            eq(grievanceCaseAccessAssignments.organizationId, input.organizationId),
            eq(grievanceCaseAccessAssignments.status, 'active'),
          ),
        );
      for (const assignment of active) {
        await db
          .update(grievanceCaseAccessAssignments)
          .set({ status: 'revoked', updatedAt: new Date() })
          .where(eq(grievanceCaseAccessAssignments.id, assignment.id));
      }
      caseAccessRevokedCount = active.length;
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
    await withSystemContext(async (_tx) => {
      if (input.newLocalStatus === 'deleted') {
        await db
          .update(organizationMembers)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(organizationMembers.id, input.membershipId));
      } else {
        await db
          .update(organizationMembers)
          .set({ status: 'inactive', updatedAt: new Date() })
          .where(eq(organizationMembers.id, input.membershipId));
      }
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
 * Both writes now run inside a SINGLE systemDb transaction (one physical
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

  try {
    const { systemDb } = await import('@nzila/db/system-client');
    const { authOrganizationUsers } = await import('@nzila/db/schema');

    await systemDb.transaction(async (tx) => {
      const [authRow] = await tx
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

      const [localRow] = await tx
        .update(organizationMembers)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(organizationMembers.id, input.membershipId))
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
