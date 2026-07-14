// ─── @nzila/sage-core — Phase 8B records-lifecycle services ──────────────────
// Retention assignment, legal holds, independently-approved destruction,
// verified object deletion, and immutable destruction evidence for immutable
// export packages. Default posture is RETAIN; destruction is tightly gated and
// requires two different named humans plus independent absence verification.

import { SAGE_PERMISSIONS } from './permissions'
import {
  SAGE_AUDIT_ACTIONS,
  SAGE_AUDIT_RESOURCES,
} from './audit-events'
import { conflict, forbidden, invalidInput, notFound } from './service-errors'
import { assertDestructionRequesterCannotApproveOwn } from './invariants'
import { contextNow, type SageServiceContext } from './service-context'
import {
  authorizeSageWorkspaceAccess,
  dispatchOutboxEvent,
  type SageServiceDeps,
} from './services'
import { verifySageExportPackageBytes } from './export-package'
import { sha256Hex } from './export-scope'
import {
  computeActiveHoldSetDigest,
  computeSageRetainUntil,
  evaluateSageExportDestructionEligibility,
  hashSageStorageReference,
  sageLegalHoldCode,
} from './records-lifecycle'
import type {
  SageExportDestructionEligibility,
  SageExportDestructionApproval,
  SageExportDestructionEvidence,
  SageExportDestructionRequest,
  SageExportLegalHold,
  SageExportRetentionAssignment,
  SageDestructionResult,
  SageRetentionBasis,
  SageRetentionPolicy,
} from './records-types'

function recordsEventId(kind: string, ...parts: string[]): string {
  return sha256Hex(`sage-records:${kind}:${parts.join(':')}`)
}

function assertActorIsHuman(ctx: SageServiceContext): void {
  if (ctx.actor.actorKind !== 'human') {
    forbidden('this records-lifecycle action requires a named human actor')
  }
}

const DEFAULT_STORAGE_PROVIDER = 'sage-internal'
const DESTRUCTION_LEASE_MS = 60_000

// ── Retention policy management (versioned; historical versions immutable) ───
export async function createSageRetentionPolicy(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    policyCode: string
    version: number
    name: string
    description?: string | null
    retentionBasis: SageRetentionBasis
    retentionDurationDays: number
    effectiveFrom?: string
  },
): Promise<SageRetentionPolicy> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_RETENTION_ASSIGN,
  })
  assertActorIsHuman(ctx)
  const code = input.policyCode.trim()
  if (!code) invalidInput('a retention policy code is required')
  if (!Number.isInteger(input.version) || input.version < 1) {
    invalidInput('a retention policy version must be a positive integer')
  }
  if (!Number.isInteger(input.retentionDurationDays) || input.retentionDurationDays < 0) {
    invalidInput('a retention duration in days is required')
  }
  const ts = contextNow(ctx)
  return deps.repo.createRetentionPolicy({
    orgId: ws.orgId,
    policyCode: code,
    version: input.version,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    retentionBasis: input.retentionBasis,
    retentionDurationDays: input.retentionDurationDays,
    effectiveFrom: input.effectiveFrom ?? ts,
    effectiveTo: null,
    isActive: true,
    createdBy: ctx.actor.actorId,
    createdAt: ts,
  })
}

export async function listSageRetentionPolicies(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string },
): Promise<SageRetentionPolicy[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  })
  return deps.repo.listRetentionPolicies(ws.orgId)
}

