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
  /** French text supplied by WorkAid. `translationStatus` says nothing about quality unless a human reviewed it. */
  readonly textFr: string | null;
  readonly translationStatus: 'NOT_PROVIDED' | 'UNREVIEWED' | 'REVIEWED_BY_PROFESSIONAL';
  /** Whether the referring union may also see this approved milestone. Default false. */
  readonly unionVisible: boolean;
  readonly approvedBy: UserId;
  readonly publishedAt: string;
  readonly withdrawnAt: string | null;
}

export type PublicationError =
  | 'NOT_AUTHORIZED'
  | 'EVIDENCE_DOES_NOT_SUPPORT_STAGE'
  | 'TEXT_REQUIRED'
  | 'TEXT_TOO_LONG'
  | 'WRONG_MEMBER'
  | 'MISREPRESENTS_PROGRESS'
  | 'FR_TEXT_REQUIRED';

/**
 * Wording that would overstate progress. The lint is deliberately about
 * AFFIRMATIVE claims ("was received", "WSIB accepted"), so honest text such as
 * "we are waiting for WSIB to confirm they arrived" passes. It is a backstop for a
 * professional's review, not a substitute for it, and it makes no claim about
 * translation or reading-level quality.
 */
const FILED_OR_OUTCOME_EN: readonly RegExp[] = [
  /\b(filed|validly|successful(ly)?|won|lost)\b/i,
  /\bWSIB\s+(has\s+)?(accepted|approved|granted|agreed)\b/i,
  /\b(was|were|has been|have been)\s+(accepted|approved|granted|filed)\b/i,
];
const RECEIVED_EN: readonly RegExp[] = [/\bWSIB\s+(has\s+)?received\b/i, /\b(was|were|has been|have been)\s+(received|confirmed)\b/i];
const OUTCOME_EN: readonly RegExp[] = [/\b(approved|denied|granted|refused|allowed|dismissed|favourable|unfavourable|adverse)\b/i];
/** Unicode-aware word boundaries: JavaScript's `\b` is ASCII-only and silently fails after accented letters. */
const fr = (alternatives: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${alternatives})(?![\\p{L}\\p{N}_])`, 'iu');
const FILED_OR_OUTCOME_FR: readonly RegExp[] = [fr('déposé|déposée|déposés|déposées'), fr('accepté|acceptée|acceptés|acceptées|approuvé|approuvée|approuvés|approuvées|accordé|accordée|refusé|refusée')];
const RECEIVED_FR: readonly RegExp[] = [fr('WSIB\\s+a\\s+reçu'), fr('(?:a|ont)\\s+été\\s+(?:reçu|reçue|reçus|reçues|confirmé|confirmée|confirmés|confirmées)')];
const OUTCOME_FR: readonly RegExp[] = [fr('approuvé|approuvée|refusé|refusée|accordé|accordée|rejeté|rejetée|favorable|défavorable')];

const RECEIPT_ASSERTING_STAGES: readonly MemberStage[] = ['WSIB_RECEIPT_CONFIRMED', 'ARO_DECISION_RECEIVED'];

export function progressMisrepresentations(stage: MemberStage, text: string, lang: 'en' | 'fr'): string[] {
  const rx: RegExp[] = [...(lang === 'en' ? FILED_OR_OUTCOME_EN : FILED_OR_OUTCOME_FR)];
  if (!RECEIPT_ASSERTING_STAGES.includes(stage)) rx.push(...(lang === 'en' ? RECEIVED_EN : RECEIVED_FR));
  // The outcome of a decision is communicated by the professional, never by a status line.
  if (stage === 'ARO_DECISION_RECEIVED') rx.push(...(lang === 'en' ? OUTCOME_EN : OUTCOME_FR));
  return rx.filter((r) => r.test(text)).map((r) => r.source);
}

export function publishMemberStatus(input: {
  principal: Principal;
  matter: Matter;
  professionalAuth: Decision;
  stage: MemberStage;
  text: string;
  textFr?: string;
  /** Policy: whether a French text is mandatory. Open decision D-20; default false so nothing is assumed. */
  bilingualRequired?: boolean;
  unionVisible?: boolean;
  evidence: PublicationEvidence;
  priorVersions: readonly MemberPublication[];
  now: string;
}): Result<MemberPublication, PublicationError> {
  if (!input.professionalAuth.allow) return err('NOT_AUTHORIZED', 'publication requires an authorized professional action');
  if (input.text.trim().length === 0) return err('TEXT_REQUIRED', 'approved plain-language text required');
  if (input.text.length > 600 || (input.textFr?.length ?? 0) > 600) return err('TEXT_TOO_LONG', 'keep member updates short');
  if (input.bilingualRequired && !input.textFr?.trim()) return err('FR_TEXT_REQUIRED', 'policy requires a French text');
  if (!evidenceSatisfies(input.stage, input.evidence, input.matter)) {
    return err('EVIDENCE_DOES_NOT_SUPPORT_STAGE', `${input.stage} cannot be published on the evidence provided`);
  }
  const bad = [...progressMisrepresentations(input.stage, input.text, 'en'), ...(input.textFr ? progressMisrepresentations(input.stage, input.textFr, 'fr') : [])];
  if (bad.length > 0) return err('MISREPRESENTS_PROGRESS', `wording overstates progress for ${input.stage}: ${bad.length} pattern(s)`);
  const version = input.priorVersions.filter((p) => p.matterId === input.matter.id).length + 1;
  return ok({
    matterId: input.matter.id,
    memberId: input.matter.memberId,
    version,
    stage: input.stage,
    text: input.text,
    textFr: input.textFr?.trim() ? input.textFr : null,
    translationStatus: input.textFr?.trim() ? 'UNREVIEWED' : 'NOT_PROVIDED',
    unionVisible: input.unionVisible ?? false,
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
  readonly locale?: 'en' | 'fr';
  readonly version?: number;
  readonly publishedAt?: string;
  /** Always present so a member is never shown a silent denial of their lawful access to records. */
  readonly recordsAccessRequestChannel: 'AVAILABLE';
}

/** The only function that produces what a member sees. Fields are copied explicitly; nothing else can leak through. */
export function memberStatusView(principal: Principal, matter: Matter, publications: readonly MemberPublication[], locale: 'en' | 'fr' = 'en'): MemberStatusView | null {
  if (!principal.sessionActive || principal.subjectMemberId !== matter.memberId || !principal.roles.includes('MEMBER')) return null;
  const latest = [...publications].filter((p) => p.matterId === matter.id && p.memberId === matter.memberId && !p.withdrawnAt).sort((a, b) => b.version - a.version)[0];
  if (!latest) return { state: 'NO_UPDATE_PUBLISHED', recordsAccessRequestChannel: 'AVAILABLE' };
  const useFr = locale === 'fr' && latest.textFr !== null;
  return {
    state: 'PUBLISHED',
    stage: latest.stage,
    text: useFr ? latest.textFr! : latest.text,
    locale: useFr ? 'fr' : 'en',
    version: latest.version,
    publishedAt: latest.publishedAt,
    recordsAccessRequestChannel: 'AVAILABLE',
  };
}

/** What the referring union may see: only publications a professional marked union-visible. Stage, text and version only. */
export function unionMilestoneView(publications: readonly MemberPublication[], matterId: MatterId): { stage: MemberStage; text: string; version: number; publishedAt: string }[] {
  return publications
    .filter((p) => p.matterId === matterId && p.unionVisible && !p.withdrawnAt)
    .sort((a, b) => a.version - b.version)
    .map((p) => ({ stage: p.stage, text: p.text, version: p.version, publishedAt: p.publishedAt }));
}

