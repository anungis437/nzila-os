import type { MatterId, MemberId, UserId } from './ids.ts';
import type { Decision, Matter } from './authorization.ts';
import type { Principal } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';
import type { ExternalDependency } from './dependency.ts';
import type { Submission, SubmissionKind, SubmissionState } from './submission.ts';

/**
 * Deny-by-default member publication. The member surface is a separate
 * projection populated only by explicit, professionally approved, evidence-backed
 * publications. It never mirrors the internal state machines, and a draft or
 * a task can never produce a milestone.
 */

export type MemberStage =
  | 'REPRESENTATION_ACCEPTED'
  | 'DOCUMENTS_SENT_TO_WSIB'
  | 'WSIB_RECEIPT_CONFIRMED'
  | 'AWAITING_WSIB_FILE'
  | 'APPEAL_SENT_TO_WSIB'
  | 'ARO_DECISION_RECEIVED'
  | 'GENERAL_UPDATE';

export type PublicationEvidence =
  | { readonly kind: 'MATTER_ACCEPTANCE' }
  | { readonly kind: 'SUBMISSION'; readonly submission: Submission }
  | { readonly kind: 'DEPENDENCY'; readonly dependency: ExternalDependency }
  | { readonly kind: 'NONE' };

const DISPATCHED_OR_LATER: readonly SubmissionState[] = ['DISPATCHED', 'DELIVERY_ACK', 'RECEIPT_CONFIRMED'];

function evidenceSatisfies(stage: MemberStage, ev: PublicationEvidence, matter: Matter): boolean {
  switch (stage) {
    case 'REPRESENTATION_ACCEPTED':
      return ev.kind === 'MATTER_ACCEPTANCE' && matter.acceptance !== null;
    case 'DOCUMENTS_SENT_TO_WSIB':
      return ev.kind === 'SUBMISSION' && DISPATCHED_OR_LATER.includes(ev.submission.state);
    case 'WSIB_RECEIPT_CONFIRMED':
      return ev.kind === 'SUBMISSION' && ev.submission.state === 'RECEIPT_CONFIRMED' && ev.submission.receipt !== null;
    case 'APPEAL_SENT_TO_WSIB':
      return ev.kind === 'SUBMISSION' && (ev.submission.kind as SubmissionKind) === 'ARF' && DISPATCHED_OR_LATER.includes(ev.submission.state);
    case 'AWAITING_WSIB_FILE':
      return ev.kind === 'DEPENDENCY' && ev.dependency.kind === 'WSIB_CLAIM_FILE' && ev.dependency.receivedAt === null;
    case 'ARO_DECISION_RECEIVED':
      return ev.kind === 'DEPENDENCY' && ev.dependency.kind === 'ARO_DECISION' && ev.dependency.receivedAt !== null;
    case 'GENERAL_UPDATE':
      return true;
  }
}

export interface MemberPublication {
  readonly matterId: MatterId;
  readonly memberId: MemberId;
  readonly version: number;
  readonly stage: MemberStage;
  readonly text: string;
  readonly approvedBy: UserId;
  readonly publishedAt: string;
  readonly withdrawnAt: string | null;
}

export type PublicationError = 'NOT_AUTHORIZED' | 'EVIDENCE_DOES_NOT_SUPPORT_STAGE' | 'TEXT_REQUIRED' | 'TEXT_TOO_LONG' | 'WRONG_MEMBER';

export function publishMemberStatus(input: {
  principal: Principal;
  matter: Matter;
  professionalAuth: Decision;
  stage: MemberStage;
  text: string;
  evidence: PublicationEvidence;
  priorVersions: readonly MemberPublication[];
  now: string;
}): Result<MemberPublication, PublicationError> {
  if (!input.professionalAuth.allow) return err('NOT_AUTHORIZED', 'publication requires an authorized professional action');
  if (input.text.trim().length === 0) return err('TEXT_REQUIRED', 'approved plain-language text required');
  if (input.text.length > 600) return err('TEXT_TOO_LONG', 'keep member updates short');
  if (!evidenceSatisfies(input.stage, input.evidence, input.matter)) {
    return err('EVIDENCE_DOES_NOT_SUPPORT_STAGE', `${input.stage} cannot be published on the evidence provided`);
  }
  const version = input.priorVersions.filter((p) => p.matterId === input.matter.id).length + 1;
  return ok({
    matterId: input.matter.id,
    memberId: input.matter.memberId,
    version,
    stage: input.stage,
    text: input.text,
    approvedBy: input.principal.userId,
    publishedAt: input.now,
    withdrawnAt: null,
  });
}

export function withdrawPublication(p: MemberPublication, now: string): MemberPublication {
  return p.withdrawnAt ? p : { ...p, withdrawnAt: now };
}

export interface MemberStatusView {
  readonly state: 'NO_UPDATE_PUBLISHED' | 'PUBLISHED';
  readonly stage?: MemberStage;
  readonly text?: string;
  readonly version?: number;
  readonly publishedAt?: string;
  /** Always present so a member is never shown a silent denial of their lawful access to records. */
  readonly recordsAccessRequestChannel: 'AVAILABLE';
}

/** The only function that produces what a member sees. Fields are copied explicitly; nothing else can leak through. */
export function memberStatusView(principal: Principal, matter: Matter, publications: readonly MemberPublication[]): MemberStatusView | null {
  if (!principal.sessionActive || principal.subjectMemberId !== matter.memberId || !principal.roles.includes('MEMBER')) return null;
  const latest = [...publications].filter((p) => p.matterId === matter.id && p.memberId === matter.memberId && !p.withdrawnAt).sort((a, b) => b.version - a.version)[0];
  if (!latest) return { state: 'NO_UPDATE_PUBLISHED', recordsAccessRequestChannel: 'AVAILABLE' };
  return {
    state: 'PUBLISHED',
    stage: latest.stage,
    text: latest.text,
    version: latest.version,
    publishedAt: latest.publishedAt,
    recordsAccessRequestChannel: 'AVAILABLE',
  };
}