// ── Retention assignment (one authoritative assignment per package) ──────────
export async function assignSageExportRetentionPolicy(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    packageId: string
    policyCode: string
    /** Required only for the 'event_date' basis; the authorized event source. */
    eventDate?: string | null
    eventSourceId?: string | null
    /** Required only for the 'delivered_at' basis; the authoritative receipt. */
    firstDeliveredAt?: string | null
    firstDeliveredReceiptId?: string | null
  },
): Promise<SageExportRetentionAssignment> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_RETENTION_ASSIGN,
  })
  assertActorIsHuman(ctx)

  const pkg = await deps.repo.getExportPackage(input.packageId, ws.id, ws.orgId)
  if (!pkg) notFound('export package')
  if ((pkg.availabilityStatus ?? 'available') === 'destroyed') {
    conflict('the package is already destroyed')
  }
  const existing = await deps.repo.getRetentionAssignment(pkg.id, ws.id, ws.orgId)
  if (existing) conflict('the package already has a retention assignment')

  const policy = await deps.repo.getActiveRetentionPolicyByCode(ws.orgId, input.policyCode.trim())
  if (!policy) notFound('active retention policy')

  if (policy.retentionBasis === 'event_date' && (!input.eventDate || !input.eventSourceId)) {
    invalidInput('this retention policy requires a validated event source id and date')
  }
  if (policy.retentionBasis === 'delivered_at' && (!input.firstDeliveredAt || !input.firstDeliveredReceiptId)) {
    invalidInput('this retention policy requires the authoritative delivery receipt id and timestamp')
  }
  const { retentionStartedAt, retainUntil, retentionBasisSourceId, retentionBasisSourceTimestamp } =
    computeSageRetainUntil({
      retentionBasis: policy.retentionBasis,
      retentionDurationDays: policy.retentionDurationDays,
      exportPackageId: pkg.id,
      packageGeneratedAt: pkg.generatedAt,
      firstDeliveredAt: input.firstDeliveredAt ?? null,
      firstDeliveredReceiptId: input.firstDeliveredReceiptId ?? null,
      eventDate: input.eventDate ?? null,
      eventSourceId: input.eventSourceId ?? null,
    })

  const ts = contextNow(ctx)
  const eventId = recordsEventId('retention_assigned', pkg.id, policy.id, ts)
  const result = await deps.repo.assignRetentionPolicy({
    assignment: {
      orgId: ws.orgId,
      workspaceId: ws.id,
      exportPackageId: pkg.id,
      retentionPolicyId: policy.id,
      policyCode: policy.policyCode,
      policyVersion: policy.version,
      retentionBasis: policy.retentionBasis,
      retentionStartedAt,
      retainUntil,
      assignedBy: ctx.actor.actorId,
      assignedAt: ts,
      retentionBasisSourceType: policy.retentionBasis,
      retentionBasisSourceId,
      retentionBasisSourceTimestamp,
    },
    auditEvent: {
      eventId,
      actorId: ctx.actor.actorId,
      action: SAGE_AUDIT_ACTIONS.EXPORT_RETENTION_ASSIGNED,
      resourceType: SAGE_AUDIT_RESOURCES.RETENTION_ASSIGNMENT,
      safePayload: {
        exportPackageId: pkg.id,
        policyCode: policy.policyCode,
        policyVersion: policy.version,
        retainUntil,
      },
    },
  })
  if (!result.created) conflict('the package already has a retention assignment')
  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: ctx.actor.actorId,
    orgId: ws.orgId,
    action: SAGE_AUDIT_ACTIONS.EXPORT_RETENTION_ASSIGNED,
    resource: SAGE_AUDIT_RESOURCES.RETENTION_ASSIGNMENT,
    resourceId: pkg.id,
    payload: {
      exportPackageId: pkg.id,
      policyCode: policy.policyCode,
      policyVersion: policy.version,
      retainUntil,
    },
    at: ts,
  })
  return result.assignment
}

export async function getSageExportRetentionAssignment(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; packageId: string },
): Promise<SageExportRetentionAssignment | undefined> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  })
  return deps.repo.getRetentionAssignment(input.packageId, ws.id, ws.orgId)
}

// ── Legal holds ──────────────────────────────────────────────────────────────
export async function placeSageExportLegalHold(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; packageId: string; reason: string },
): Promise<SageExportLegalHold> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_LEGAL_HOLD_MANAGE,
  })
  assertActorIsHuman(ctx)
  const reason = input.reason?.trim()
  if (!reason) invalidInput('a legal hold reason is required')
  const pkg = await deps.repo.getExportPackage(input.packageId, ws.id, ws.orgId)
  if (!pkg) notFound('export package')

  // Point of no return: once destruction has crossed deletion_started, a hold can
  // no longer be placed (the delete may already have happened).
  const openRequest = await deps.repo.getOpenDestructionRequestForPackage(pkg.id, ws.id, ws.orgId)
  if (openRequest && (openRequest.status === 'deletion_started')) {
    conflict('a legal hold cannot be placed: destruction has already begun for this package')
  }

  const ts = contextNow(ctx)
  const holdCode = sageLegalHoldCode({ exportPackageId: pkg.id, nonce: recordsEventId('hold', pkg.id, ctx.actor.actorId, ts) })
  const eventId = recordsEventId('legal_hold_placed', pkg.id, holdCode, ts)
  const hold = await deps.repo.placeLegalHold({
    hold: {
      orgId: ws.orgId,
      workspaceId: ws.id,
      exportPackageId: pkg.id,
      holdCode,
      status: 'active',
      reason,
      placedBy: ctx.actor.actorId,
      placedAt: ts,
      releasedBy: null,
      releasedAt: null,
      releaseReason: null,
    },
    auditEvent: {
      eventId,
      actorId: ctx.actor.actorId,
      action: SAGE_AUDIT_ACTIONS.EXPORT_LEGAL_HOLD_PLACED,
      resourceType: SAGE_AUDIT_RESOURCES.LEGAL_HOLD,
      safePayload: { exportPackageId: pkg.id, holdId: holdCode },
    },
  })
  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: ctx.actor.actorId,
    orgId: ws.orgId,
    action: SAGE_AUDIT_ACTIONS.EXPORT_LEGAL_HOLD_PLACED,
    resource: SAGE_AUDIT_RESOURCES.LEGAL_HOLD,
    resourceId: pkg.id,
    payload: { exportPackageId: pkg.id, holdId: hold.id },
    at: ts,
  })
  return hold
}

