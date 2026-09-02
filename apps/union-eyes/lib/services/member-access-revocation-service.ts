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
 */
export async function revokeMemberAccess(input: RevokeMemberAccessInput): Promise<RevokeMemberAccessResult> {
  const errors: string[] = [];
  let sessionsRevoked = false;
  let authMembershipDisabled = false;
  let caseAccessRevokedCount = 0;
  let localStatusUpdated = false;

  // 1. Revoke all active sessions for the REAL auth user id.
  try {
    const { revokeAllUserSessions } = await import('@nzila/platform-auth/password');
    await revokeAllUserSessions(input.authUserId);
    sessionsRevoked = true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`session_revocation_failed: ${message}`);
    logger.error('session_revocation_failed', { authUserId: input.authUserId, error: err });
  }

  // 2. Disable the durable platform-auth organization membership — the
  // canonical role resolver checks authOrganizationUsers BEFORE falling
  // back to organizationMembers, so leaving it active would let the user
  // re-establish authorized access even after sessions are revoked.
  try {
    const { db: authDb } = await import('@nzila/db/client');
    const { authOrganizationUsers } = await import('@nzila/db/schema');
    await authDb
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
