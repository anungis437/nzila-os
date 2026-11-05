import type { ClaimId, DecisionId, DocumentId, IssueId, MatterId, SubmissionId, UserId } from './ids.ts';
import type { Decision } from './authorization.ts';
import type { Principal } from './principal.ts';
import { hasAnyRole, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';
import { DEFAULT_RECIPIENT, dispatchConfirmed, receiptDocumented } from './submission.ts';
import type { Submission, SubmissionKind } from './submission.ts';

/**
 * Filing validity is NOT a property of receipt.
 *
 * A receipt record says a human obtained confirmation that the authority has
 * the document. It does not say the document met the authority's requirements,
 * was addressed to the right place about the right claim and issues, was signed,
 * used the current form, or was on time. This module records a separate,
 * human, evidence-backed determination, and keeps the authority's own response
 * (acceptance or rejection) as a third, separate fact.
 *
 * What this module can and cannot support
 * - CAN: check that what the submission claims to be (kind, recipient, claim,
 *   decision, issues, matter) is consistent with what the professional says it
 *   was meant to be, and check that every element of a REVIEWED requirement
 *   source was attested with a reference by a named, authorized professional.
 * - CANNOT: know what the authority's requirements are. The requirement
 *   registry is supplied by WorkAid/Angelo and is empty by default; with no
 *   reviewed source the status stays UNDETERMINED (explicitly unresolved).
 * - NEVER: compute or assert timeliness. `timeliness` is always NOT_ASSERTED;
 *   that remains a DeadlineObligation matter (deadlines.ts).
 */
export interface RequirementElement {
  readonly code: string;
  readonly description: string;
}

export interface RequirementSource {
  readonly sourceId: string;
  readonly label: string;
  /** The form kind the source describes. A source for one kind can never ground another. */
  readonly formKind: SubmissionKind;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly retrievedOn: string;
  /** Named human who reviewed this source. Unreviewed sources can ground nothing. */
  readonly reviewedBy: UserId | null;
  readonly elements: readonly RequirementElement[];
}

export interface ElementAttestation {
  readonly code: string;
  /** Reference to the evidence (document id, page, note). Required and non-empty. */
  readonly evidenceRef: string;
}

/** What the professional says the submission was meant to be. Compared field by field with the submission. */
export interface FilingIntent {
  readonly matterId: MatterId;
  readonly claimId: ClaimId | null;
  readonly decisionId: DecisionId | null;
  readonly issueIds: readonly IssueId[];
  readonly kind: SubmissionKind;
}

export type Determination = 'DETERMINED_VALID' | 'DETERMINED_DEFECTIVE';

export interface FilingAssertion {
  readonly determination: Determination;
  readonly by: UserId;
  readonly at: string;
  readonly submissionVersion: number;
  readonly sourceId: string | null;
  readonly attestations: readonly ElementAttestation[];
  readonly defects: readonly string[];
  readonly reasoning: string;
}

export type AuthorityOutcome = 'ACCEPTED' | 'REJECTED';

export interface AuthorityResponse {
  readonly outcome: AuthorityOutcome;
  readonly recordedBy: UserId;
  readonly at: string;
  readonly receivedAt: string;
  /** The authority's own document or contact record. Required. */
  readonly evidenceDocumentId: DocumentId;
  readonly method: string;
}

export interface FilingRecord {
  readonly submissionId: SubmissionId;
  readonly submissionVersion: number;
  /** Append-only. */
  readonly determinations: readonly FilingAssertion[];
  /** Append-only. */
  readonly authorityResponses: readonly AuthorityResponse[];
}

export const newFilingRecord = (s: Pick<Submission, 'id' | 'version'>): FilingRecord => ({
  submissionId: s.id,
  submissionVersion: s.version,
  determinations: [],
  authorityResponses: [],
});

export type FilingStatus =
  | 'UNDETERMINED'
  | 'PROFESSIONALLY_DETERMINED_VALID'
  | 'PROFESSIONALLY_DETERMINED_DEFECTIVE'
  | 'AUTHORITY_ACCEPTED'
  | 'AUTHORITY_REJECTED'
  | 'VOID_SUBMISSION_CLOSED';

export interface FilingView {
  readonly status: FilingStatus;
  readonly receiptDocumented: boolean;
  readonly timeliness: 'NOT_ASSERTED';
  /** Why the status is UNDETERMINED, when it is. */
  readonly unresolvedReason: string | null;
}

export type FilingError =
  | 'NOT_PROFESSIONAL'
  | 'ASSESSOR_MISMATCH'
  | 'AUTHORITY_DENIED'
  | 'WRONG_MATTER'
  | 'DISPATCH_NOT_CONFIRMED'
  | 'RECEIPT_NOT_DOCUMENTED'
  | 'SUBMISSION_CLOSED'
  | 'STALE_VERSION'
  | 'REQUIREMENT_SOURCE_UNKNOWN'
  | 'REQUIREMENT_SOURCE_UNREVIEWED'
  | 'REQUIREMENT_SOURCE_WRONG_FORM'
  | 'REQUIREMENT_SOURCE_NOT_EFFECTIVE'
  | 'MALFORMED'
  | 'MISDIRECTED'
  | 'INCOMPLETE_ATTESTATIONS'
  | 'DEFECTS_REQUIRED'
  | 'REASONING_REQUIRED'
  | 'EVIDENCE_REQUIRED';

const CLOSED: readonly Submission['state'][] = ['WITHDRAWN', 'SUPERSEDED', 'REJECTED'];
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/** Findings that make the submission something other than what the professional intended. Machine-checkable only. */
export function consistencyProblems(sub: Submission, intent: FilingIntent): { code: 'MALFORMED' | 'MISDIRECTED'; detail: string }[] {
  const out: { code: 'MALFORMED' | 'MISDIRECTED'; detail: string }[] = [];
  if (sub.matterId !== intent.matterId) out.push({ code: 'MISDIRECTED', detail: 'submission belongs to a different matter' });
  if (sub.kind !== intent.kind) out.push({ code: 'MALFORMED', detail: `submission is ${sub.kind}, intended ${intent.kind}` });
  if (sub.recipient !== DEFAULT_RECIPIENT[sub.kind] && sub.kind !== 'OTHER') out.push({ code: 'MISDIRECTED', detail: `addressed to ${sub.recipient}` });
  if (sub.claimId !== intent.claimId) out.push({ code: 'MISDIRECTED', detail: 'submission names a different claim than intended' });
  if (sub.decisionId !== intent.decisionId) out.push({ code: 'MISDIRECTED', detail: 'submission names a different decision than intended' });
  if (!sameSet(sub.issueIds, intent.issueIds)) out.push({ code: 'MISDIRECTED', detail: 'disputed issues differ from those intended' });
  const needsLinks: SubmissionKind[] = ['ITO', 'ARF', 'WRITTEN_SUBMISSION'];
  if (needsLinks.includes(sub.kind) && (!sub.claimId || !sub.decisionId || !sub.objectionId || sub.issueIds.length === 0)) {
    out.push({ code: 'MALFORMED', detail: 'required links are missing' });
  }
  return out;
}

export interface AssessInput {
  readonly principal: Principal;
  /** What the request body claims; must equal the authenticated principal. */
  readonly claimedAssessor: string;
  readonly professionalAuth: Decision;
  readonly submission: Submission;
  readonly currentVersion: number;
  readonly record: FilingRecord;
  readonly intent: FilingIntent;
  readonly registry: readonly RequirementSource[];
  readonly sourceId: string;
  readonly attestations: readonly ElementAttestation[];
  readonly reasoning: string;
  readonly now: string;
}

function gate(input: Pick<AssessInput, 'principal' | 'claimedAssessor' | 'professionalAuth' | 'submission' | 'currentVersion' | 'record'>): FilingError | null {
  const { principal, submission, record } = input;
  if (!hasAnyRole(principal, WORKAID_ROLES)) return 'NOT_PROFESSIONAL';
  if (input.claimedAssessor !== principal.userId) return 'ASSESSOR_MISMATCH';
  if (!input.professionalAuth.allow) return 'AUTHORITY_DENIED';
  if (CLOSED.includes(submission.state)) return 'SUBMISSION_CLOSED';
  if (submission.version !== input.currentVersion || record.submissionId !== submission.id || record.submissionVersion !== submission.version) return 'STALE_VERSION';
  return null;
}

/**
 * Records that a named professional determined the submission VALID against a
 * reviewed requirement source. Receipt documented is a NECESSARY precondition
 * (a submission the authority has not been shown to have cannot be a "filing";
 * assumption F-01, to be confirmed by Angelo) and is never SUFFICIENT.
 */
export function determineFilingValid(input: AssessInput): Result<FilingRecord, FilingError> {
  const g = gate(input);
  if (g) return err(g, `filing determination refused: ${g}`);
  const { submission: sub } = input;
  if (!dispatchConfirmed(sub)) return err('DISPATCH_NOT_CONFIRMED', 'a submission that was not confirmed sent cannot be determined valid');
  if (!receiptDocumented(sub)) return err('RECEIPT_NOT_DOCUMENTED', 'receipt has not been documented; sending alone is not a filing');
  if (input.reasoning.trim().length < 20) return err('REASONING_REQUIRED', 'record the reasoning');

  const src = input.registry.find((r) => r.sourceId === input.sourceId);
  if (!src) return err('REQUIREMENT_SOURCE_UNKNOWN', 'requirement source is not in the registry; filing stays undetermined');
  if (!src.reviewedBy) return err('REQUIREMENT_SOURCE_UNREVIEWED', 'requirement source has no named reviewer');
  if (src.formKind !== sub.kind) return err('REQUIREMENT_SOURCE_WRONG_FORM', `source describes ${src.formKind}, submission is ${sub.kind}`);
  const dispatchedOn = (sub.dispatch?.at ?? '').slice(0, 10);
  if (!(src.effectiveFrom <= dispatchedOn && (src.effectiveTo === null || dispatchedOn <= src.effectiveTo))) {
    return err('REQUIREMENT_SOURCE_NOT_EFFECTIVE', 'requirement source was not effective on the dispatch date');
  }

  const problems = consistencyProblems(sub, input.intent);
  if (problems.length > 0) return err(problems[0]!.code, problems.map((p) => p.detail).join('; '));

  const attested = new Map(input.attestations.filter((a) => a.evidenceRef.trim().length > 0).map((a) => [a.code, a]));
  const missing = src.elements.filter((e) => !attested.has(e.code)).map((e) => e.code);
  if (src.elements.length === 0) return err('INCOMPLETE_ATTESTATIONS', 'a requirement source with no elements cannot ground a determination');
  if (missing.length > 0) return err('INCOMPLETE_ATTESTATIONS', `elements not attested with evidence: ${missing.join(', ')}`);

  const assertion: FilingAssertion = {
    determination: 'DETERMINED_VALID',
    by: input.principal.userId,
    at: input.now,
    submissionVersion: sub.version,
    sourceId: src.sourceId,
    attestations: src.elements.map((e) => attested.get(e.code)!),
    defects: [],
    reasoning: input.reasoning,
  };
  return ok({ ...input.record, determinations: [...input.record.determinations, assertion] });
}

/** A professional may record that a sent submission was defective. Needs concrete defects and reasoning; no receipt required. */
export function determineFilingDefective(input: Omit<AssessInput, 'registry' | 'sourceId' | 'attestations' | 'intent'> & { defects: readonly string[] }): Result<FilingRecord, FilingError> {
  const g = gate(input);
  if (g) return err(g, `filing determination refused: ${g}`);
  if (!dispatchConfirmed(input.submission)) return err('DISPATCH_NOT_CONFIRMED', 'only a submission confirmed sent can be assessed');
  if (input.defects.length === 0 || input.defects.some((d) => d.trim().length === 0)) return err('DEFECTS_REQUIRED', 'name at least one defect');
  if (input.reasoning.trim().length < 20) return err('REASONING_REQUIRED', 'record the reasoning');
  const assertion: FilingAssertion = {
    determination: 'DETERMINED_DEFECTIVE',
    by: input.principal.userId,
    at: input.now,
    submissionVersion: input.submission.version,
    sourceId: null,
    attestations: [],
    defects: [...input.defects],
    reasoning: input.reasoning,
  };
  return ok({ ...input.record, determinations: [...input.record.determinations, assertion] });
}

/**
 * Records the authority's own response, from the authority's own document.
 * It is independent of both receipt and of the professional's determination,
 * and it never asserts timeliness.
 */
export function recordAuthorityResponse(input: {
  readonly principal: Principal;
  readonly claimedRecorder: string;
  readonly professionalAuth: Decision;
  readonly submission: Submission;
  readonly currentVersion: number;
  readonly record: FilingRecord;
  readonly outcome: AuthorityOutcome;
  readonly evidenceDocumentId: DocumentId | null;
  readonly method: string;
  readonly receivedAt: string;
  readonly now: string;
}): Result<FilingRecord, FilingError> {
  const g = gate({ ...input, claimedAssessor: input.claimedRecorder });
  if (g) return err(g, `authority response refused: ${g}`);
  if (!dispatchConfirmed(input.submission)) return err('DISPATCH_NOT_CONFIRMED', 'no authority response can attach to a submission that was not confirmed sent');
  if (!input.evidenceDocumentId) return err('EVIDENCE_REQUIRED', "the authority's own document is required");
  const resp: AuthorityResponse = {
    outcome: input.outcome,
    recordedBy: input.principal.userId,
    at: input.now,
    receivedAt: input.receivedAt,
    evidenceDocumentId: input.evidenceDocumentId,
    method: input.method,
  };
  return ok({ ...input.record, authorityResponses: [...input.record.authorityResponses, resp] });
}

/** The only function that produces a filing status. Derived from records; never from submission state alone. */
export function filingView(sub: Submission, record: FilingRecord): FilingView {
  const documented = receiptDocumented(sub);
  const base = { receiptDocumented: documented, timeliness: 'NOT_ASSERTED' as const };
  if (CLOSED.includes(sub.state) || record.submissionVersion !== sub.version) {
    return { ...base, status: 'VOID_SUBMISSION_CLOSED', unresolvedReason: null };
  }
  const resp = record.authorityResponses.at(-1);
  if (resp) return { ...base, status: resp.outcome === 'ACCEPTED' ? 'AUTHORITY_ACCEPTED' : 'AUTHORITY_REJECTED', unresolvedReason: null };
  const det = record.determinations.at(-1);
  if (det) {
    return { ...base, status: det.determination === 'DETERMINED_VALID' ? 'PROFESSIONALLY_DETERMINED_VALID' : 'PROFESSIONALLY_DETERMINED_DEFECTIVE', unresolvedReason: null };
  }
  return {
    ...base,
    status: 'UNDETERMINED',
    unresolvedReason: !dispatchConfirmed(sub) ? 'NOT_CONFIRMED_SENT' : !documented ? 'RECEIPT_NOT_DOCUMENTED' : 'NO_PROFESSIONAL_DETERMINATION',
  };
}