export async function releaseSageExportLegalHold(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; holdId: string; releaseReason: string },
): Promise<SageExportLegalHold> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_LEGAL_HOLD_MANAGE,
  })
  assertActorIsHuman(ctx)
  const releaseReason = input.releaseReason?.trim()
  if (!releaseReason) invalidInput('a release reason is required')

  const ts = contextNow(ctx)
  const eventId = recordsEventId('legal_hold_released', input.holdId, ts)
  const released = await deps.repo.releaseLegalHold({
    holdId: input.holdId,
    workspaceId: ws.id,
    orgId: ws.orgId,
    releasedBy: ctx.actor.actorId,
    releasedAt: ts,
    releaseReason,
    auditEvent: {
      eventId,
      actorId: ctx.actor.actorId,
      action: SAGE_AUDIT_ACTIONS.EXPORT_LEGAL_HOLD_RELEASED,
      resourceType: SAGE_AUDIT_RESOURCES.LEGAL_HOLD,
      safePayload: { holdId: input.holdId },
    },
  })
  if (!released) conflict('the legal hold is not active or was concurrently released')
  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: ctx.actor.actorId,
    orgId: ws.orgId,
    action: SAGE_AUDIT_ACTIONS.EXPORT_LEGAL_HOLD_RELEASED,
    resource: SAGE_AUDIT_RESOURCES.LEGAL_HOLD,
    resourceId: released.exportPackageId,
    payload: { holdId: released.id, exportPackageId: released.exportPackageId },
    at: ts,
  })
  return released
}

export async function listSageExportLegalHolds(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; packageId: string },
): Promise<SageExportLegalHold[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  })
  return deps.repo.listLegalHolds(input.packageId, ws.id, ws.orgId)
}

// ── Destruction eligibility (evaluates persisted controls; destroys nothing) ─
export async function getSageExportDestructionEligibility(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; packageId: string },
): Promise<SageExportDestructionEligibility> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  })
  const pkg = await deps.repo.getExportPackage(input.packageId, ws.id, ws.orgId)
  if (!pkg) notFound('export package')
  const retention = await deps.repo.getRetentionAssignment(pkg.id, ws.id, ws.orgId)
  const legalHolds = await deps.repo.listLegalHolds(pkg.id, ws.id, ws.orgId)
  return evaluateSageExportDestructionEligibility({
    availabilityStatus: pkg.availabilityStatus ?? 'available',
    retention,
    legalHolds,
    now: new Date(contextNow(ctx)),
  })
}

// ── Destruction request / independent approval ───────────────────────────────
export async function requestSageExportDestruction(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; packageId: string; reason: string },
): Promise<SageExportDestructionRequest> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DESTRUCTION_REQUEST,
  })
  assertActorIsHuman(ctx)
  const reason = input.reason?.trim()
  if (!reason) invalidInput('a destruction reason is required')

  const pkg = await deps.repo.getExportPackage(input.packageId, ws.id, ws.orgId)
  if (!pkg) notFound('export package')
  const retention = await deps.repo.getRetentionAssignment(pkg.id, ws.id, ws.orgId)
  const legalHolds = await deps.repo.listLegalHolds(pkg.id, ws.id, ws.orgId)
  const eligibility = evaluateSageExportDestructionEligibility({
    availabilityStatus: pkg.availabilityStatus ?? 'available',
    retention,
    legalHolds,
    now: new Date(contextNow(ctx)),
  })
  if (!eligibility.eligible || !retention) {
    conflict(`the package is not eligible for destruction: ${eligibility.reasonCodes.join(', ')}`)
  }

  const ts = contextNow(ctx)
  const storageReferenceHash = hashSageStorageReference(pkg.storageReference)
  const activeHoldSetDigest = computeActiveHoldSetDigest(legalHolds)
  const eventId = recordsEventId('destruction_requested', pkg.id, ctx.actor.actorId, ts)
  const request = await deps.repo.createDestructionRequest({
    request: {
      orgId: ws.orgId,
      workspaceId: ws.id,
      exportPackageId: pkg.id,
      requestedBy: ctx.actor.actorId,
      reason,
      status: 'requested',
      packageContentHash: pkg.contentHash,
      packageManifestHash: pkg.manifestHash,
      storageReferenceHash,
      retentionPolicyCode: retention.policyCode,
      retentionPolicyVersion: retention.policyVersion,
      retainUntil: retention.retainUntil,
      activeHoldCount: eligibility.activeHoldCount,
      activeHoldSetDigest,
      executionOwner: null,
      leaseExpiresAt: null,
      deletionStartedAt: null,
      currentAttemptId: null,
      destructionEvidenceId: null,
      requestedAt: ts,
      updatedAt: ts,
    },
    auditEvent: {
      eventId,
      actorId: ctx.actor.actorId,
      action: SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_REQUESTED,
      resourceType: SAGE_AUDIT_RESOURCES.DESTRUCTION_REQUEST,
      safePayload: {
        exportPackageId: pkg.id,
        contentHash: pkg.contentHash,
        manifestHash: pkg.manifestHash,
        storageReferenceHash,
        retentionPolicyCode: retention.policyCode,
        retentionPolicyVersion: retention.policyVersion,
        retainUntil: retention.retainUntil,
      },
    },
  })
  if (!request) conflict('an open destruction request already exists for this package')
  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: ctx.actor.actorId,
    orgId: ws.orgId,
    action: SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_REQUESTED,
    resource: SAGE_AUDIT_RESOURCES.DESTRUCTION_REQUEST,
    resourceId: request.id,
    payload: { exportPackageId: pkg.id, destructionRequestId: request.id },
    at: ts,
  })
  return request
}

