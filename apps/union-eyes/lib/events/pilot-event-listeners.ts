/**
 * Pilot Event Listeners
 *
 * Subscribes to the event bus and logs structured observability events
 * for pilot monitoring: first_case_created, case_created, first_update_added.
 *
 * Import this module for side-effect registration:
 *   import '@/lib/events/pilot-event-listeners';
 */

import { eventBus, AppEvents } from './event-bus';
import { logger } from '@/lib/logger';

// ── Case Created ──────────────────────────────────────────────
eventBus.on(AppEvents.CLAIM_CREATED, (event) => {
  const { claimId, organizationId, createdBy, type, isFirst } = event.data as {
    claimId: string;
    organizationId: string;
    createdBy: string;
    type: string;
    isFirst?: boolean;
  };

  logger.info('pilot_event:case_created', {
    claimId,
    organizationId,
    userId: createdBy,
    caseType: type,
  });

  if (isFirst) {
    logger.info('pilot_event:first_case_created', {
      claimId,
      organizationId,
      userId: createdBy,
      caseType: type,
    });
  }
});

// ── Case Updated ──────────────────────────────────────────────
eventBus.on(AppEvents.CLAIM_UPDATED, (event) => {
  const { claimId, organizationId, updatedBy, newStatus, isFirstUpdate } = event.data as {
    claimId: string;
    organizationId: string;
    updatedBy: string;
    newStatus: string;
    isFirstUpdate?: boolean;
  };

  logger.info('pilot_event:case_updated', {
    claimId,
    organizationId,
    userId: updatedBy,
    newStatus,
  });

  if (isFirstUpdate) {
    logger.info('pilot_event:first_update_added', {
      claimId,
      organizationId,
      userId: updatedBy,
      newStatus,
    });
  }
});

// ── Session Started (user login) ──────────────────────────────
eventBus.on(AppEvents.USER_LOGGED_IN, (event) => {
  const { userId, organizationId } = event.data as {
    userId: string;
    organizationId?: string;
  };

  logger.info('pilot_event:session_started', {
    userId,
    organizationId,
  });
});

// ── Member Status Changed (Phase 2 Domain 5) ──────────────────
// Event-driven enforcement: when a member becomes inactive/offboarded,
// revoke all their sessions and case access (fail-fast on any errors
// but continue processing to maximize access-denial coverage)
eventBus.on('member.status_changed', async (event) => {
  const { userId, organizationId, oldStatus, newStatus } = event.data as {
    userId: string;
    organizationId: string;
    oldStatus?: string;
    newStatus: string;
  };

  // Only enforce access revocation for status changes away from 'active'
  if (newStatus === 'active' || oldStatus === newStatus) {
    return;
  }

  logger.info('member_lifecycle:status_changed', {
    userId,
    organizationId,
    oldStatus,
    newStatus,
  });

  // Phase 2 Domain 5: Enforce access revocation when member becomes inactive
  // This handler runs async; errors are logged but do not block the event
  try {
    // Revoke all sessions for this user (fail-fast, but continue on error)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { revokeAllUserSessions } = await import('@nzila/platform-auth/password');
      await revokeAllUserSessions(userId);
      logger.info('member_lifecycle:sessions_revoked', { userId });
    } catch (sessionError) {
      logger.error('member_lifecycle:session_revocation_failed', {
        userId,
        error: sessionError,
      });
      // Continue with case access revocation even if session revocation fails
    }

    // Revoke all case access assignments (fail-fast, but continue on error)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { db } = await import('@/db/db');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { grievanceCaseAccessAssignments } = await import('@/db/schema/domains/claims/grievance-lifecycle');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { eq, and } = await import('drizzle-orm');

      const accessAssignments = await db
        .select()
        .from(grievanceCaseAccessAssignments)
        .where(
          and(
            eq(grievanceCaseAccessAssignments.userId, userId),
            eq(grievanceCaseAccessAssignments.organizationId, organizationId),
            eq(grievanceCaseAccessAssignments.status, 'active'),
          ),
        );

      for (const assignment of accessAssignments) {
        await db
          .update(grievanceCaseAccessAssignments)
          .set({
            status: 'revoked',
            updatedAt: new Date(),
          })
          .where(eq(grievanceCaseAccessAssignments.id, assignment.id));
      }

      logger.info('member_lifecycle:case_access_revoked', {
        userId,
        organizationId,
        count: accessAssignments.length,
      });
    } catch (accessError) {
      logger.error('member_lifecycle:case_access_revocation_failed', {
        userId,
        organizationId,
        error: accessError,
      });
    }
  } catch (error) {
    logger.error('member_lifecycle:unexpected_error', {
      userId,
      error,
    });
  }
});

