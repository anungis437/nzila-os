import type { OrganizationId } from './ids.ts';
import type { TaskOfRecord } from './followup.ts';

/**
 * Option B (split responsibility) - PROVISIONAL. Clio is the professional file
 * of record; Union Eyes coordinates referrals, controlled publication and, only
 * if Domenic accepts a single queue, receipt follow-up. There is no connector and
 * no automatic writeback. Nothing here talks to Clio.
 */
export const ARCHITECTURE = {
  option: 'B',
  status: 'PROVISIONAL',
  fallback: "A'",
  deferred: 'C',
  clioConnector: false,
  automaticWriteback: false,
  integrationMode: 'MANUAL_COORDINATION',
  /** Resolved only by Domenic's validation (decision D-02). */
  taskOfRecord: 'UNRESOLVED' as TaskOfRecord,
} as const;

const FORBIDDEN_CLAIMS: readonly RegExp[] = [
  /clio[-\s]integrated/i,
  /integrated with clio/i,
  /(syncs?|synced|synchroni[sz]es?|synchroni[sz]ed)\s+(automatically\s+)?(with|to)\s+clio/i,
  /clio\s+(auto[-\s]?)?sync/i,
  /automatic(ally)?\s+(updates?|writes?|writeback)\s+(to\s+)?clio/i,
];

/** Fail-closed copy check (WA-T054, WA-T096): no text may imply a Clio integration that does not exist. */
export function findClioIntegrationClaims(text: string): string[] {
  return FORBIDDEN_CLAIMS.filter((r) => r.test(text)).map((r) => r.source);
}

export type CoordinationTaskStatus = 'OPEN' | 'SNOOZED_WITH_REASON' | 'IN_PROGRESS' | 'RECEIPT_CONFIRMED' | 'EXCEPTION_ESCALATED' | 'CANCELLED';

export interface TaskSnapshot {
  readonly submissionKey: string;
  readonly status: CoordinationTaskStatus;
}

export type ReconciliationOutcome =
  | { readonly outcome: 'IN_SYNC'; readonly writeback: false }
  | { readonly outcome: 'RECONCILIATION_EXCEPTION'; readonly writeback: false; readonly reason: string };

/**
 * Two systems disagree about one receipt task. The contract never picks a winner
 * silently, never writes back, and never treats an external "done" as receipt evidence.
 */
export function reconcileTaskStates(ue: TaskSnapshot | null, external: TaskSnapshot | null, sor: TaskOfRecord): ReconciliationOutcome {
  if (ue && external && ue.submissionKey !== external.submissionKey) {
    return { outcome: 'RECONCILIATION_EXCEPTION', writeback: false, reason: 'tasks refer to different submissions' };
  }
  if (ue && external) {
    const bothOpen = !['RECEIPT_CONFIRMED', 'CANCELLED'].includes(ue.status) && !['RECEIPT_CONFIRMED', 'CANCELLED'].includes(external.status);
    if (bothOpen) return { outcome: 'RECONCILIATION_EXCEPTION', writeback: false, reason: 'two active receipt tasks exist for one submission; only one task-of-record is allowed' };
    if (ue.status === external.status) return { outcome: 'IN_SYNC', writeback: false };
    if (external.status === 'RECEIPT_CONFIRMED' && ue.status !== 'RECEIPT_CONFIRMED') {
      return { outcome: 'RECONCILIATION_EXCEPTION', writeback: false, reason: 'external completion is not WSIB receipt evidence; a human must record receipt' };
    }
    return { outcome: 'RECONCILIATION_EXCEPTION', writeback: false, reason: `states differ (${ue.status} vs ${external.status}); sor=${sor}` };
  }
  if (sor === 'UNRESOLVED' && (ue || external)) {
    return { outcome: 'RECONCILIATION_EXCEPTION', writeback: false, reason: 'task-of-record is unresolved' };
  }
  return { outcome: 'IN_SYNC', writeback: false };
}

/* Future-event admissibility: documented contract only; no connector exists. */
export const PERMITTED_EVENT_TYPES = ['REFERRAL_ACCEPTED', 'SUBMISSION_DISPATCHED', 'RECEIPT_CONFIRMED', 'ACCESS_REVOKED'] as const;
export const PERMITTED_EVENT_FIELDS = ['eventId', 'type', 'organizationId', 'opaqueMatterRef', 'opaqueSubmissionRef', 'occurredAt'] as const;

export interface IntegrationEvent {
  readonly eventId: string;
  readonly type: string;
  readonly organizationId: OrganizationId;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export type Admissibility = { readonly admit: true } | { readonly admit: false; readonly reason: 'REPLAY' | 'WRONG_TENANT' | 'TYPE_NOT_PERMITTED' | 'FIELD_NOT_PERMITTED' | 'STALE' };

export function checkEventAdmissibility(input: {
  event: IntegrationEvent;
  mappedOrganizationId: OrganizationId;
  seenEventIds: ReadonlySet<string>;
  nowMs: number;
  maxAgeMs: number;
}): Admissibility {
  const { event } = input;
  if (input.seenEventIds.has(event.eventId)) return { admit: false, reason: 'REPLAY' };
  if (event.organizationId !== input.mappedOrganizationId) return { admit: false, reason: 'WRONG_TENANT' };
  if (!(PERMITTED_EVENT_TYPES as readonly string[]).includes(event.type)) return { admit: false, reason: 'TYPE_NOT_PERMITTED' };
  if (input.nowMs - Date.parse(event.occurredAt) > input.maxAgeMs) return { admit: false, reason: 'STALE' };
  if (Object.keys(event.payload).some((k) => !(PERMITTED_EVENT_FIELDS as readonly string[]).includes(k))) return { admit: false, reason: 'FIELD_NOT_PERMITTED' };
  return { admit: true };
}
