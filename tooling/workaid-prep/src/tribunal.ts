import type { ClaimId, DocumentId, MatterId, UserId } from './ids.ts';
import type { Decision } from './authorization.ts';
import type { Principal, Role } from './principal.ts';
import { hasAnyRole } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';

/**
 * Tribunal (WSIAT) boundary. This records WHO decided WHAT about whether to
 * proceed; it contains no procedure, no form names, no deadlines and no rule.
 * The system never decides to appeal, never files, and never calculates a time
 * limit. What triggers an assessment and who may make it are open decisions
 * (D-06, D-23); the trigger here is deliberately conservative and the roles are
 * a required policy input.
 */
export type AroOutcome = 'FAVOURABLE' | 'ADVERSE' | 'MIXED' | 'UNKNOWN';

export type AssessmentStatus = 'NEEDS_PROFESSIONAL_ASSESSMENT' | 'ASSESSED_PROCEEDING' | 'ASSESSED_NOT_PROCEEDING' | 'ASSESSED_NEEDS_MORE_INFORMATION';

export interface TribunalAssessment {
  readonly id: string;
  readonly matterId: MatterId;
  readonly claimId: ClaimId;
  /** The final WSIB decision document the assessment is about. */
  readonly finalDecisionDocumentId: DocumentId | null;
  readonly aroOutcome: AroOutcome;
  readonly status: AssessmentStatus;
  readonly openedAt: string;
  readonly assessedBy: UserId | null;
  readonly assessedAt: string | null;
  readonly reasoning: string | null;
  /** Always absent: the system states no tribunal time limit. */
  readonly timeLimit: null;
}

export type TribunalError = 'NOT_AUTHORIZED' | 'ASSESSOR_MISMATCH' | 'AUTHORITY_DENIED' | 'FINAL_DECISION_DOCUMENT_REQUIRED' | 'REASONING_REQUIRED' | 'ALREADY_ASSESSED' | 'NO_ASSESSMENT_NEEDED' | 'NOT_PROCEEDING';

/** Opens a PROMPT for professional assessment for any outcome other than a recorded favourable one. Never opens a filing. */
export function openAssessmentIfIndicated(input: {
  id: string;
  matterId: MatterId;
  claimId: ClaimId;
  aroOutcome: AroOutcome;
  finalDecisionDocumentId: DocumentId | null;
  now: string;
}): Result<TribunalAssessment, TribunalError> {
  if (input.aroOutcome === 'FAVOURABLE') return err('NO_ASSESSMENT_NEEDED', 'recorded outcome is favourable; no prompt opened');
  return ok({
    id: input.id,
    matterId: input.matterId,
    claimId: input.claimId,
    finalDecisionDocumentId: input.finalDecisionDocumentId,
    aroOutcome: input.aroOutcome,
    status: 'NEEDS_PROFESSIONAL_ASSESSMENT',
    openedAt: input.now,
    assessedBy: null,
    assessedAt: null,
    reasoning: null,
    timeLimit: null,
  });
}

export function recordAssessment(input: {
  principal: Principal;
  claimedAssessor: string;
  roles: readonly Role[];
  professionalAuth: Decision;
  assessment: TribunalAssessment;
  decision: Exclude<AssessmentStatus, 'NEEDS_PROFESSIONAL_ASSESSMENT'>;
  finalDecisionDocumentId: DocumentId | null;
  reasoning: string;
  now: string;
}): Result<TribunalAssessment, TribunalError> {
  if (!hasAnyRole(input.principal, input.roles)) return err('NOT_AUTHORIZED', 'role may not make a tribunal assessment');
  if (input.claimedAssessor !== input.principal.userId) return err('ASSESSOR_MISMATCH', 'asserted assessor does not match the authenticated principal');
  if (!input.professionalAuth.allow) return err('AUTHORITY_DENIED', 'professional action not authorized for this matter');
  if (input.assessment.status !== 'NEEDS_PROFESSIONAL_ASSESSMENT') return err('ALREADY_ASSESSED', 'assessment already recorded; record a new prompt to revisit');
  const doc = input.finalDecisionDocumentId ?? input.assessment.finalDecisionDocumentId;
  if (!doc) return err('FINAL_DECISION_DOCUMENT_REQUIRED', 'link the final WSIB decision document');
  if (input.reasoning.trim().length < 20) return err('REASONING_REQUIRED', 'record the reasoning');
  return ok({ ...input.assessment, status: input.decision, finalDecisionDocumentId: doc, assessedBy: input.principal.userId, assessedAt: input.now, reasoning: input.reasoning });
}

/** A tribunal submission may only be prepared after a professional assessed "proceeding". */
export function mayPrepareTribunalSubmission(a: TribunalAssessment | undefined): Result<true, TribunalError> {
  if (!a || a.status !== 'ASSESSED_PROCEEDING') return err('NOT_PROCEEDING', 'no professional assessment of "proceeding" exists');
  return ok(true);
}
