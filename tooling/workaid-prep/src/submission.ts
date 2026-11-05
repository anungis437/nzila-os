import type { ClaimId, DecisionId, IssueId, MatterId, ObjectionId, SubmissionId, UserId } from './ids.ts';
import type { Decision } from './authorization.ts';
import type { Principal } from './principal.ts';
import { hasAnyRole, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';

/**
 * Outbound document lifecycle. "Sending is not receipt. Receipt is not
 * acceptance. Receipt is not a valid filing."
 *
 * Every stage is a separate, differently-authorized fact:
 *   created (DRAFT) -> professionally reviewed -> professionally approved
 *   -> dispatch ATTEMPTED (a human or provider tried to send)
 *   -> dispatch CONFIRMED (DISPATCHED: a transmission reference exists)
 *   -> provider delivery acknowledgement (DELIVERY_ACK, system only, optional)
 *   -> receipt documented (RECEIPT_CONFIRMED: a human obtained confirmation from the authority)
 * Whether the submission was a VALID FILING, and whether the authority accepted
 * or rejected it, are NOT states of this machine; see filing.ts.
 */
export type SubmissionKind = 'DOA' | 'WRF' | 'ITO' | 'ARF' | 'WRITTEN_SUBMISSION' | 'WSIAT_NOA' | 'WSIAT_FOLLOW_ON' | 'OTHER';
export type RecipientAuthority = 'WSIB' | 'WSIAT' | 'OTHER';

export const DEFAULT_RECIPIENT: Readonly<Record<SubmissionKind, RecipientAuthority>> = {
  DOA: 'WSIB',
  WRF: 'WSIB',
  ITO: 'WSIB',
  ARF: 'WSIB',
  WRITTEN_SUBMISSION: 'WSIB',
  WSIAT_NOA: 'WSIAT',
  WSIAT_FOLLOW_ON: 'WSIAT',
  OTHER: 'OTHER',
};

export type SubmissionState =
  | 'DRAFT'
  | 'REVIEWED'
  | 'APPROVED'
  | 'DISPATCH_ATTEMPTED'
  | 'DISPATCH_FAILED'
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
  'DISPATCH_ATTEMPTED',
  'DISPATCH_FAILED',
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
  APPROVED: ['REVIEWED', 'DISPATCH_ATTEMPTED', 'WITHDRAWN'],
  DISPATCH_ATTEMPTED: ['DISPATCHED', 'DISPATCH_FAILED', 'WITHDRAWN'],
  DISPATCH_FAILED: ['DISPATCH_ATTEMPTED', 'WITHDRAWN', 'SUPERSEDED'],
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
  /** Name/role of the authority contact, or a reference to evidence (portal id, letter). At least one. */
  readonly contactRef: string | null;
  readonly evidenceRef: string | null;
  /** When the authority received it, as stated by the human; distinct from when it was recorded. */
  readonly receivedAt: string;
  readonly recordedAt: string;
}

