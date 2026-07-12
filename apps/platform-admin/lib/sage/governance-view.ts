/**
 * Platform Admin — SAGE governance view mappers (pure, server or client safe)
 *
 * Pure projections from SAGE governance domain objects to browser-safe response
 * shapes. No I/O, no audit internals. Emit only factual attributes and the
 * lifecycle status — never a score, rank, grade, certification, or conclusion.
 */
import type { SageBoundaryFlag, SageDecisionRecord, SageReviewNote } from '@nzila/sage-core'
import type {
  SageBoundaryFlagListResponse,
  SageBoundaryFlagResponse,
  SageDecisionRecordListResponse,
  SageDecisionRecordResponse,
  SageReviewNoteListResponse,
  SageReviewNoteResponse,
} from './governance-schemas'

export function toBoundaryFlagResponse(flag: SageBoundaryFlag): SageBoundaryFlagResponse {
  return {
    id: flag.id,
    flagType: flag.flagType,
    targetType: flag.targetType ?? null,
    targetId: flag.targetId ?? null,
    note: flag.note ?? null,
    status: flag.status,
    authorizationLevel: flag.authorizationLevel,
    authorizationBasis: flag.authorizationBasis ?? null,
    resolvedBy: flag.resolvedBy ?? null,
    resolutionNote: flag.resolutionNote ?? null,
    resolvedAt: flag.resolvedAt ?? null,
    createdBy: flag.createdBy,
    createdAt: flag.createdAt,
    updatedAt: flag.updatedAt,
  }
}

export function toBoundaryFlagListResponse(
  flags: SageBoundaryFlag[],
): SageBoundaryFlagListResponse {
  return { flags: flags.map(toBoundaryFlagResponse) }
}

export function toReviewNoteResponse(note: SageReviewNote): SageReviewNoteResponse {
  return {
    id: note.id,
    noteType: note.noteType,
    targetType: note.targetType ?? null,
    targetId: note.targetId ?? null,
    reviewerId: note.reviewerId,
    note: note.note,
    authorizationLevel: note.authorizationLevel,
    authorizationBasis: note.authorizationBasis ?? null,
    createdAt: note.createdAt,
  }
}

export function toReviewNoteListResponse(notes: SageReviewNote[]): SageReviewNoteListResponse {
  return { notes: notes.map(toReviewNoteResponse) }
}

export function toDecisionRecordResponse(
  record: SageDecisionRecord,
): SageDecisionRecordResponse {
  return {
    id: record.id,
    decision: record.decision,
    rationale: record.rationale ?? null,
    uncertainty: record.uncertainty ?? null,
    humanReviewerId: record.humanReviewerId,
    referencedEvidenceItemIds: record.referencedEvidenceItemIds,
    referencedBoundaryFlagIds: record.referencedBoundaryFlagIds,
    authorizationLevel: record.authorizationLevel,
    authorizationBasis: record.authorizationBasis ?? null,
    excludedFromExternalReview: record.excludedFromExternalReview,
    createdAt: record.createdAt,
  }
}

export function toDecisionRecordListResponse(
  records: SageDecisionRecord[],
): SageDecisionRecordListResponse {
  return { decisions: records.map(toDecisionRecordResponse) }
}
