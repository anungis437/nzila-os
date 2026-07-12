/**
 * Platform Admin — SAGE view mappers (pure, server or client safe)
 *
 * Pure functions that map SAGE domain objects to the browser-safe response
 * shapes. Kept free of I/O so the view logic (including the "counts/status only,
 * no score/rank/grade/certification" guarantee) is unit-testable in isolation.
 */
import type { SageBoundaryProfile, SageWorkspace } from '@nzila/sage-core'
import type { SageWorkspaceSummary } from '@nzila/sage-core'
import type {
  SageBoundaryProfileView,
  SageWorkspaceDetailResponse,
  SageWorkspaceListResponse,
  SageWorkspaceResponse,
  SageWorkspaceSummaryResponse,
} from './schemas'

export function toWorkspaceResponse(ws: SageWorkspace): SageWorkspaceResponse {
  return {
    id: ws.id,
    name: ws.name,
    status: ws.status,
    institutionType: ws.institutionType,
    riskSurface: ws.riskSurface,
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
  }
}

export function toWorkspaceListResponse(
  workspaces: SageWorkspace[],
): SageWorkspaceListResponse {
  return { workspaces: workspaces.map(toWorkspaceResponse) }
}

export function toBoundaryProfileView(
  profile: SageBoundaryProfile,
): SageBoundaryProfileView {
  return {
    prohibitedUses: profile.prohibitedUses ?? [],
    excludedSourceClasses: profile.excludedSourceClasses ?? [],
    requiredReviewers: profile.requiredReviewers ?? [],
    exportRestrictions: profile.exportRestrictions ?? [],
  }
}

export function toWorkspaceDetailResponse(
  ws: SageWorkspace,
): SageWorkspaceDetailResponse {
  return {
    ...toWorkspaceResponse(ws),
    boundaryProfile: toBoundaryProfileView(ws.boundaryProfile),
  }
}

/**
 * Map the service summary to the API response. Deliberately emits only status
 * and counts — never a score, rank, grade, certification, or derived conclusion.
 */
export function toSummaryResponse(
  summary: SageWorkspaceSummary,
): SageWorkspaceSummaryResponse {
  return {
    id: summary.workspaceId,
    name: summary.name,
    status: summary.status,
    institutionType: summary.institutionType,
    riskSurface: summary.riskSurface,
    counts: {
      evidenceSources: summary.counts.evidenceSources,
      evidenceItems: summary.counts.evidenceItems,
      boundaryFlags: summary.counts.boundaryFlags,
      decisionRecords: summary.counts.decisionRecords,
      openExportRequests: summary.counts.openExportRequests,
    },
  }
}
