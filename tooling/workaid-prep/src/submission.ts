import type { ClaimId, DecisionId, IssueId, MatterId, ObjectionId, SubmissionId, UserId } from './ids.ts';
import type { Decision } from './authorization.ts';
import type { Principal } from './principal.ts';
import { hasAnyRole, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';

/**
 * Outbound document lifecycle. "Sending is not receipt. Receipt is not
 * acceptance." Dispatch, provider acknowledgement and WSIB receipt are
 * separate states reachable only through separate, differently-authorized events.
 *
 * Mapping to the v0.1 spec names: DRAFT=PREPARED, APPROVED=APPROVED,
 * DISPATCHED=SENT_REPORTED, DELIVERY_ACK (optional), RECEIPT_CONFIRMED=RECEIVED_CONFIRMED,
 * REJECTED=DELIVERY_EXCEPTION. "RECEIPT_UNCONFIRMED" is derived: DISPATCHED or
 * DELIVERY_ACK without a receipt record.
 */
export type SubmissionKind = 'DOA' | 'WRF' | 'ITO' | 'ARF' | 'WRITTEN_SUBMISSION' | 'WSIAT_NOA' | 'WSIAT_FOLLOW_ON' | 'OTHER';

export type SubmissionState =
  | 'DRAFT'
  | 'REVIEWED'
  | 'APPROVED'
  | 'DISPATCHED'
  | 'DELIVERY_ACK'
  | 'RECEIPT_CONFIRMED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'SUPERSEDED';

export const SUBMISSION_STATES: readonly SubmissionState[] = [
  'DRAFT',
  'REVIEWED',
  'APPROVED',
  'DISPATCHED',
  'DELIVERY_ACK',
  'RECEIPT_CONFIRMED',
  'REJECTED',
  'WITHDRAWN',
  'SUPERSEDED',
];

/** The complete set of legal transitions. Anything not listed is forbidden. */
export const ALLOWED_SUBMISSION_TRANSITIONS: Readonly<Record<SubmissionState, readonly SubmissionState[]>> = {
  DRAFT: ['REVIEWED', 'WITHDRAWN'],
  REVIEWED: ['DRAFT', 'APPROVED', 'WITHDRAWN'],
  APPROVED: ['REVIEWED', 'DISPATCHED', 'WITHDRAWN'],
  DISPATCHED: ['DELIVERY_ACK', 'RECEIPT_CONFIRMED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED'],
  DELIVERY_ACK: ['RECEIPT_CONFIRMED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED'],
  RECEIPT_CONFIRMED: ['SUPERSEDED'],
  REJECTED: ['SUPERSEDED'],
  WITHDRAWN: [],
  SUPERSEDED: [],
};

export type ReceiptMethod = 'PHONE_CALL' | 'WSIB_PORTAL_CONFIRMATION' | 'WSIB_WRITTEN_CONFIRMATION' | 'WSIB_EMAIL_REPLY';
const RECEIPT_METHODS: readonly ReceiptMethod[] = ['PHONE_CALL', 'WSIB_PORTAL_CONFIRMATION', 'WSIB_WRITTEN_CONFIRMATION', 'WSIB_EMAIL_REPLY'];

export interface ReceiptRecord {
  readonly confirmedBy: UserId;
  readonly method: ReceiptMethod;
  /** Name/role of the WSIB contact, or a reference to evidence (portal id, letter). At least one. */
  readonly contactRef: string | null;
  readonly evidenceRef: string | null;
  /** When WSIB received it, as stated by the human; distinct from when it was recorded. */
  readonly receivedAt: string;
  readonly recordedAt: string;
}

export interface Submission {
  readonly id: SubmissionId;
  readonly matterId: MatterId;
  readonly kind: SubmissionKind;
  readonly version: number;
  readonly claimId: ClaimId | null;
  readonly decisionId: DecisionId | null;
  readonly objectionId: ObjectionId | null;
  readonly issueIds: readonly IssueId[];
  readonly preparedBy: UserId;
  readonly state: SubmissionState;
  readonly approval: { readonly approvedBy: UserId; readonly at: string } | null;
  readonly dispatch: { readonly requestId: string; readonly method: string; readonly dispatchedBy: UserId; readonly at: string } | null;
  readonly deliveryAck: { readonly channel: string; readonly providerRef: string; readonly at: string } | null;
  readonly receipt: ReceiptRecord | null;
  readonly history: readonly SubmissionHistoryEntry[];
}

export interface SubmissionHistoryEntry {
  readonly event: SubmissionEvent['type'];
  readonly actor: string;
  readonly at: string;
  readonly from: SubmissionState;
  readonly to: SubmissionState;
  readonly note?: string;
}

export type SubmissionError =
  | 'MISSING_LINKS'
  | 'ILLEGAL_TRANSITION'
  | 'NOT_PROFESSIONAL'
  | 'AUTHORITY_DENIED'
  | 'APPROVER_MISMATCH'
  | 'SEPARATE_APPROVER_REQUIRED'
  | 'GATE_NOT_SATISFIED'
  | 'SYSTEM_ACTOR_NOT_ALLOWED'
  | 'HUMAN_ACTOR_REQUIRED'
  | 'RECEIPT_EVIDENCE_REQUIRED'
  | 'INVALID_RECEIPT_METHOD'
  | 'DUPLICATE_DISPATCH_DIFFERENT_REQUEST'
  | 'REASON_REQUIRED';

export function createSubmission(input: {
  id: SubmissionId;
  matterId: MatterId;
  kind: SubmissionKind;
  version: number;
  claimId?: ClaimId | null;
  decisionId?: DecisionId | null;
  objectionId?: ObjectionId | null;
  issueIds?: readonly IssueId[];
  preparedBy: UserId;
}): Result<Submission, SubmissionError> {
  const claimId = input.claimId ?? null;
  const decisionId = input.decisionId ?? null;
  const objectionId = input.objectionId ?? null;
  const issueIds = input.issueIds ?? [];
  const needsClaim: SubmissionKind[] = ['WRF', 'ITO', 'ARF', 'WRITTEN_SUBMISSION'];
  if (needsClaim.includes(input.kind) && !claimId) return err('MISSING_LINKS', `${input.kind} must name the claim it belongs to`);
  const needsObjection: SubmissionKind[] = ['ITO', 'ARF', 'WRITTEN_SUBMISSION'];
  if (needsObjection.includes(input.kind) && (!decisionId || !objectionId || issueIds.length === 0)) {
    return err('MISSING_LINKS', `${input.kind} must link decision, objection and disputed issues`);
  }
  if (input.version < 1) return err('MISSING_LINKS', 'version must be >= 1');
  return ok({
    id: input.id,
    matterId: input.matterId,
    kind: input.kind,
    version: input.version,
    claimId,
    decisionId,
    objectionId,
    issueIds,
    preparedBy: input.preparedBy,
    state: 'DRAFT',
    approval: null,
    dispatch: null,
    deliveryAck: null,
    receipt: null,
    history: [],
  });
}

export type SubmissionEvent =
  | { readonly type: 'REVIEW' }
  | { readonly type: 'REQUEST_REWORK' }
  /** claimedApprover is whatever the request body asserted; it must equal the authenticated principal. */
  | { readonly type: 'APPROVE'; readonly claimedApprover: string }
  | { readonly type: 'INVALIDATE_APPROVAL'; readonly reason: string }
  | { readonly type: 'DISPATCH'; readonly requestId: string; readonly method: string }
  | { readonly type: 'ACK_DELIVERY'; readonly channel: string; readonly providerRef: string }
  | {
      readonly type: 'CONFIRM_RECEIPT';
      readonly method: string;
      readonly contactRef?: string;
      readonly evidenceRef?: string;
      readonly receivedAt: string;
    }
  | { readonly type: 'REJECT'; readonly reason: string }
  | { readonly type: 'WITHDRAW'; readonly reason: string }
  | { readonly type: 'SUPERSEDE'; readonly reason: string };

export type Actor =
  | { readonly kind: 'USER'; readonly principal: Principal }
  | { readonly kind: 'SYSTEM'; readonly component: 'DISPATCH_PROVIDER' | 'AUTHORITY_CASCADE' };

export interface SubmissionContext {
  readonly actor: Actor;
  readonly now: string;
  /** Result of authorizeProfessionalAction for this principal and matter, computed by the caller. */
  readonly professionalAuth?: Decision;
  /** For DISPATCH: result of authorizeProfessionalAction('WSIB_REPRESENTATIVE_ACTION'). */
  readonly representativeAuth?: Decision;
  readonly policy: {
    readonly approvalRoles: readonly ('WORKAID_SPECIALIST' | 'WORKAID_PRINCIPAL')[];
    /** Open decision: whether the approver must differ from the preparer. */
    readonly approverMustDifferFromPreparer: boolean;
  };
  readonly gates?: { readonly arfReady?: boolean; readonly noaReady?: boolean };
}

const HUMAN_ONLY: readonly SubmissionEvent['type'][] = ['REVIEW', 'REQUEST_REWORK', 'APPROVE', 'DISPATCH', 'CONFIRM_RECEIPT', 'REJECT', 'WITHDRAW', 'SUPERSEDE'];

export function applySubmissionEvent(sub: Submission, event: SubmissionEvent, ctx: SubmissionContext): Result<Submission, SubmissionError> {
  const from = sub.state;
  const actorLabel = ctx.actor.kind === 'USER' ? ctx.actor.principal.userId : `system:${ctx.actor.component}`;
  const to = (s: SubmissionState, patch: Partial<Submission> = {}, note?: string): Result<Submission, SubmissionError> => {
    if (!ALLOWED_SUBMISSION_TRANSITIONS[from].includes(s)) return err('ILLEGAL_TRANSITION', `${from} -> ${s} is forbidden`);
    return ok({
      ...sub,
      ...patch,
      state: s,
      history: [...sub.history, { event: event.type, actor: actorLabel, at: ctx.now, from, to: s, ...(note ? { note } : {}) }],
    });
  };

  // Provider acknowledgement is the only event a system actor may produce for receipt-adjacent state.
  if (event.type === 'ACK_DELIVERY') {
    if (ctx.actor.kind !== 'SYSTEM' || ctx.actor.component !== 'DISPATCH_PROVIDER') {
      return err('SYSTEM_ACTOR_NOT_ALLOWED', 'only the dispatch provider may record a delivery acknowledgement');
    }
    if (from === 'DELIVERY_ACK') return ok(sub, false);
    return to('DELIVERY_ACK', { deliveryAck: { channel: event.channel, providerRef: event.providerRef, at: ctx.now } });
  }
  if (event.type === 'INVALIDATE_APPROVAL') {
    if (ctx.actor.kind === 'SYSTEM' && ctx.actor.component !== 'AUTHORITY_CASCADE') return err('SYSTEM_ACTOR_NOT_ALLOWED', 'unrecognized system actor');
    return to('REVIEWED', { approval: null }, event.reason);
  }
  if (HUMAN_ONLY.includes(event.type) && ctx.actor.kind !== 'USER') {
    return err('HUMAN_ACTOR_REQUIRED', `${event.type} requires an authenticated human actor`);
  }
  const principal = (ctx.actor as { principal: Principal }).principal;
  if (!hasAnyRole(principal, WORKAID_ROLES)) return err('NOT_PROFESSIONAL', 'only WorkAid professionals may act on outbound submissions');

  switch (event.type) {
    case 'REVIEW':
      return to('REVIEWED');
    case 'REQUEST_REWORK':
      return to('DRAFT');
    case 'APPROVE': {
      if (event.claimedApprover !== principal.userId) return err('APPROVER_MISMATCH', 'asserted approver does not match the authenticated principal');
      if (!principal.roles.some((r) => ctx.policy.approvalRoles.includes(r as 'WORKAID_SPECIALIST' | 'WORKAID_PRINCIPAL'))) {
        return err('NOT_PROFESSIONAL', 'role may not approve submissions');
      }
      if (!ctx.professionalAuth?.allow) return err('AUTHORITY_DENIED', 'professional action not authorized for this matter');
      if (ctx.policy.approverMustDifferFromPreparer && principal.userId === sub.preparedBy) {
        return err('SEPARATE_APPROVER_REQUIRED', 'approver must differ from preparer under current policy');
      }
      if (sub.kind === 'ARF' && !ctx.gates?.arfReady) return err('GATE_NOT_SATISFIED', 'ARF readiness not attested');
      if (sub.kind === 'WSIAT_NOA' && !ctx.gates?.noaReady) return err('GATE_NOT_SATISFIED', 'NOA readiness not attested');
      return to('APPROVED', { approval: { approvedBy: principal.userId, at: ctx.now } });
    }
    case 'DISPATCH': {
      if (sub.dispatch && ['DISPATCHED', 'DELIVERY_ACK', 'RECEIPT_CONFIRMED'].includes(from)) {
        return sub.dispatch.requestId === event.requestId
          ? ok(sub, false)
          : err('DUPLICATE_DISPATCH_DIFFERENT_REQUEST', 'already dispatched under another request; a second send is a new version');
      }
      if (sub.kind !== 'DOA' && !ctx.representativeAuth?.allow) return err('AUTHORITY_DENIED', 'no live authority to act as WSIB representative');
      if (!ctx.professionalAuth?.allow) return err('AUTHORITY_DENIED', 'professional action not authorized for this matter');
      return to('DISPATCHED', { dispatch: { requestId: event.requestId, method: event.method, dispatchedBy: principal.userId, at: ctx.now } });
    }
    case 'CONFIRM_RECEIPT': {
      if (!RECEIPT_METHODS.includes(event.method as ReceiptMethod)) return err('INVALID_RECEIPT_METHOD', 'receipt must be confirmed by a recognized human method');
      if (!event.contactRef?.trim() && !event.evidenceRef?.trim()) return err('RECEIPT_EVIDENCE_REQUIRED', 'record the WSIB contact or an evidence reference');
      if (!ctx.professionalAuth?.allow) return err('AUTHORITY_DENIED', 'professional action not authorized for this matter');
      return to('RECEIPT_CONFIRMED', {
        receipt: {
          confirmedBy: principal.userId,
          method: event.method as ReceiptMethod,
          contactRef: event.contactRef?.trim() || null,
          evidenceRef: event.evidenceRef?.trim() || null,
          receivedAt: event.receivedAt,
          recordedAt: ctx.now,
        },
      });
    }
    case 'REJECT':
    case 'WITHDRAW':
    case 'SUPERSEDE':
      if (event.reason.trim().length < 5) return err('REASON_REQUIRED', 'reason required');
      return to(event.type === 'REJECT' ? 'REJECTED' : event.type === 'WITHDRAW' ? 'WITHDRAWN' : 'SUPERSEDED', {}, event.reason);
  }
}

/** True once the document has left the sender and no human has confirmed WSIB receipt. */
export function isReceiptUnconfirmed(sub: Submission): boolean {
  return (sub.state === 'DISPATCHED' || sub.state === 'DELIVERY_ACK') && sub.receipt === null;
}

export function submissionCountsAsFiled(sub: Submission): boolean {
  return sub.state === 'RECEIPT_CONFIRMED' && sub.receipt !== null;
}
