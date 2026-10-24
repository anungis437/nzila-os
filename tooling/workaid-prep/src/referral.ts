import type { DecisionId, DocumentId, MemberId, OrganizationId, ReferralId, UserId } from './ids.ts';
import type { Principal, Role } from './principal.ts';
import { hasAnyRole, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';

/* ------------------------------------------------------------------ *
 * Packet completeness (document checklist only)
 * ------------------------------------------------------------------ */

export type FormCode =
  | 'CLIENT_INTAKE_FORM'
  | 'MEDICAL_AUTHORIZATION'
  | 'RETAINER_AGREEMENT'
  | 'SHARE_INFORMATION_RELEASE'
  | 'GOVERNMENT_PHOTO_ID';

/** Intake requirements version 1: the four WorkAid forms plus photo ID. */
export const REQUIRED_FORMS_V1: readonly FormCode[] = [
  'CLIENT_INTAKE_FORM',
  'MEDICAL_AUTHORIZATION',
  'RETAINER_AGREEMENT',
  'SHARE_INFORMATION_RELEASE',
  'GOVERNMENT_PHOTO_ID',
];

export type ItemStatus = 'PROVIDED' | 'UNREADABLE' | 'UNSIGNED' | 'WRONG_CLAIM' | 'DUPLICATE';

export interface PacketItem {
  readonly code: FormCode;
  readonly documentId: DocumentId | null;
  readonly status: ItemStatus;
}

export interface PacketDecisionRef {
  readonly decisionId: DecisionId;
  readonly outcome: 'DENIED' | 'ALLOWED' | 'PARTIAL' | 'OTHER';
  readonly letterDocumentId: DocumentId | null;
}

export interface ReferralPacket {
  readonly declaredClaimCount: number;
  /** Whether the union asserts that current AND historical claim numbers are all listed. */
  readonly claimHistory: 'ALL_DECLARED' | 'NOT_DECLARED';
  readonly wsibCorrespondence: 'PROVIDED' | 'NONE_EXISTS_DECLARED' | 'MISSING';
  readonly items: readonly PacketItem[];
  readonly decisions: readonly PacketDecisionRef[];
}

export interface MissingItem {
  readonly code: string;
  readonly reason: 'ABSENT' | ItemStatus | 'NOT_DECLARED';
  readonly nextActionOwner: 'UNION_REFERRAL_REP' | 'MEMBER';
  readonly decisionId?: DecisionId;
}

export type ChecklistState = 'AWAITING_REQUIRED_ITEMS' | 'DOCUMENT_COMPLETE_FOR_REVIEW';

export interface PolicyDecisionsPending {
  /** D-04: which deficiencies may be waived for urgent professional review. Must be supplied explicitly. */
  readonly waivableItems: readonly string[];
  /** D-04/D-06: roles that may grant an urgent exception. */
  readonly urgentExceptionRoles: readonly Role[];
  /** Open question: who formally accepts representation. */
  readonly acceptanceRoles: readonly Role[];
}

export interface UrgentException {
  readonly grantedBy: UserId;
  readonly reason: string;
  readonly waivedItems: readonly string[];
  /** Reference to why time matters, e.g. an objection date needing review. */
  readonly urgencyBasis: string;
}

export interface PacketEvaluation {
  readonly checklistState: ChecklistState;
  readonly missing: readonly MissingItem[];
  /** Always NOT_ASSESSED: a checklist can never certify professional or legal sufficiency. */
  readonly professionalSufficiency: 'NOT_ASSESSED';
  readonly reviewRoute: 'STANDARD_REVIEW' | 'EXPEDITED_PROFESSIONAL_REVIEW' | 'NOT_REVIEWABLE_UNTIL_CORRECTED';
  readonly exceptionApplied: boolean;
}

export function evaluatePacket(
  packet: ReferralPacket,
  policy: Pick<PolicyDecisionsPending, 'waivableItems'>,
  exception?: UrgentException | null,
): PacketEvaluation {
  const missing: MissingItem[] = [];
  for (const code of REQUIRED_FORMS_V1) {
    const present = packet.items.some((i) => i.code === code && i.status === 'PROVIDED' && i.documentId !== null);
    if (present) continue;
    const bad = packet.items.find((i) => i.code === code && i.status !== 'PROVIDED');
    missing.push({
      code,
      reason: bad ? bad.status : 'ABSENT',
      nextActionOwner: code === 'GOVERNMENT_PHOTO_ID' || code === 'CLIENT_INTAKE_FORM' ? 'MEMBER' : 'UNION_REFERRAL_REP',
    });
  }
  if (packet.declaredClaimCount < 1) {
    missing.push({ code: 'WSIB_CLAIM_NUMBERS', reason: 'ABSENT', nextActionOwner: 'UNION_REFERRAL_REP' });
  }
  if (packet.claimHistory !== 'ALL_DECLARED') {
    missing.push({ code: 'CLAIM_HISTORY_DECLARATION', reason: 'NOT_DECLARED', nextActionOwner: 'UNION_REFERRAL_REP' });
  }
  if (packet.wsibCorrespondence === 'MISSING') {
    missing.push({ code: 'WSIB_CORRESPONDENCE', reason: 'ABSENT', nextActionOwner: 'UNION_REFERRAL_REP' });
  }
  for (const d of packet.decisions) {
    if (d.outcome === 'DENIED' && d.letterDocumentId === null) {
      missing.push({ code: 'DENIAL_LETTER', reason: 'ABSENT', nextActionOwner: 'UNION_REFERRAL_REP', decisionId: d.decisionId });
    }
  }

  const complete = missing.length === 0;
  const exceptionCovers =
    !!exception &&
    exception.reason.trim().length >= 10 &&
    exception.urgencyBasis.trim().length >= 5 &&
    missing.every((m) => exception.waivedItems.includes(m.code) && policy.waivableItems.includes(m.code));

  return {
    checklistState: complete ? 'DOCUMENT_COMPLETE_FOR_REVIEW' : 'AWAITING_REQUIRED_ITEMS',
    missing,
    professionalSufficiency: 'NOT_ASSESSED',
    reviewRoute: complete ? 'STANDARD_REVIEW' : exceptionCovers ? 'EXPEDITED_PROFESSIONAL_REVIEW' : 'NOT_REVIEWABLE_UNTIL_CORRECTED',
    exceptionApplied: !complete && exceptionCovers,
  };
}

export function grantUrgentException(
  principal: Principal,
  policy: PolicyDecisionsPending,
  input: { reason: string; waivedItems: readonly string[]; urgencyBasis: string },
): Result<UrgentException, 'NOT_AUTHORIZED' | 'ITEM_NOT_WAIVABLE' | 'REASON_REQUIRED'> {
  if (!hasAnyRole(principal, policy.urgentExceptionRoles) || !hasAnyRole(principal, WORKAID_ROLES)) {
    return err('NOT_AUTHORIZED', 'role may not grant urgent exceptions');
  }
  if (input.reason.trim().length < 10 || input.urgencyBasis.trim().length < 5) {
    return err('REASON_REQUIRED', 'reason and urgency basis are required');
  }
  const bad = input.waivedItems.filter((c) => !policy.waivableItems.includes(c));
  if (bad.length > 0) return err('ITEM_NOT_WAIVABLE', `not waivable under current policy: ${bad.join(', ')}`);
  return ok({ grantedBy: principal.userId, reason: input.reason, waivedItems: [...input.waivedItems], urgencyBasis: input.urgencyBasis });
}

/* ------------------------------------------------------------------ *
 * Referral lifecycle
 * ------------------------------------------------------------------ */

export type ReferralState =
  | 'DRAFT'
  | 'AWAITING_REQUIRED_ITEMS'
  | 'PACKET_COMPLETE_FOR_REVIEW'
  | 'OFFERED'
  | 'CLARIFICATION_REQUESTED'
  | 'RETURNED_FOR_CORRECTION'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'WITHDRAWN';

export type UrgentReviewState = 'NONE' | 'PENDING' | 'COMPLETED';

export interface ReferralHistoryEntry {
  readonly event: ReferralEvent['type'];
  readonly actor: UserId;
  readonly at: string;
  readonly from: ReferralState;
  readonly to: ReferralState;
  readonly note?: string;
}

export interface Referral {
  readonly id: ReferralId;
  /** Referring union. */
  readonly organizationId: OrganizationId;
  readonly specialistOrganizationId: OrganizationId;
  readonly memberId: MemberId;
  readonly state: ReferralState;
  readonly packetVersion: number;
  readonly lastEvaluation: PacketEvaluation | null;
  readonly urgentReview: UrgentReviewState;
  readonly urgentException: UrgentException | null;
  /** Professional acceptance is a separate fact from the checklist and from any access grant. */
  readonly acceptance: { readonly acceptedBy: UserId; readonly at: string } | null;
  readonly history: readonly ReferralHistoryEntry[];
}

export type ReferralEvent =
  | { readonly type: 'UPDATE_PACKET'; readonly packet: ReferralPacket }
  | { readonly type: 'OFFER'; readonly urgentException?: UrgentException }
  | { readonly type: 'REQUEST_CLARIFICATION'; readonly question: string }
  | { readonly type: 'ANSWER_CLARIFICATION'; readonly packet?: ReferralPacket }
  | { readonly type: 'RETURN_FOR_CORRECTION'; readonly reason: string }
  | { readonly type: 'ACCEPT' }
  | { readonly type: 'DECLINE'; readonly reason: string; readonly urgentDisposition?: 'URGENT_REVIEW_COMPLETED' | 'URGENT_REVIEW_NOT_REQUIRED' }
  | { readonly type: 'WITHDRAW' }
  | { readonly type: 'COMPLETE_URGENT_REVIEW' };

export type ReferralError =
  | 'NOT_FOUND'
  | 'FORBIDDEN_ACTOR'
  | 'ILLEGAL_TRANSITION'
  | 'PACKET_INCOMPLETE'
  | 'URGENT_REVIEW_PENDING'
  | 'NO_URGENT_REVIEW_PENDING'
  | 'REASON_REQUIRED';

export function newReferral(input: {
  id: ReferralId;
  organizationId: OrganizationId;
  specialistOrganizationId: OrganizationId;
  memberId: MemberId;
}): Referral {
  return {
    ...input,
    state: 'DRAFT',
    packetVersion: 0,
    lastEvaluation: null,
    urgentReview: 'NONE',
    urgentException: null,
    acceptance: null,
    history: [],
  };
}

const UNION_EVENTS: readonly ReferralEvent['type'][] = ['UPDATE_PACKET', 'OFFER', 'ANSWER_CLARIFICATION', 'WITHDRAW'];

export function applyReferralEvent(
  referral: Referral,
  event: ReferralEvent,
  ctx: { principal: Principal; now: string; policy: PolicyDecisionsPending },
): Result<Referral, ReferralError> {
  const { principal, now, policy } = ctx;
  const unionSide = UNION_EVENTS.includes(event.type);

  // Non-disclosing: an actor outside both organizations learns nothing about existence.
  const inUnion = principal.organizationId === referral.organizationId;
  const inSpecialist = principal.organizationId === referral.specialistOrganizationId;
  if (!principal.sessionActive || (!inUnion && !inSpecialist)) return err('NOT_FOUND', 'referral not found');
  if (unionSide) {
    if (!inUnion || !hasAnyRole(principal, ['UNION_REFERRAL_REP', 'UNION_ADMIN'])) {
      return err('FORBIDDEN_ACTOR', 'action reserved to the referring union');
    }
  } else if (!inSpecialist || !hasAnyRole(principal, WORKAID_ROLES)) {
    return err('FORBIDDEN_ACTOR', 'action reserved to the specialist organization');
  }

  const from = referral.state;
  const move = (to: ReferralState, patch: Partial<Referral> = {}, note?: string): Result<Referral, ReferralError> =>
    ok({
      ...referral,
      ...patch,
      state: to,
      history: [...referral.history, { event: event.type, actor: principal.userId, at: now, from, to, ...(note ? { note } : {}) }],
    });
  const illegal = () => err('ILLEGAL_TRANSITION', `${event.type} is not allowed from ${from}`);

  switch (event.type) {
    case 'UPDATE_PACKET': {
      if (!['DRAFT', 'AWAITING_REQUIRED_ITEMS', 'PACKET_COMPLETE_FOR_REVIEW', 'RETURNED_FOR_CORRECTION'].includes(from)) return illegal();
      const evaluation = evaluatePacket(event.packet, policy);
      return move(
        evaluation.checklistState === 'DOCUMENT_COMPLETE_FOR_REVIEW' ? 'PACKET_COMPLETE_FOR_REVIEW' : 'AWAITING_REQUIRED_ITEMS',
        { packetVersion: referral.packetVersion + 1, lastEvaluation: evaluation },
      );
    }
    case 'OFFER': {
      if (!['PACKET_COMPLETE_FOR_REVIEW', 'AWAITING_REQUIRED_ITEMS'].includes(from)) return illegal();
      const evaluation = referral.lastEvaluation;
      if (!evaluation) return err('PACKET_INCOMPLETE', 'no packet evaluation on file');
      if (evaluation.checklistState === 'DOCUMENT_COMPLETE_FOR_REVIEW') return move('OFFERED');
      const exception = event.urgentException;
      const covered =
        !!exception &&
        exception.reason.trim().length >= 10 &&
        evaluation.missing.every((m) => exception.waivedItems.includes(m.code) && policy.waivableItems.includes(m.code));
      if (!exception || !covered) {
        return err('PACKET_INCOMPLETE', 'required items are missing and no valid urgent exception covers them');
      }
      return move('OFFERED', { urgentException: exception, urgentReview: 'PENDING' }, 'offered under urgent exception; checklist remains incomplete');
    }
    case 'REQUEST_CLARIFICATION':
      if (from !== 'OFFERED') return illegal();
      if (event.question.trim().length === 0) return err('REASON_REQUIRED', 'question required');
      return move('CLARIFICATION_REQUESTED', {}, event.question);
    case 'ANSWER_CLARIFICATION': {
      if (from !== 'CLARIFICATION_REQUESTED') return illegal();
      if (!event.packet) return move('OFFERED');
      return move('OFFERED', { packetVersion: referral.packetVersion + 1, lastEvaluation: evaluatePacket(event.packet, policy) });
    }
    case 'RETURN_FOR_CORRECTION':
      if (!['OFFERED', 'CLARIFICATION_REQUESTED'].includes(from)) return illegal();
      if (event.reason.trim().length === 0) return err('REASON_REQUIRED', 'reason required');
      // urgentReview is deliberately untouched: returning a packet never cancels a pending urgent review.
      return move('RETURNED_FOR_CORRECTION', {}, event.reason);
    case 'ACCEPT':
      if (from !== 'OFFERED') return illegal();
      if (!hasAnyRole(principal, policy.acceptanceRoles)) return err('FORBIDDEN_ACTOR', 'role may not formally accept representation');
      return move('ACCEPTED', { acceptance: { acceptedBy: principal.userId, at: now } });
    case 'DECLINE':
      if (!['OFFERED', 'CLARIFICATION_REQUESTED', 'RETURNED_FOR_CORRECTION'].includes(from)) return illegal();
      if (event.reason.trim().length === 0) return err('REASON_REQUIRED', 'reason required');
      if (referral.urgentReview === 'PENDING' && !event.urgentDisposition) {
        return err('URGENT_REVIEW_PENDING', 'an explicit urgent-review disposition is required before declining');
      }
      return move('DECLINED', event.urgentDisposition ? { urgentReview: 'COMPLETED' } : {}, event.reason);
    case 'WITHDRAW':
      if (['ACCEPTED', 'DECLINED', 'WITHDRAWN'].includes(from)) return illegal();
      if (referral.urgentReview === 'PENDING') {
        return err('URGENT_REVIEW_PENDING', 'withdrawal is blocked while an urgent professional review is pending');
      }
      return move('WITHDRAWN');
    case 'COMPLETE_URGENT_REVIEW':
      if (referral.urgentReview !== 'PENDING') return err('NO_URGENT_REVIEW_PENDING', 'no urgent review is pending');
      return move(from, { urgentReview: 'COMPLETED' });
  }
}
