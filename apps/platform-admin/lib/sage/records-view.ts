/**
 * Platform Admin — SAGE Phase 8B records-lifecycle views (browser-safe mappers)
 *
 * Pure functions mapping sage-core records domain objects to browser-safe
 * response shapes. Raw storage references and package bytes are NEVER exposed —
 * only hashed references and safe codes cross this boundary.
 */
import type {
  SageExportDestructionEvidence,
  SageExportDestructionRequest,
  SageExportLegalHold,
  SageExportRetentionAssignment,
} from '@nzila/sage-core'
import type {
  SageDestructionEvidenceResponse,
  SageDestructionRequestResponse,
  SageLegalHoldResponse,
  SageRetentionAssignmentResponse,
} from './records-schemas'

export function toRetentionAssignmentResponse(
  a: SageExportRetentionAssignment,
): SageRetentionAssignmentResponse {
  return {
    id: a.id,
    exportPackageId: a.exportPackageId,
    policyCode: a.policyCode,
    policyVersion: a.policyVersion,
    retentionBasis: a.retentionBasis,
    retentionStartedAt: a.retentionStartedAt,
    retainUntil: a.retainUntil,
    assignedAt: a.assignedAt,
  }
}

export function toLegalHoldResponse(h: SageExportLegalHold): SageLegalHoldResponse {
  return {
    id: h.id,
    exportPackageId: h.exportPackageId,
    status: h.status,
    reason: h.reason,
    placedAt: h.placedAt,
    releasedAt: h.releasedAt ?? null,
    releaseReason: h.releaseReason ?? null,
  }
}

export function toDestructionRequestResponse(
  r: SageExportDestructionRequest,
  viewerActorId: string,
): SageDestructionRequestResponse {
  return {
    id: r.id,
    exportPackageId: r.exportPackageId,
    status: r.status,
    reason: r.reason,
    packageContentHash: r.packageContentHash,
    packageManifestHash: r.packageManifestHash,
    storageReferenceHash: r.storageReferenceHash,
    retentionPolicyCode: r.retentionPolicyCode,
    retentionPolicyVersion: r.retentionPolicyVersion,
    retainUntil: r.retainUntil,
    activeHoldCount: r.activeHoldCount,
    requestedAt: r.requestedAt,
    updatedAt: r.updatedAt,
    isOwnRequest: r.requestedBy === viewerActorId,
  }
}

export function toDestructionEvidenceResponse(
  e: SageExportDestructionEvidence,
): SageDestructionEvidenceResponse {
  return {
    id: e.id,
    destructionRequestId: e.destructionRequestId,
    exportPackageId: e.exportPackageId,
    storageProvider: e.storageProvider,
    storageReferenceHash: e.storageReferenceHash,
    preDestructionContentHash: e.preDestructionContentHash,
    preDestructionManifestHash: e.preDestructionManifestHash,
    deletionVerifiedAt: e.deletionVerifiedAt ?? null,
    verificationMethod: e.verificationMethod ?? null,
    result: e.result,
    safeErrorCode: e.safeErrorCode ?? null,
  }
}