async function decideDestruction(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; requestId: string; decision: 'approved' | 'denied'; rationale?: string | null },
): Promise<{ request: SageExportDestructionRequest; approval: SageExportDestructionApproval }> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DESTRUCTION_APPROVE,
  })
  assertActorIsHuman(ctx)

  const request = await deps.repo.getDestructionRequest(input.requestId, ws.id, ws.orgId)
  if (!request) notFound('destruction request')
  if (request.status !== 'requested') conflict('the destruction request is not awaiting a decision')
  // Requester and approver must be different named humans.
  assertDestructionRequesterCannotApproveOwn({
    requestedBy: request.requestedBy,
    approverId: ctx.actor.actorId,
  })

  const pkg = await deps.repo.getExportPackage(request.exportPackageId, ws.id, ws.orgId)
  if (!pkg) notFound('export package')

  const ts = contextNow(ctx)
  let approvedActiveHoldSetDigest: string | null = request.activeHoldSetDigest ?? null

  if (input.decision === 'approved') {
    // Approval recomputes EVERY frozen value; any drift is a CONFLICT.
    const retention = await deps.repo.getRetentionAssignment(pkg.id, ws.id, ws.orgId)
    const legalHolds = await deps.repo.listLegalHolds(pkg.id, ws.id, ws.orgId)
    const eligibility = evaluateSageExportDestructionEligibility({
      availabilityStatus: pkg.availabilityStatus ?? 'available',
      retention,
      legalHolds,
      now: new Date(ts),
    })
    const storageReferenceHash = hashSageStorageReference(pkg.storageReference)
    const holdSetDigest = computeActiveHoldSetDigest(legalHolds)
    approvedActiveHoldSetDigest = holdSetDigest
    const drift: string[] = []
    if (pkg.contentHash !== request.packageContentHash) drift.push('content hash')
    if (pkg.manifestHash !== request.packageManifestHash) drift.push('manifest hash')
    if (storageReferenceHash !== request.storageReferenceHash) drift.push('storage reference')
    // Exact active-hold SET digest — adding OR releasing a hold since request invalidates approval.
    if (request.activeHoldSetDigest && holdSetDigest !== request.activeHoldSetDigest) {
      drift.push('active legal-hold set')
    }
    if (!retention) drift.push('retention assignment')
    else {
      if (retention.policyCode !== request.retentionPolicyCode) drift.push('retention policy code')
      if (retention.policyVersion !== request.retentionPolicyVersion) drift.push('retention policy version')
      if (retention.retainUntil !== request.retainUntil) drift.push('retain until')
    }
    if (drift.length > 0) conflict(`the destruction scope has drifted: ${drift.join(', ')}`)
    if (!eligibility.eligible) {
      conflict(`the package is no longer eligible for destruction: ${eligibility.reasonCodes.join(', ')}`)
    }
  }

  const eventId = recordsEventId(`destruction_${input.decision}`, request.id, ctx.actor.actorId, ts)
  const action =
    input.decision === 'approved'
      ? SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_APPROVED
      : SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_DENIED
  const decided = await deps.repo.decideDestructionRequest({
    destructionRequestId: request.id,
    workspaceId: ws.id,
    orgId: ws.orgId,
    decision: input.decision,
    updatedAt: ts,
    approval: {
      orgId: ws.orgId,
      workspaceId: ws.id,
      destructionRequestId: request.id,
      decision: input.decision,
      approverId: ctx.actor.actorId,
      rationale: input.rationale?.trim() || null,
      approvedPackageContentHash: request.packageContentHash,
      approvedManifestHash: request.packageManifestHash,
      approvedStorageReferenceHash: request.storageReferenceHash,
      approvedRetentionPolicyCode: request.retentionPolicyCode,
      approvedRetentionPolicyVersion: request.retentionPolicyVersion,
      approvedRetainUntil: request.retainUntil,
      approvedActiveHoldCount: request.activeHoldCount,
      approvedActiveHoldSetDigest,
      decidedAt: ts,
    },
    auditEvent: {
      eventId,
      actorId: ctx.actor.actorId,
      action,
      resourceType: SAGE_AUDIT_RESOURCES.DESTRUCTION_APPROVAL,
      safePayload: { destructionRequestId: request.id, decision: input.decision },
    },
  })
  if (!decided) conflict('the destruction request was already decided or concurrently modified')
  await dispatchOutboxEvent(deps, {
    eventId,
    actorId: ctx.actor.actorId,
    orgId: ws.orgId,
    action,
    resource: SAGE_AUDIT_RESOURCES.DESTRUCTION_APPROVAL,
    resourceId: request.id,
    payload: { destructionRequestId: request.id, decision: input.decision },
    at: ts,
  })
  return decided
}

