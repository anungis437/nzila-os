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
