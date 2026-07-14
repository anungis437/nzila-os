/**
 * Platform Admin — SAGE export view mappers (pure, server or client safe)
 *
 * Pure projections from SAGE export domain objects to browser-safe response
 * shapes. No I/O. Emits only factual attributes, hashes, and status — never the
 * canonical scope JSON narrative, storage credentials, or any delivery field.
 */
import type {
  SageExportApproval,
  SageExportPackage,
  SageExportRequest,
} from '@nzila/sage-core'
import type {
  SageExportApprovalListResponse,
  SageExportApprovalResponse,
  SageExportPackageListResponse,
  SageExportPackageResponse,
  SageExportRequestListResponse,
  SageExportRequestResponse,
} from './export-schemas'

function scopeItemCount(req: SageExportRequest): number {
  if (!req.requestedScopeJson) return 0
  try {
    const parsed = JSON.parse(req.requestedScopeJson) as { items?: unknown[] }
    return Array.isArray(parsed.items) ? parsed.items.length : 0
  } catch {
    return 0
  }
}

export function toExportRequestResponse(req: SageExportRequest): SageExportRequestResponse {
  return {
    id: req.id,
    requestedBy: req.requestedBy,
    purpose: req.purpose ?? null,
    packageType: req.packageType,
    status: req.status,
    requestedScopeHash: req.requestedScopeHash ?? null,
    policyVersion: req.policyVersion ?? null,
    itemCount: scopeItemCount(req),
    createdAt: req.createdAt,
    updatedAt: req.updatedAt ?? null,
  }
}

export function toExportRequestListResponse(
  requests: SageExportRequest[],
): SageExportRequestListResponse {
  return { requests: requests.map(toExportRequestResponse) }
}

export function toExportApprovalResponse(a: SageExportApproval): SageExportApprovalResponse {
  return {
    id: a.id,
    exportRequestId: a.exportRequestId,
    approverId: a.approverId,
    decision: a.decision,
    decisionAt: a.decisionAt,
    approvedScopeHash: a.approvedScopeHash ?? null,
  }
}

export function toExportApprovalListResponse(
  approvals: SageExportApproval[],
): SageExportApprovalListResponse {
  return { approvals: approvals.map(toExportApprovalResponse) }
}

export function toExportPackageResponse(pkg: SageExportPackage): SageExportPackageResponse {
  return {
    id: pkg.id,
    exportRequestId: pkg.exportRequestId,
    status: pkg.status,
    packageType: pkg.packageType,
    manifestHash: pkg.manifestHash,
    contentHash: pkg.contentHash,
    mediaType: pkg.mediaType,
    sizeBytes: pkg.sizeBytes,
    policyVersion: pkg.policyVersion,
    itemCount: pkg.itemCount,
    excludedCount: pkg.excludedCount,
    generatedBy: pkg.generatedBy,
    generatedAt: pkg.generatedAt,
    availabilityStatus: pkg.availabilityStatus ?? 'available',
  }
}

export function toExportPackageListResponse(
  packages: SageExportPackage[],
): SageExportPackageListResponse {
  return { packages: packages.map(toExportPackageResponse) }
}