export async function approveSageExportDestruction(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; requestId: string; rationale?: string | null },
): Promise<{ request: SageExportDestructionRequest; approval: SageExportDestructionApproval }> {
  return decideDestruction(deps, ctx, { ...input, decision: 'approved' })
}

export async function denySageExportDestruction(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; requestId: string; rationale?: string | null },
): Promise<{ request: SageExportDestructionRequest; approval: SageExportDestructionApproval }> {
  return decideDestruction(deps, ctx, { ...input, decision: 'denied' })
}

// ── Destruction execution (idempotent, fenced; service/system may execute) ───
export async function executeSageExportDestruction(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; requestId: string },
): Promise<{
  request: SageExportDestructionRequest
  evidence: SageExportDestructionEvidence
}> {
  // Execution is allowed for service/system actors, but requires the explicit
  // execute permission on the trusted context — never approval authority.
  if (!ctx.actor.permissions.includes(SAGE_PERMISSIONS.EXPORT_DESTRUCTION_EXECUTE)) {
    forbidden('destruction execution requires explicit execute authority')
  }
  const orgId = ctx.actor.orgId
  const request = await deps.repo.getDestructionRequest(input.requestId, input.workspaceId, orgId)
  if (!request) notFound('destruction request')

  // Idempotent replay: a verified-destroyed request returns its authoritative evidence.
  if (request.status === 'destroyed') {
    const evidence = await deps.repo.getDestructionEvidenceByRequest(request.id, input.workspaceId, orgId)
    if (!evidence) conflict('destroyed request is missing its destruction evidence')
    return { request, evidence }
  }
  if (request.status === 'denied' || request.status === 'cancelled') {
    conflict('the destruction request is not approved for execution')
  }
  if (request.status === 'requested') {
    conflict('the destruction request has not been approved')
  }
  if (request.status === 'failed') {
    conflict('the destruction request failed and requires explicit retry authorization')
  }
  if (!deps.exportPackageStorage) {
    forbidden('destruction execution requires a configured storage adapter')
  }
  const storage = deps.exportPackageStorage

  // ── Crash recovery: a request already past the point of no return ──────────
  // A prior worker crashed AFTER deletion_started. The object may already be gone.
  // Reconstruct honestly from the durable attempt record rather than starting a
  // fresh, unrelated deletion.
  if (request.status === 'deletion_started') {
    const attempt = await deps.repo.getLatestDestructionAttemptByRequest(request.id, input.workspaceId, orgId)
    if (!attempt) conflict('deletion has begun but no destruction attempt exists (indeterminate)')
    if (attempt.status === 'completed') {
      const evidence = await deps.repo.getDestructionEvidenceByRequest(request.id, input.workspaceId, orgId)
      if (evidence) return { request, evidence }
    }
    if (attempt.status === 'indeterminate') {
      conflict('the destruction attempt is indeterminate and requires explicit human recovery')
    }
    const pkg = await deps.repo.getExportPackage(request.exportPackageId, input.workspaceId, orgId)
    if (!pkg) notFound('export package')
    const storageReferenceHash = hashSageStorageReference(pkg.storageReference)
    // Retry the provider deletion idempotently with the SAME key, then verify absence.
    const recovery = await storage.deleteObject({
      storageReference: pkg.storageReference,
      expectedContentHash: pkg.contentHash,
      idempotencyKey: attempt.providerIdempotencyKey,
    })
    const recoveredAt = contextNow(ctx)
    await deps.repo.recordAttemptProviderResult({
      attemptId: attempt.attemptId,
      executionOwner: attempt.executionOwner,
      providerResult: recovery.result,
      providerRequestId: recovery.providerRequestId ?? null,
      safeErrorCode: recovery.safeErrorCode ?? null,
      status: recovery.result === 'failed' ? 'failed' : 'provider_accepted',
      at: recoveredAt,
    })
    const absent = await storage.verifyObjectAbsent({ storageReference: pkg.storageReference })
    await deps.repo.recordAttemptAbsenceVerified({
      attemptId: attempt.attemptId,
      executionOwner: attempt.executionOwner,
      absent,
      at: recoveredAt,
    })
    if (absent) {
      return finalizeCompletion(deps, ctx, {
        request,
        attemptId: attempt.attemptId,
        executionOwner: attempt.executionOwner,
        pkg,
        storageReferenceHash,
        result: 'verified_destroyed',
        providerRequestId: recovery.providerRequestId,
        deletionAttemptedAt: attempt.deleteStartedAt ?? recoveredAt,
        deletionVerifiedAt: recoveredAt,
      })
    }
    // Object still present after the point of no return: indeterminate, human-resolve.
    return finalizeFailure(deps, ctx, {
      request,
      executionOwner: attempt.executionOwner,
      attemptId: attempt.attemptId,
      attemptStatus: 'indeterminate',
      pkg,
      storageReferenceHash,
      result: 'verification_failed',
      safeErrorCode: 'RECOVERY_ABSENCE_NOT_VERIFIED',
      deletionAttemptedAt: attempt.deleteStartedAt ?? recoveredAt,
      now: recoveredAt,
    })
  }

  const now = contextNow(ctx)
  // Step 1: claim the approved request with an execution lease (→ preflight).
  const claimed = await deps.repo.claimDestructionForExecution({
    destructionRequestId: request.id,
    workspaceId: input.workspaceId,
    orgId,
    executionOwner: `sage-destroy:${ctx.actor.actorId}:${sha256Hex(now).slice(0, 12)}`,
    leaseMs: DESTRUCTION_LEASE_MS,
    now,
  })
  if (!claimed) conflict('the destruction request is being executed by another worker')
  const executionOwner = claimed.executionOwner!

  const pkg = await deps.repo.getExportPackage(request.exportPackageId, input.workspaceId, orgId)
  if (!pkg) notFound('export package')

  // Step 2: final integrity + scope verification. The approval applies ONLY to
  // the exact approved package and object; any drift stops before any delete.
  const object = await deps.repo.getExportPackageObject(pkg.storageReference)
  const storageReferenceHash = hashSageStorageReference(pkg.storageReference)
  const scopeDrift =
    pkg.contentHash !== request.packageContentHash ||
    pkg.manifestHash !== request.packageManifestHash ||
    storageReferenceHash !== request.storageReferenceHash
  if (scopeDrift || !object || object.contentHash !== pkg.contentHash) {
    return finalizeFailure(deps, ctx, {
      request: claimed,
      executionOwner,
      pkg,
      storageReferenceHash,
      result: 'verification_failed',
      safeErrorCode: 'SCOPE_OR_INTEGRITY_MISMATCH',
      now,
    })
  }
  const verified = verifySageExportPackageBytes(object.bytes, {
    contentHash: pkg.contentHash,
    manifestHash: pkg.manifestHash,
  })
  if (!verified.ok) {
    return finalizeFailure(deps, ctx, {
      request: claimed,
      executionOwner,
      pkg,
      storageReferenceHash,
      result: 'verification_failed',
      safeErrorCode: `INTEGRITY_${verified.reason}`.toUpperCase(),
      now,
    })
  }

  // Step 3: persist the DURABLE attempt (prepared) BEFORE any external delete, so
  // a crash after deletion is reconstructable — never indeterminate silently.
  const attemptId = recordsEventId('attempt', request.id, executionOwner)
  const providerIdempotencyKey = recordsEventId('provider-idem', request.id, attemptId)
  const attempt = await deps.repo.createDestructionAttempt({
    attempt: {
      attemptId,
      orgId,
      workspaceId: input.workspaceId,
      destructionRequestId: request.id,
      exportPackageId: pkg.id,
      objectId: null,
      executionOwner,
      providerIdempotencyKey,
      status: 'prepared',
      createdAt: now,
      updatedAt: now,
    },
    executionOwner,
    updatedAt: now,
  })
  if (!attempt) conflict('the destruction attempt could not be opened (lease lost)')

  // Step 4: verify the object is present BEFORE deleting, and persist the result.
  const present = await storage.verifyObjectPresent({ storageReference: pkg.storageReference })
  await deps.repo.markAttemptPresenceVerified({ attemptId, executionOwner, present, at: now })
  if (!present) {
    // The object was already gone before SAGE attempted destruction. This is NOT
    // a SAGE destruction — record it honestly and do NOT tombstone automatically.
    return finalizeFailure(deps, ctx, {
      request: claimed,
      executionOwner,
      attemptId,
      attemptStatus: 'indeterminate',
      pkg,
      storageReferenceHash,
      result: 'not_found_before_delete',
      safeErrorCode: 'NOT_FOUND_BEFORE_DELETE',
      now,
    })
  }

  // Step 5: ATOMIC point of no return — request + attempt → deletion_started with
  // a final no-active-hold check. An active hold that raced in aborts here.
  const began = await deps.repo.beginDeletion({
    destructionRequestId: request.id,
    attemptId,
    workspaceId: input.workspaceId,
    orgId,
    exportPackageId: pkg.id,
    executionOwner,
    at: now,
  })
  if (!began) {
    return finalizeFailure(deps, ctx, {
      request: claimed,
      executionOwner,
      attemptId,
      attemptStatus: 'failed',
      pkg,
      storageReferenceHash,
      result: 'verification_failed',
      safeErrorCode: 'HOLD_PLACED_OR_LEASE_LOST',
      now,
    })
  }

  // Step 6: call the provider deletion OUTSIDE any DB transaction, with the stable
  // idempotency key so a retry of THIS attempt cannot double-delete.
  const deletion = await storage.deleteObject({
    storageReference: pkg.storageReference,
    expectedContentHash: pkg.contentHash,
    idempotencyKey: providerIdempotencyKey,
  })
  const deletionAttemptedAt = contextNow(ctx)
  // Step 7: persist the safe provider result on the attempt.
  await deps.repo.recordAttemptProviderResult({
    attemptId,
    executionOwner,
    providerResult: deletion.result,
    providerRequestId: deletion.providerRequestId ?? null,
    safeErrorCode: deletion.safeErrorCode ?? null,
    status: deletion.result === 'failed' ? 'failed' : 'provider_accepted',
    at: deletionAttemptedAt,
  })
  if (deletion.result === 'failed') {
    // We crossed the point of no return; the object state is unknown → indeterminate.
    return finalizeFailure(deps, ctx, {
      request: began.request,
      executionOwner,
      attemptId,
      attemptStatus: 'indeterminate',
      pkg,
      storageReferenceHash,
      result: 'provider_failed',
      safeErrorCode: deletion.safeErrorCode ?? 'PROVIDER_FAILED',
      providerRequestId: deletion.providerRequestId,
      deletionAttemptedAt,
      now,
    })
  }

  // Step 8: deletion success is NOT proof of destruction — verify absence.
  const absent = await storage.verifyObjectAbsent({ storageReference: pkg.storageReference })
  const deletionVerifiedAt = contextNow(ctx)
  // Step 9: persist the absence verification on the attempt.
  await deps.repo.recordAttemptAbsenceVerified({ attemptId, executionOwner, absent, at: deletionVerifiedAt })
  if (!absent) {
    return finalizeFailure(deps, ctx, {
      request: began.request,
      executionOwner,
      attemptId,
      attemptStatus: 'indeterminate',
      pkg,
      storageReferenceHash,
      result: 'verification_failed',
      safeErrorCode: 'ABSENCE_NOT_VERIFIED',
      providerRequestId: deletion.providerRequestId,
      deletionAttemptedAt,
      now,
    })
  }

  // Step 10: atomically create evidence + tombstone the package + complete both
  // the request and the attempt.
  return finalizeCompletion(deps, ctx, {
    request: began.request,
    attemptId,
    executionOwner,
    pkg,
    storageReferenceHash,
    result: 'verified_destroyed',
    providerRequestId: deletion.providerRequestId,
    deletionAttemptedAt,
    deletionVerifiedAt,
  })
}