export interface Submission {
  readonly id: SubmissionId;
  readonly matterId: MatterId;
  readonly kind: SubmissionKind;
  readonly version: number;
  /** Authority the document is addressed to. A mismatch with the kind is a malformed submission. */
  readonly recipient: RecipientAuthority;
  readonly claimId: ClaimId | null;
  readonly decisionId: DecisionId | null;
  readonly objectionId: ObjectionId | null;
  readonly issueIds: readonly IssueId[];
  readonly preparedBy: UserId;
  readonly state: SubmissionState;
  readonly approval: { readonly approvedBy: UserId; readonly at: string } | null;
  /** The latest attempt to send. Exists from DISPATCH_ATTEMPTED onward. */
  readonly attempt: { readonly requestId: string; readonly method: string; readonly by: string; readonly at: string } | null;
  /** Confirmed dispatch: a transmission reference exists. Exists from DISPATCHED onward. */
  readonly dispatch: { readonly requestId: string; readonly method: string; readonly dispatchedBy: string; readonly at: string; readonly transmissionRef: string } | null;
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
  | 'RECIPIENT_MISMATCH'
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
  | 'DISPATCH_REQUEST_MISMATCH'
  | 'TRANSMISSION_REF_REQUIRED'
  | 'REASON_REQUIRED';

export function createSubmission(input: {
  id: SubmissionId;
  matterId: MatterId;
  kind: SubmissionKind;
  version: number;
  recipient?: RecipientAuthority;
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
  const recipient = input.recipient ?? DEFAULT_RECIPIENT[input.kind];
  const needsClaim: SubmissionKind[] = ['WRF', 'ITO', 'ARF', 'WRITTEN_SUBMISSION'];
  if (needsClaim.includes(input.kind) && !claimId) return err('MISSING_LINKS', `${input.kind} must name the claim it belongs to`);
  const needsObjection: SubmissionKind[] = ['ITO', 'ARF', 'WRITTEN_SUBMISSION'];
  if (needsObjection.includes(input.kind) && (!decisionId || !objectionId || issueIds.length === 0)) {
    return err('MISSING_LINKS', `${input.kind} must link decision, objection and disputed issues`);
  }
  if (input.version < 1) return err('MISSING_LINKS', 'version must be >= 1');
  if (input.kind !== 'OTHER' && recipient !== DEFAULT_RECIPIENT[input.kind]) {
    return err('RECIPIENT_MISMATCH', `${input.kind} is not addressed to ${recipient}`);
  }
  return ok({
    id: input.id,
    matterId: input.matterId,
    kind: input.kind,
    version: input.version,
    recipient,
    claimId,
    decisionId,
    objectionId,
    issueIds,
    preparedBy: input.preparedBy,
    state: 'DRAFT',
    approval: null,
    attempt: null,
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
  | { readonly type: 'ATTEMPT_DISPATCH'; readonly requestId: string; readonly method: string }
  | { readonly type: 'CONFIRM_DISPATCH'; readonly requestId: string; readonly transmissionRef: string }
  | { readonly type: 'FAIL_DISPATCH'; readonly requestId: string; readonly reason: string }
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
  /** For dispatch attempts: result of authorizeProfessionalAction('WSIB_REPRESENTATIVE_ACTION'). */
  readonly representativeAuth?: Decision;
  readonly policy: {
    readonly approvalRoles: readonly ('WORKAID_SPECIALIST' | 'WORKAID_PRINCIPAL')[];
    /** Open decision: whether the approver must differ from the preparer. */
    readonly approverMustDifferFromPreparer: boolean;
  };
  readonly gates?: { readonly arfReady?: boolean; readonly noaReady?: boolean };
}

const SENT_STATES: readonly SubmissionState[] = ['DISPATCHED', 'DELIVERY_ACK', 'RECEIPT_CONFIRMED'];

type Mover = (s: SubmissionState, patch?: Partial<Submission>, note?: string) => Result<Submission, SubmissionError>;

export function applySubmissionEvent(sub: Submission, event: SubmissionEvent, ctx: SubmissionContext): Result<Submission, SubmissionError> {
  const from = sub.state;
  const actorLabel = ctx.actor.kind === 'USER' ? ctx.actor.principal.userId : `system:${ctx.actor.component}`;
  const to: Mover = (s, patch = {}, note) => {
    if (!ALLOWED_SUBMISSION_TRANSITIONS[from].includes(s)) return err('ILLEGAL_TRANSITION', `${from} -> ${s} is forbidden`);
    return ok({
      ...sub,
      ...patch,
      state: s,
      history: [...sub.history, { event: event.type, actor: actorLabel, at: ctx.now, from, to: s, ...(note ? { note } : {}) }],
    });
  };

  // ---- system actors -------------------------------------------------
  if (ctx.actor.kind === 'SYSTEM') {
    const provider = ctx.actor.component === 'DISPATCH_PROVIDER';
    if (event.type === 'ACK_DELIVERY') {
      if (!provider) return err('SYSTEM_ACTOR_NOT_ALLOWED', 'only the dispatch provider may record a delivery acknowledgement');
      if (from === 'DELIVERY_ACK') return ok(sub, false);
      return to('DELIVERY_ACK', { deliveryAck: { channel: event.channel, providerRef: event.providerRef, at: ctx.now } });
    }
    if (event.type === 'CONFIRM_DISPATCH' || event.type === 'FAIL_DISPATCH') {
      if (!provider) return err('SYSTEM_ACTOR_NOT_ALLOWED', 'only the dispatch provider may report transmission outcomes');
      return transmissionOutcome(sub, event, actorLabel, ctx.now, to);
    }
    if (event.type === 'INVALIDATE_APPROVAL') {
      if (ctx.actor.component !== 'AUTHORITY_CASCADE') return err('SYSTEM_ACTOR_NOT_ALLOWED', 'unrecognized system actor');
      return to('REVIEWED', { approval: null }, event.reason);
    }
    return err('HUMAN_ACTOR_REQUIRED', `${event.type} requires an authenticated human actor`);
  }

  // ---- human actors --------------------------------------------------
  const principal = ctx.actor.principal;
  if (event.type === 'ACK_DELIVERY') return err('SYSTEM_ACTOR_NOT_ALLOWED', 'only the dispatch provider may record a delivery acknowledgement');
  if (!hasAnyRole(principal, WORKAID_ROLES)) return err('NOT_PROFESSIONAL', 'only WorkAid professionals may act on outbound submissions');

  switch (event.type) {
    case 'REVIEW':
      return to('REVIEWED');
    case 'REQUEST_REWORK':
      return to('DRAFT');
    case 'INVALIDATE_APPROVAL':
      return to('REVIEWED', { approval: null }, event.reason);
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
    case 'ATTEMPT_DISPATCH': {
      if (sub.attempt && sub.attempt.requestId === event.requestId && (from === 'DISPATCH_ATTEMPTED' || SENT_STATES.includes(from))) return ok(sub, false);
      if (from === 'DISPATCH_ATTEMPTED' || SENT_STATES.includes(from)) {
        return err('DUPLICATE_DISPATCH_DIFFERENT_REQUEST', 'already attempted or dispatched under another request; a second send is a new version');
      }
      if (sub.kind !== 'DOA' && !ctx.representativeAuth?.allow) return err('AUTHORITY_DENIED', 'no live authority to act as WSIB representative');
      if (!ctx.professionalAuth?.allow) return err('AUTHORITY_DENIED', 'professional action not authorized for this matter');
      return to('DISPATCH_ATTEMPTED', { attempt: { requestId: event.requestId, method: event.method, by: principal.userId, at: ctx.now } });
    }
    case 'CONFIRM_DISPATCH':
    case 'FAIL_DISPATCH':
      if (!ctx.professionalAuth?.allow) return err('AUTHORITY_DENIED', 'professional action not authorized for this matter');
      return transmissionOutcome(sub, event, actorLabel, ctx.now, to);
    case 'CONFIRM_RECEIPT': {
      if (!RECEIPT_METHODS.includes(event.method as ReceiptMethod)) return err('INVALID_RECEIPT_METHOD', 'receipt must be confirmed by a recognized human method');
      if (!event.contactRef?.trim() && !event.evidenceRef?.trim()) return err('RECEIPT_EVIDENCE_REQUIRED', 'record the authority contact or an evidence reference');
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

function transmissionOutcome(
  sub: Submission,
  event: Extract<SubmissionEvent, { type: 'CONFIRM_DISPATCH' | 'FAIL_DISPATCH' }>,
  actorLabel: string,
  now: string,
  to: Mover,
): Result<Submission, SubmissionError> {
  if (event.type === 'CONFIRM_DISPATCH') {
    if (sub.dispatch && sub.dispatch.requestId === event.requestId && SENT_STATES.includes(sub.state)) return ok(sub, false);
    if (!sub.attempt || sub.attempt.requestId !== event.requestId) return err('DISPATCH_REQUEST_MISMATCH', 'no attempt with this request id');
    if (!event.transmissionRef.trim()) return err('TRANSMISSION_REF_REQUIRED', 'confirmed dispatch needs a transmission reference');
    return to('DISPATCHED', { dispatch: { requestId: event.requestId, method: sub.attempt.method, dispatchedBy: actorLabel, at: now, transmissionRef: event.transmissionRef.trim() } });
  }
  if (!sub.attempt || sub.attempt.requestId !== event.requestId) return err('DISPATCH_REQUEST_MISMATCH', 'no attempt with this request id');
  if (event.reason.trim().length < 3) return err('REASON_REQUIRED', 'reason required');
  return to('DISPATCH_FAILED', {}, event.reason);
}

/** True once the document was confirmed sent and no human has confirmed receipt. */
export function isReceiptUnconfirmed(sub: Submission): boolean {
  return (sub.state === 'DISPATCHED' || sub.state === 'DELIVERY_ACK') && sub.receipt === null;
}

/**
 * Receipt is DOCUMENTED, nothing more. This is deliberately not named "filed":
 * a receipt record neither asserts that the submission met any legal filing
 * requirement nor that it was on time. See filing.ts.
 */
export function receiptDocumented(sub: Submission): boolean {
  return sub.state === 'RECEIPT_CONFIRMED' && sub.receipt !== null;
}

export function dispatchConfirmed(sub: Submission): boolean {
  return SENT_STATES.includes(sub.state) && sub.dispatch !== null;
}
