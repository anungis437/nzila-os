/**
 * Platform Admin — SAGE governance API schemas (zod)
 *
 * Request/response contracts for the Phase 6 human-governance routes (boundary
 * flags, review notes, decision records). Every request is `.strict()`, so a
 * browser can never smuggle server-derived identity or authority: orgId,
 * actorId, reviewerId, createdBy, resolvedBy, workspaceId (route-derived), an
 * audit action, a permission, an automatedDecision flag, or any score/rank/
 * certification field are all rejected here.
 *
 * The named human reviewer / resolver is ALWAYS derived from the authenticated
 * session server-side — there is no reviewer field in any request schema.
 */
import { z } from 'zod'
import {
  SAGE_AUTHORIZATION_LEVELS,
  SAGE_BOUNDARY_FLAG_STATUSES,
  SAGE_BOUNDARY_FLAG_TYPES,
  SAGE_BOUNDARY_RESOLUTIONS,
  SAGE_GOVERNANCE_AUTHORIZATION_BASES,
  SAGE_GOVERNANCE_TARGET_TYPES,
  SAGE_REVIEW_NOTE_TYPES,
  type SageAuthorizationLevel,
  type SageBoundaryFlagStatus,
  type SageBoundaryFlagType,
  type SageBoundaryResolution,
  type SageGovernanceAuthorizationBasis,
  type SageGovernanceTargetType,
  type SageReviewNoteType,
} from '@nzila/sage-core'

const flagTypeEnum = z.enum(
  SAGE_BOUNDARY_FLAG_TYPES as unknown as [SageBoundaryFlagType, ...SageBoundaryFlagType[]],
)
const targetTypeEnum = z.enum(
  SAGE_GOVERNANCE_TARGET_TYPES as unknown as [
    SageGovernanceTargetType,
    ...SageGovernanceTargetType[],
  ],
)
const resolutionEnum = z.enum(
  SAGE_BOUNDARY_RESOLUTIONS as unknown as [SageBoundaryResolution, ...SageBoundaryResolution[]],
)
const noteTypeEnum = z.enum(
  SAGE_REVIEW_NOTE_TYPES as unknown as [SageReviewNoteType, ...SageReviewNoteType[]],
)
const flagStatusEnum = z.enum(
  SAGE_BOUNDARY_FLAG_STATUSES as unknown as [SageBoundaryFlagStatus, ...SageBoundaryFlagStatus[]],
)
const authorizationLevelEnum = z.enum(
  SAGE_AUTHORIZATION_LEVELS as unknown as [SageAuthorizationLevel, ...SageAuthorizationLevel[]],
)
const authorizationBasisEnum = z.enum(
  SAGE_GOVERNANCE_AUTHORIZATION_BASES as unknown as [
    SageGovernanceAuthorizationBasis,
    ...SageGovernanceAuthorizationBasis[],
  ],
)

const targetIdField = z.string().trim().uuid().optional()

// The author MAY request a stricter (more restrictive) authorization level; the
// server floors it to the derived minimum and REJECTS any downgrade. The browser
// can never set the final effective level directly — only ask to raise it.
const requestedAuthorizationLevelField = authorizationLevelEnum.optional()

// ─── Requests ────────────────────────────────────────────────────────────────

/** Open a boundary flag against the workspace or an accessible evidence target. */
export const CreateBoundaryFlagRequest = z
  .object({
    flagType: flagTypeEnum,
    targetType: targetTypeEnum,
    targetId: targetIdField,
    note: z.string().trim().max(4_000).optional(),
    requestedAuthorizationLevel: requestedAuthorizationLevelField,
  })
  .strict()
export type CreateBoundaryFlagRequest = z.infer<typeof CreateBoundaryFlagRequest>

/** Resolve or retain a boundary flag (flagId comes from the route). */
export const ResolveBoundaryFlagRequest = z
  .object({
    resolution: resolutionEnum,
    resolutionNote: z.string().trim().min(1, 'A resolution note is required').max(4_000),
    requestedAuthorizationLevel: requestedAuthorizationLevelField,
  })
  .strict()