async function finalizeCompletion(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    request: SageExportDestructionRequest
    attemptId: string
    executionOwner: string
    pkg: { id: string; contentHash: string; manifestHash: string }
    storageReferenceHash: string
    result: SageDestructionResult
    providerRequestId?: string
    deletionAttemptedAt: string
    deletionVerifiedAt: string
  },
): Promise<{ request: SageExportDestructionRequest; evidence: SageExportDestructionEvidence }> {
  const orgId = ctx.actor.orgId
  const evidenceEventId = recordsEventId('destruction_evidence', input.request.id, input.deletionVerifiedAt)
  const auditEventId = recordsEventId('destruction_verified', input.request.id, input.deletionVerifiedAt)
  const completed = await deps.repo.completeDestruction({
    destructionRequestId: input.request.id,
    workspaceId: input.request.workspaceId,
    orgId,
    executionOwner: input.executionOwner,
    attemptId: input.attemptId,
    exportPackageId: input.pkg.id,
    destroyedBy: ctx.actor.actorId,
    updatedAt: input.deletionVerifiedAt,
    evidence: {
      eventId: evidenceEventId,
      orgId,
      workspaceId: input.request.workspaceId,
      destructionRequestId: input.request.id,
      exportPackageId: input.pkg.id,
      objectId: null,
      storageProvider: DEFAULT_STORAGE_PROVIDER,
      storageReferenceHash: input.storageReferenceHash,
      preDestructionContentHash: input.pkg.contentHash,
      preDestructionManifestHash: input.pkg.manifestHash,
      deletionAttemptedAt: input.deletionAttemptedAt,
      deletionVerifiedAt: input.deletionVerifiedAt,
      verificationMethod: 'storage_absence_probe',
      result: input.result,
      providerRequestId: input.providerRequestId ?? null,
      safeErrorCode: null,
      executedBy: ctx.actor.actorId,
      createdAt: input.deletionVerifiedAt,
    },
    auditEvent: {
      eventId: auditEventId,
      actorId: ctx.actor.actorId,
      action: SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_VERIFIED,
      resourceType: SAGE_AUDIT_RESOURCES.DESTRUCTION_EVIDENCE,
      safePayload: { destructionRequestId: input.request.id, exportPackageId: input.pkg.id, result: input.result },
    },
  })
  if (!completed) conflict('the destruction could not be finalized (lease lost or package changed)')
  await dispatchOutboxEvent(deps, {
    eventId: auditEventId,
    actorId: ctx.actor.actorId,
    orgId,
    action: SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_VERIFIED,
    resource: SAGE_AUDIT_RESOURCES.DESTRUCTION_EVIDENCE,
    resourceId: input.request.id,
    payload: { destructionRequestId: input.request.id, exportPackageId: input.pkg.id, result: input.result },
    at: input.deletionVerifiedAt,
  })
  return { request: completed.request, evidence: completed.evidence }
}

