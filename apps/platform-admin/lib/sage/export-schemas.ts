/**
 * Platform Admin — SAGE export API schemas (zod)
 *
 * Request/response contracts for the Phase 7 controlled export workflow. Every
 * request is `.strict()`, so the browser can never smuggle server-derived
 * identity/authority/scope fields: orgId, workspaceId (route-derived),
 * requesterId, approverId, generatedBy, status, requestedScopeHash,
 * approvedScopeHash, packageHash, storageReference, deliveryDestination,
 * recipient, publicUrl, actorKind, and authenticationType are all rejected.
 *
 * External delivery is DISABLED: no recipient/destination/publicUrl field exists
 * anywhere in these contracts.
 */
import { z } from 'zod'
import {
  SAGE_EXPORT_PACKAGE_TYPES,
  SAGE_EXPORT_STATUSES,
  type SageExportPackageType,
  type SageExportStatus,
} from '@nzila/sage-core'

const packageTypeEnum = z.enum(
  SAGE_EXPORT_PACKAGE_TYPES as unknown as [SageExportPackageType, ...SageExportPackageType[]],
)
const statusEnum = z.enum(
  SAGE_EXPORT_STATUSES as unknown as [SageExportStatus, ...SageExportStatus[]],
)

// Resource ids are validated for existence + access server-side (the real gate);
// here we only bound them defensively.
const idList = z.array(z.string().trim().min(1).max(200)).max(500).optional()

// ─── Requests ────────────────────────────────────────────────────────────────

/** Open an export request over an explicit evidence/governance scope. */
export const CreateExportRequestRequest = z
  .object({
    purpose: z.string().trim().min(1, 'A purpose is required').max(4_000),
    packageType: packageTypeEnum.optional(),
    evidenceItemIds: idList,
    boundaryFlagIds: idList,
    reviewNoteIds: idList,
    decisionRecordIds: idList,
  })
  .strict()
export type CreateExportRequestRequest = z.infer<typeof CreateExportRequestRequest>

/** Approve another user's request (rationale required; identity derived server-side). */
export const ApproveExportRequestRequest = z
  .object({
    rationale: z.string().trim().min(1, 'An approval rationale is required').max(8_000),
  })
  .strict()
export type ApproveExportRequestRequest = z.infer<typeof ApproveExportRequestRequest>

/** Deny another user's request (rationale required). */
export const DenyExportRequestRequest = z
  .object({
    rationale: z.string().trim().min(1, 'A denial rationale is required').max(8_000),
  })
  .strict()
export type DenyExportRequestRequest = z.infer<typeof DenyExportRequestRequest>

/** Generate the immutable package for an approved request (no body fields). */
export const GenerateExportPackageRequest = z.object({}).strict()
export type GenerateExportPackageRequest = z.infer<typeof GenerateExportPackageRequest>

// ─── Responses (browser-safe projections) ────────────────────────────────────

export const SageExportRequestResponse = z.object({
  id: z.string(),
  requestedBy: z.string(),
  purpose: z.string().nullable(),
  packageType: packageTypeEnum,
  status: statusEnum,
  requestedScopeHash: z.string().nullable(),
  policyVersion: z.string().nullable(),
  itemCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
})
export type SageExportRequestResponse = z.infer<typeof SageExportRequestResponse>

export const SageExportRequestListResponse = z.object({
  requests: z.array(SageExportRequestResponse),
})
export type SageExportRequestListResponse = z.infer<typeof SageExportRequestListResponse>

export const SageExportApprovalResponse = z.object({
  id: z.string(),
  exportRequestId: z.string(),
  approverId: z.string(),
  decision: z.string(),
  decisionAt: z.string(),
  approvedScopeHash: z.string().nullable(),
})
export type SageExportApprovalResponse = z.infer<typeof SageExportApprovalResponse>

export const SageExportApprovalListResponse = z.object({
  approvals: z.array(SageExportApprovalResponse),
})
export type SageExportApprovalListResponse = z.infer<typeof SageExportApprovalListResponse>

export const SageExportPackageResponse = z.object({
  id: z.string(),
  exportRequestId: z.string(),
  status: z.string(),
  packageType: packageTypeEnum,
  manifestHash: z.string(),
  contentHash: z.string(),
  mediaType: z.string(),
  sizeBytes: z.number(),
  policyVersion: z.string(),
  itemCount: z.number(),
  excludedCount: z.number(),
  generatedBy: z.string(),
  generatedAt: z.string(),
})
export type SageExportPackageResponse = z.infer<typeof SageExportPackageResponse>

export const SageExportPackageListResponse = z.object({
  packages: z.array(SageExportPackageResponse),
})
export type SageExportPackageListResponse = z.infer<typeof SageExportPackageListResponse>
