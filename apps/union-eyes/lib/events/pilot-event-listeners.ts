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
// PR #752 round 12: this handler is now OBSERVABILITY-ONLY. Real
// enforcement (session revocation, authOrganizationUsers disable,
// case-access revocation, local status persistence) lives in
// lib/services/member-access-revocation-service.ts's revokeMemberAccess(),
// called SYNCHRONOUSLY and fail-closed from
// app/api/admin/users/[userId]/route.ts — the only caller that emits
// this event. An emitted event is not proof that security-critical side
// effects succeeded: this handler used to perform that enforcement itself,
// asynchronously, with every failure caught and swallowed (logged, but
// the emitting route always returned 200 regardless), and it was only
// ever registered as a side effect of importing this module from two
// unrelated routes (app/api/cases/intake/route.ts,
// app/api/workflow/transition/route.ts) — so it could silently never run
// at all depending on which routes had been loaded. Do not reintroduce
// security enforcement here; add it to revokeMemberAccess() instead so
// the caller can observe and fail on the result.
eventBus.on('member.status_changed', (event) => {
  const { userId, organizationId, oldStatus, newStatus } = event.data as {
    userId: string;
    organizationId: string;
    oldStatus?: string;
    newStatus: string;
  };

  logger.info('member_lifecycle:status_changed', {
    userId,
    organizationId,
    oldStatus,
    newStatus,
  });
});


