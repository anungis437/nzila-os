/**
 * Platform Admin — SAGE evidence API schemas (zod)
 *
 * Request/response contracts for the SAGE evidence routes. Every request is
 * `.strict()`, so a browser can never smuggle server-derived fields: orgId,
 * actorId, workspaceId (that comes from the route), sourceId of a classify call,
 * createdBy/updatedBy, boundaryProfile, lifecycle overrides, review/decision
 * data, authorization grants, or an audit action are all rejected here.
 *
 * The request shapes mirror the *minimal* inputs the `@nzila/sage-core` evidence
 * services actually accept — there are deliberately no free-text title/summary/
 * description fields in the evidence domain.
 */
import { z } from 'zod'
import {
  SAGE_AUTHORIZATION_LEVELS,
  SAGE_CONFIDENCE_LEVELS,
  SAGE_EVIDENCE_LIFECYCLE_STATES,
  SAGE_SOURCE_QUALITIES,
  SAGE_SOURCE_TYPES,
  type SageAuthorizationLevel,
  type SageConfidenceLevel,
  type SageEvidenceLifecycleState,
  type SageSourceQuality,
  type SageSourceType,
} from '@nzila/sage-core'

const sourceTypeEnum = z.enum(
  SAGE_SOURCE_TYPES as unknown as [SageSourceType, ...SageSourceType[]],
)
const sourceQualityEnum = z.enum(
  SAGE_SOURCE_QUALITIES as unknown as [SageSourceQuality, ...SageSourceQuality[]],
)
const authorizationLevelEnum = z.enum(
  SAGE_AUTHORIZATION_LEVELS as unknown as [SageAuthorizationLevel, ...SageAuthorizationLevel[]],
)
const confidenceLevelEnum = z.enum(
  SAGE_CONFIDENCE_LEVELS as unknown as [SageConfidenceLevel, ...SageConfidenceLevel[]],
)
const lifecycleStateEnum = z.enum(
  SAGE_EVIDENCE_LIFECYCLE_STATES as unknown as [
    SageEvidenceLifecycleState,
    ...SageEvidenceLifecycleState[],
  ],
)

// ─── Requests ────────────────────────────────────────────────────────────────

/** Register an evidence source. Classification happens later, as a separate step. */
export const CreateEvidenceSourceRequest = z
  .object({
    sourceType: sourceTypeEnum,
    containsPersonalInformation: z.boolean().optional(),
    containsSensitiveInformation: z.boolean().optional(),
  })
  .strict()
export type CreateEvidenceSourceRequest = z.infer<typeof CreateEvidenceSourceRequest>

/** Classify an already-registered source (sourceId comes from the route). */
export const ClassifyEvidenceSourceRequest = z
  .object({
    sourceQuality: sourceQualityEnum,
    authorizationLevel: authorizationLevelEnum,
  })
  .strict()
export type ClassifyEvidenceSourceRequest = z.infer<typeof ClassifyEvidenceSourceRequest>

/** Create an evidence item under a classified source. */
export const CreateEvidenceItemRequest = z
  .object({
    sourceId: z.string().trim().min(1, 'sourceId is required'),
    confidenceLevel: confidenceLevelEnum,
  })
  .strict()
export type CreateEvidenceItemRequest = z.infer<typeof CreateEvidenceItemRequest>

/**
 * Link an evidence item. The itemId comes from the route; the body carries no
 * user-supplied fields, so `.strict({})` rejects any smuggled attribute.
 */
export const LinkEvidenceItemRequest = z.object({}).strict()
export type LinkEvidenceItemRequest = z.infer<typeof LinkEvidenceItemRequest>

// ─── Responses (browser-safe projections) ────────────────────────────────────

export const SageEvidenceSourceResponse = z.object({
  id: z.string(),
  sourceType: sourceTypeEnum,
  sourceQuality: sourceQualityEnum.nullable(),
  authorizationLevel: authorizationLevelEnum,
  containsPersonalInformation: z.boolean(),
  containsSensitiveInformation: z.boolean(),
  classified: z.boolean(),
  createdAt: z.string(),
})
export type SageEvidenceSourceResponse = z.infer<typeof SageEvidenceSourceResponse>

export const SageEvidenceSourceListResponse = z.object({
  sources: z.array(SageEvidenceSourceResponse),
})
export type SageEvidenceSourceListResponse = z.infer<typeof SageEvidenceSourceListResponse>

export const SageEvidenceItemResponse = z.object({
  id: z.string(),
  sourceId: z.string(),
  lifecycleState: lifecycleStateEnum,
  confidenceLevel: confidenceLevelEnum.nullable(),
  excludedFromExternalReview: z.boolean(),
  humanReviewRequired: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SageEvidenceItemResponse = z.infer<typeof SageEvidenceItemResponse>

export const SageEvidenceItemListResponse = z.object({
  items: z.array(SageEvidenceItemResponse),
})
export type SageEvidenceItemListResponse = z.infer<typeof SageEvidenceItemListResponse>