async function finalizeFailure(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    request: SageExportDestructionRequest
    executionOwner: string
    attemptId?: string
    attemptStatus?: 'failed' | 'indeterminate'
    pkg: { id: string; contentHash: string; manifestHash: string }
    storageReferenceHash: string
    result: SageDestructionResult
    safeErrorCode: string
    providerRequestId?: string
    deletionAttemptedAt?: string
    now: string
  },
): Promise<{ request: SageExportDestructionRequest; evidence: SageExportDestructionEvidence }> {
  const ts = contextNow(ctx)
  const orgId = ctx.actor.orgId
  const evidenceEventId = recordsEventId('destruction_failure_evidence', input.request.id, ts)
  const auditEventId = recordsEventId('destruction_failed', input.request.id, ts)
  const failed = await deps.repo.failDestruction({
    destructionRequestId: input.request.id,
    workspaceId: input.request.workspaceId,
    orgId,
    executionOwner: input.executionOwner,
    attemptId: input.attemptId,
    attemptStatus: input.attemptStatus,
    updatedAt: ts,
    evidence: {
      eventId: evidenceEventId,
      orgId,
      workspaceId: input.request.workspaceId,
      destructionRequestId: input.request.id,
      exportPackageId: input.pkg.id,
      objectId: null,
      storageProvider: DEFAULT_STORAGE_PROVIDER,
      storageReferenceHash: input.storageReferenceHash,
      preDestructionContentHash: input.pkg.contentHash,
      preDestructionManifestHash: input.pkg.manifestHash,
      deletionAttemptedAt: input.deletionAttemptedAt ?? null,
      deletionVerifiedAt: null,
      verificationMethod: 'storage_absence_probe',
      result: input.result,
      providerRequestId: input.providerRequestId ?? null,
      safeErrorCode: input.safeErrorCode,
      executedBy: ctx.actor.actorId,
      createdAt: ts,
    },
    auditEvent: {
      eventId: auditEventId,
      actorId: ctx.actor.actorId,
      action: SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_FAILED,
      resourceType: SAGE_AUDIT_RESOURCES.DESTRUCTION_EVIDENCE,
      safePayload: {
        destructionRequestId: input.request.id,
        result: input.result,
        safeErrorCode: input.safeErrorCode,
      },
    },
  })
  if (!failed) conflict('the destruction failure could not be recorded (lease lost)')
  await dispatchOutboxEvent(deps, {
    eventId: auditEventId,
    actorId: ctx.actor.actorId,
    orgId,
    action: SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_FAILED,
    resource: SAGE_AUDIT_RESOURCES.DESTRUCTION_EVIDENCE,
    resourceId: input.request.id,
    payload: { destructionRequestId: input.request.id, result: input.result, safeErrorCode: input.safeErrorCode },
    at: ts,
  })
  return { request: failed.request, evidence: failed.evidence }
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function listSageExportDestructionRequests(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string },
): Promise<SageExportDestructionRequest[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  })
  return deps.repo.listDestructionRequests(ws.id, ws.orgId)
}

export async function getSageExportDestructionEvidence(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; requestId: string },
): Promise<SageExportDestructionEvidence | undefined> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EXPORT_DESTRUCTION_READ,
  })
  return deps.repo.getDestructionEvidenceByRequest(input.requestId, ws.id, ws.orgId)
}