export type ResolveBoundaryFlagRequest = z.infer<typeof ResolveBoundaryFlagRequest>

/** Record an attributed human review note (reviewer derived server-side). */
export const CreateReviewNoteRequest = z
  .object({
    noteType: noteTypeEnum,
    targetType: targetTypeEnum,
    targetId: targetIdField,
    note: z.string().trim().min(1, 'A note is required').max(8_000),
    requestedAuthorizationLevel: requestedAuthorizationLevelField,
  })
  .strict()
export type CreateReviewNoteRequest = z.infer<typeof CreateReviewNoteRequest>

/**
 * Create a named-human decision record. The reviewer identity is NOT accepted
 * here — it is derived from the authenticated session. Every field below is
 * explicitly human-authored; there is no automated/generated field.
 */
export const CreateDecisionRecordRequest = z
  .object({
    decision: z.string().trim().min(1, 'A decision statement is required').max(8_000),
    rationale: z.string().trim().max(20_000).optional(),
    uncertainty: z
      .string()
      .trim()
      .min(1, 'An uncertainty / limitations statement is required')
      .max(20_000),
    referencedEvidenceItemIds: z.array(z.string().trim().uuid()).max(500).optional(),
    referencedBoundaryFlagIds: z.array(z.string().trim().uuid()).max(500).optional(),
    requestedAuthorizationLevel: requestedAuthorizationLevelField,
  })
  .strict()
export type CreateDecisionRecordRequest = z.infer<typeof CreateDecisionRecordRequest>

// ─── Responses (browser-safe projections) ────────────────────────────────────

export const SageBoundaryFlagResponse = z.object({
  id: z.string(),
  flagType: flagTypeEnum,
  targetType: targetTypeEnum.nullable(),
  targetId: z.string().nullable(),
  note: z.string().nullable(),
  status: flagStatusEnum,
  authorizationLevel: authorizationLevelEnum,
  authorizationBasis: authorizationBasisEnum.nullable(),
  resolvedBy: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SageBoundaryFlagResponse = z.infer<typeof SageBoundaryFlagResponse>

export const SageBoundaryFlagListResponse = z.object({
  flags: z.array(SageBoundaryFlagResponse),
})
export type SageBoundaryFlagListResponse = z.infer<typeof SageBoundaryFlagListResponse>

export const SageReviewNoteResponse = z.object({
  id: z.string(),
  noteType: noteTypeEnum,
  targetType: targetTypeEnum.nullable(),
  targetId: z.string().nullable(),
  reviewerId: z.string(),
  note: z.string(),
  authorizationLevel: authorizationLevelEnum,
  authorizationBasis: authorizationBasisEnum.nullable(),
  createdAt: z.string(),
})
export type SageReviewNoteResponse = z.infer<typeof SageReviewNoteResponse>

export const SageReviewNoteListResponse = z.object({
  notes: z.array(SageReviewNoteResponse),
})
export type SageReviewNoteListResponse = z.infer<typeof SageReviewNoteListResponse>

export const SageDecisionRecordResponse = z.object({
  id: z.string(),
  decision: z.string(),
  rationale: z.string().nullable(),
  uncertainty: z.string().nullable(),
  humanReviewerId: z.string(),
  referencedEvidenceItemIds: z.array(z.string()),
  referencedBoundaryFlagIds: z.array(z.string()),
  authorizationLevel: authorizationLevelEnum,
  authorizationBasis: authorizationBasisEnum.nullable(),
  excludedFromExternalReview: z.boolean(),
  createdAt: z.string(),
})
export type SageDecisionRecordResponse = z.infer<typeof SageDecisionRecordResponse>

export const SageDecisionRecordListResponse = z.object({
  decisions: z.array(SageDecisionRecordResponse),
})
export type SageDecisionRecordListResponse = z.infer<typeof SageDecisionRecordListResponse>
