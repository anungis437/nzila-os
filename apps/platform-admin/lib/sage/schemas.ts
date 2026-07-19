/**
 * Platform Admin — SAGE API schemas (zod)
 *
 * Request/response contracts for the SAGE platform-admin routes. The create
 * request accepts ONLY the fields a user may supply; orgId, actorId, createdBy,
 * and boundaryProfile are derived server-side and are rejected here via
 * `.strict()` (unknown/forbidden fields fail validation).
 */
import { z } from 'zod'
import {
  SAGE_INSTITUTION_TYPES,
  SAGE_RISK_SURFACES,
  SAGE_WORKSPACE_STATUSES,
  type SageInstitutionType,
  type SageRiskSurface,
  type SageWorkspaceStatus,
} from '@nzila/sage-core'

const institutionTypeEnum = z.enum(
  SAGE_INSTITUTION_TYPES as unknown as [SageInstitutionType, ...SageInstitutionType[]],
)
const riskSurfaceEnum = z.enum(
  SAGE_RISK_SURFACES as unknown as [SageRiskSurface, ...SageRiskSurface[]],
)
const workspaceStatusEnum = z.enum(
  SAGE_WORKSPACE_STATUSES as unknown as [SageWorkspaceStatus, ...SageWorkspaceStatus[]],
)

/**
 * Create-workspace request. `.strict()` rejects unknown fields — in particular
 * a client cannot smuggle `orgId`, `actorId`, `createdBy`, or `boundaryProfile`.
 */
export const CreateSageWorkspaceRequest = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(200, 'Name is too long'),
    institutionType: institutionTypeEnum,
    riskSurface: riskSurfaceEnum,
  })
  .strict()

export type CreateSageWorkspaceRequest = z.infer<typeof CreateSageWorkspaceRequest>

/** Minimal, browser-safe workspace shape (no audit internals, no raw SQL). */
export const SageWorkspaceResponse = z.object({
  id: z.string(),
  name: z.string(),
  status: workspaceStatusEnum,
  institutionType: institutionTypeEnum,
  riskSurface: riskSurfaceEnum,
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type SageWorkspaceResponse = z.infer<typeof SageWorkspaceResponse>

export const SageWorkspaceListResponse = z.object({
  workspaces: z.array(SageWorkspaceResponse),
})
export type SageWorkspaceListResponse = z.infer<typeof SageWorkspaceListResponse>

/** Boundary posture — structured, human-readable, no raw JSON. */
export const SageBoundaryProfileView = z.object({
  prohibitedUses: z.array(z.string()),
  excludedSourceClasses: z.array(z.string()),
  requiredReviewers: z.array(z.string()),
  exportRestrictions: z.array(z.string()),
})
export type SageBoundaryProfileView = z.infer<typeof SageBoundaryProfileView>

/** Workspace detail — identity + boundary posture (for the overview page). */
export const SageWorkspaceDetailResponse = SageWorkspaceResponse.extend({
  boundaryProfile: SageBoundaryProfileView,
})
export type SageWorkspaceDetailResponse = z.infer<typeof SageWorkspaceDetailResponse>

/** Counts-only summary. No score, rank, grade, certification, or conclusion. */
export const SageWorkspaceSummaryResponse = z.object({
  id: z.string(),
  name: z.string(),
  status: workspaceStatusEnum,
  institutionType: institutionTypeEnum,
  riskSurface: riskSurfaceEnum,
  counts: z.object({
    evidenceSources: z.number().int().nonnegative(),
    evidenceItems: z.number().int().nonnegative(),
    boundaryFlags: z.number().int().nonnegative(),
    decisionRecords: z.number().int().nonnegative(),
    openExportRequests: z.number().int().nonnegative(),
  }),
})
export type SageWorkspaceSummaryResponse = z.infer<typeof SageWorkspaceSummaryResponse>
