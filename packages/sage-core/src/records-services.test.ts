// ─── SAGE Phase 8B — records lifecycle (retention, holds, destruction) ───────
// Proves the controlled destruction lifecycle: default-retain, versioned
// retention, legal holds, two-person separation, verified deletion, tombstone,
// immutable evidence, and idempotent fenced execution. Uses REAL SHA-256.

import { describe, it, expect, beforeEach } from 'vitest'
import { InMemorySageRepository } from './repository'
import { SAGE_AUDIT_ACTIONS } from './audit-events'
import { SAGE_PERMISSIONS } from './permissions'
import type { SageAuditPayload } from './audit-events'
import type { SageServiceContext, SageServiceActor } from './service-context'
import type { SageAuditSink } from './audit-sink'
import type { SageExportPackageStorage } from './records-types'
import {
  addSageWorkspaceMember,
  approveSageExport,
  assignSageRole,
  classifySageEvidenceSource,
  createSageEvidenceItem,
  createSageEvidenceSource,
  createSageWorkspace,
  generateSageExportPackage,
  getSageExportPackageContent,
  requestSageExport,
  type SageServiceDeps,
} from './services'
import { requestSageDelivery, createSageDeliveryRecipient } from './delivery-services'
import {
  assignSageExportRetentionPolicy,
  approveSageExportDestruction,
  createSageRetentionPolicy,
  denySageExportDestruction,
  executeSageExportDestruction,
  placeSageExportLegalHold,
  releaseSageExportLegalHold,
  requestSageExportDestruction,
} from './records-services'

class RecordingSink implements SageAuditSink {
  readonly records: SageAuditPayload[] = []
  async record(input: SageAuditPayload): Promise<void> {
    this.records.push(input)
  }
  has(action: string): boolean {
    return this.records.some((r) => r.action === action)
  }
}

/** Fake storage: tracks deletions + absence so verify-before-tombstone is real. */
class FakeStorage implements SageExportPackageStorage {
  absent = new Set<string>()
  failNext = false
  neverAbsent = false
  notFound = false
  absentBeforeDelete = false
  /** Simulate a worker crash: the provider deletes the object then the process dies
   *  before the result is recorded. The object is genuinely gone. */
  throwOnDelete = false
  deleteCalls = 0
  async deleteObject(input: { storageReference: string; expectedContentHash: string; idempotencyKey: string }) {
    this.deleteCalls += 1
    if (this.throwOnDelete) {
      // The provider completed the delete server-side, but we crash before recording.
      this.absent.add(input.storageReference)
      throw new Error('simulated crash after provider delete')
    }
    if (this.failNext) return { result: 'failed' as const, safeErrorCode: 'BOOM' }
    if (this.notFound) {
      // The object was already gone — absence is genuinely verifiable.
      this.absent.add(input.storageReference)
      return { result: 'not_found' as const }
    }
    this.absent.add(input.storageReference)
    return { result: 'deleted' as const, providerRequestId: 'req-1' }
  }
  async verifyObjectPresent(input: { storageReference: string }) {
    if (this.absentBeforeDelete) return false
    return !this.absent.has(input.storageReference)
  }
  async verifyObjectAbsent(input: { storageReference: string }) {
    if (this.neverAbsent) return false
    return this.absent.has(input.storageReference)
  }
}

let repo: InMemorySageRepository
let sink: RecordingSink
let storage: FakeStorage
let deps: SageServiceDeps

const ORG = 'org_1'
function at(iso: string) {
  return () => new Date(iso)
}
function actor(overrides: Partial<SageServiceActor> = {}): SageServiceActor {
  return {
    actorId: 'actor_1',
    orgId: ORG,
    actorKind: 'human',
    permissions: Object.values(SAGE_PERMISSIONS),
    ...overrides,
  }
}
function ctx(a: SageServiceActor, iso = '2026-07-14T00:00:00.000Z'): SageServiceContext {
  return { actor: a, now: at(iso) }
}

const admin = actor({ actorId: 'admin_1' })
const recordsMgr = actor({ actorId: 'records_1' })
const holdMgr = actor({ actorId: 'hold_1' })
const approver = actor({ actorId: 'approver_1' })
const executor = actor({ actorId: 'sys_exec', actorKind: 'system' })

beforeEach(() => {
  repo = new InMemorySageRepository()
  sink = new RecordingSink()
  storage = new FakeStorage()
  deps = { repo, audit: sink, exportPackageStorage: storage }
})

/** Build an approved, generated package + the four distinct records roles. */
async function setupPackage(): Promise<{ ws: string; packageId: string }> {
  // Build the package well in the past so short retention windows have elapsed.
  const BUILD = '2020-01-01T00:00:00.000Z'
  const ws = await createSageWorkspace(deps, ctx(admin, BUILD), {
    name: 'Records Office',
    institutionType: 'crown_corporation',
    riskSurface: 'general_governance',
  })
  const grant = async (actorId: string, role: string) => {
    await addSageWorkspaceMember(deps, ctx(admin, BUILD), { workspaceId: ws.id, actorId })
    await assignSageRole(deps, ctx(admin, BUILD), {
      workspaceId: ws.id,
      actorId,
      role: role as never,
      accessReason: 'x',
      approvedBy: admin.actorId,
    })
  }
  // Admin also needs steward + export authority to build the package.
  await assignSageRole(deps, ctx(admin, BUILD), { workspaceId: ws.id, actorId: admin.actorId, role: 'evidence_steward', accessReason: 'x', approvedBy: admin.actorId })
  await grant('approver_2', 'export_approver')
  await grant(recordsMgr.actorId, 'records_manager')
  await grant(holdMgr.actorId, 'legal_hold_manager')
  await grant(approver.actorId, 'destruction_approver')

  const src = await createSageEvidenceSource(deps, ctx(admin, BUILD), { workspaceId: ws.id, sourceType: 'public' })
  await classifySageEvidenceSource(deps, ctx(admin, BUILD), { workspaceId: ws.id, sourceId: src.id, sourceQuality: 'high', authorizationLevel: 'internal' })
  const item = await createSageEvidenceItem(deps, ctx(admin, BUILD), { workspaceId: ws.id, sourceId: src.id, confidenceLevel: 'moderate' })
  const req = await requestSageExport(deps, ctx(admin, BUILD), { workspaceId: ws.id, purpose: 'review', evidenceItemIds: [item.id] })
  const exportApprover = actor({ actorId: 'approver_2' })
  await approveSageExport(deps, ctx(exportApprover, BUILD), { workspaceId: ws.id, exportRequestId: req.id, rationale: 'ok' })
  const pkg = await generateSageExportPackage(deps, ctx(exportApprover, BUILD), { workspaceId: ws.id, exportRequestId: req.id })
  return { ws: ws.id, packageId: pkg.id }
}

/** Assign a short-retention policy that has already elapsed by the default clock. */
async function assignElapsedRetention(ws: string, packageId: string): Promise<void> {
  await createSageRetentionPolicy(deps, ctx(recordsMgr, '2020-01-01T00:00:00.000Z'), {
    workspaceId: ws,
    policyCode: 'std',
    version: 1,
    name: 'Standard',
    retentionBasis: 'created_at',
    retentionDurationDays: 1,
  })
  await assignSageExportRetentionPolicy(deps, ctx(recordsMgr, '2026-07-14T00:00:00.000Z'), {
    workspaceId: ws,
    packageId,
    policyCode: 'std',
  })
}

describe('records — retention', () => {
  it('denies destruction when no retention policy is assigned (default is retain)', async () => {
    const { ws, packageId } = await setupPackage()
    await expect(
      requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('snapshots the applied policy version and does not move retention when the policy is later deactivated', async () => {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const assignment = await repo.getRetentionAssignment(packageId, ws, ORG)
    expect(assignment?.policyVersion).toBe(1)
    const retainUntil = assignment?.retainUntil
    // Deactivate the policy version; the assignment retain_until is unchanged.
    const policy = await repo.getActiveRetentionPolicyByCode(ORG, 'std')
    ;(policy as { isActive: boolean }).isActive = false
    const after = await repo.getRetentionAssignment(packageId, ws, ORG)
    expect(after?.retainUntil).toBe(retainUntil)
  })

  it('blocks a destruction request while the retention period has not elapsed', async () => {
    const { ws, packageId } = await setupPackage()
    await createSageRetentionPolicy(deps, ctx(recordsMgr), {
      workspaceId: ws, policyCode: 'long', version: 1, name: 'Long', retentionBasis: 'created_at', retentionDurationDays: 3650,
    })
    await assignSageExportRetentionPolicy(deps, ctx(recordsMgr), { workspaceId: ws, packageId, policyCode: 'long' })
    await expect(
      requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('permits a destruction request when retention has elapsed and there is no hold', async () => {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const request = await requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' })
    expect(request.status).toBe('requested')
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_REQUESTED)).toBe(true)
  })
})

describe('records — legal holds', () => {
  it('an active hold blocks destruction; a released hold remains in history and unblocks', async () => {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const hold = await placeSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, packageId, reason: 'litigation' })
    await expect(
      requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    // Release keeps history and unblocks.
    const released = await releaseSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, holdId: hold.id, releaseReason: 'closed' })
    expect(released.status).toBe('released')
    expect(released.reason).toBe('litigation')
    const request = await requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' })
    expect(request.status).toBe('requested')
  })

  it('with multiple holds, one active hold still blocks destruction', async () => {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const h1 = await placeSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, packageId, reason: 'a' })
    await placeSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, packageId, reason: 'b' })
    await releaseSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, holdId: h1.id, releaseReason: 'x' })
    await expect(
      requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('a records manager without hold authority cannot place a hold', async () => {
    const { ws, packageId } = await setupPackage()
    await expect(
      placeSageExportLegalHold(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('a system actor cannot place a legal hold', async () => {
    const { ws, packageId } = await setupPackage()
    await addSageWorkspaceMember(deps, ctx(admin), { workspaceId: ws, actorId: executor.actorId })
    await assignSageRole(deps, ctx(admin), { workspaceId: ws, actorId: executor.actorId, role: 'legal_hold_manager', accessReason: 'x', approvedBy: admin.actorId })
    await expect(
      placeSageExportLegalHold(deps, ctx(executor), { workspaceId: ws, packageId, reason: 'x' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('concurrent release of the same hold has exactly one winner', async () => {
    const { ws, packageId } = await setupPackage()
    const hold = await placeSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, packageId, reason: 'x' })
    const results = await Promise.allSettled([
      releaseSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, holdId: hold.id, releaseReason: '1' }),
      releaseSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, holdId: hold.id, releaseReason: '2' }),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    expect(fulfilled).toHaveLength(1)
  })
})

describe('records — approval separation of duties', () => {
  async function openRequest() {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const request = await requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' })
    return { ws, packageId, requestId: request.id }
  }

  it('the requester cannot approve their own destruction', async () => {
    const { ws, requestId } = await openRequest()
    // recordsMgr is also given approver role but is still the requester.
    await assignSageRole(deps, ctx(admin), { workspaceId: ws, actorId: recordsMgr.actorId, role: 'destruction_approver', accessReason: 'x', approvedBy: admin.actorId })
    await expect(
      approveSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, requestId }),
    ).rejects.toThrow(/requester/i)
  })

  it('a generic admin without destruction-approve authority cannot approve', async () => {
    const { ws, requestId } = await openRequest()
    const genericAdmin = actor({ actorId: 'admin_generic', permissions: [SAGE_PERMISSIONS.WORKSPACE_ADMIN] })
    await expect(
      approveSageExportDestruction(deps, ctx(genericAdmin), { workspaceId: ws, requestId }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('a different authorized human can approve', async () => {
    const { ws, requestId } = await openRequest()
    const result = await approveSageExportDestruction(deps, ctx(approver), { workspaceId: ws, requestId })
    expect(result.request.status).toBe('approved')
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_APPROVED)).toBe(true)
  })

  it('concurrent approve/deny yields exactly one decision', async () => {
    const { ws, requestId } = await openRequest()
    await addSageWorkspaceMember(deps, ctx(admin), { workspaceId: ws, actorId: 'approver_3' })
    await assignSageRole(deps, ctx(admin), { workspaceId: ws, actorId: 'approver_3', role: 'destruction_approver', accessReason: 'x', approvedBy: admin.actorId })
    const other = actor({ actorId: 'approver_3' })
    const results = await Promise.allSettled([
      approveSageExportDestruction(deps, ctx(approver), { workspaceId: ws, requestId }),
      denySageExportDestruction(deps, ctx(other), { workspaceId: ws, requestId }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  })

  it('a package/scope drift after request returns CONFLICT at approval', async () => {
    const { ws, packageId, requestId } = await openRequest()
    // Simulate drift: mutate the stored package content hash.
    const pkg = await repo.getExportPackage(packageId, ws, ORG)
    ;(pkg as { contentHash: string }).contentHash = 'drifted-hash'
    await expect(
      approveSageExportDestruction(deps, ctx(approver), { workspaceId: ws, requestId }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('records — destruction execution', () => {
  async function approvedRequest() {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const request = await requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' })
    await approveSageExportDestruction(deps, ctx(approver), { workspaceId: ws, requestId: request.id })
    return { ws, packageId, requestId: request.id }
  }

  it('does not attempt deletion before approval', async () => {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const request = await requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' })
    await expect(
      executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId: request.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(storage.deleteCalls).toBe(0)
  })

  it('verifies absence: deletion success without verified absence is NOT complete', async () => {
    const { ws, requestId, packageId } = await approvedRequest()
    storage.neverAbsent = true
    const result = await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId })
    expect(result.request.status).toBe('failed')
    expect(result.evidence.result).toBe('verification_failed')
    const pkg = await repo.getExportPackage(packageId, ws, ORG)
    expect(pkg?.availabilityStatus ?? 'available').toBe('available')
  })

  it('verified absence creates immutable evidence and a package tombstone', async () => {
    const { ws, requestId, packageId } = await approvedRequest()
    const result = await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId })
    expect(result.request.status).toBe('destroyed')
    expect(result.evidence.result).toBe('verified_destroyed')
    expect(result.evidence.deletionVerifiedAt).toBeTruthy()
    const pkg = await repo.getExportPackage(packageId, ws, ORG)
    expect(pkg?.availabilityStatus).toBe('destroyed')
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_DESTRUCTION_VERIFIED)).toBe(true)
  })

  it('records a safe failure when the provider fails', async () => {
    const { ws, requestId } = await approvedRequest()
    storage.failNext = true
    const result = await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId })
    expect(result.request.status).toBe('failed')
    expect(result.evidence.result).toBe('provider_failed')
    expect(result.evidence.safeErrorCode).toBe('BOOM')
  })

  it('does not silently treat not-found as success (absent before delete)', async () => {
    const { ws, requestId } = await approvedRequest()
    storage.absentBeforeDelete = true
    const result = await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId })
    expect(result.evidence.result).toBe('not_found_before_delete')
    expect(result.request.status).toBe('failed')
    expect(storage.deleteCalls).toBe(0) // never deleted, since the object was already gone
  })

  it('replays authoritative evidence after verified destruction (idempotent)', async () => {
    const { ws, requestId } = await approvedRequest()
    const first = await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId })
    storage.deleteCalls = 0
    const second = await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId })
    expect(second.evidence.id).toBe(first.evidence.id)
    expect(storage.deleteCalls).toBe(0) // no second deletion
  })

  it('reclaims a stale execution lease and fences the old owner out', async () => {
    const { ws, requestId } = await approvedRequest()
    // Owner A claims preflight but never finishes.
    const ownerA = await repo.claimDestructionForExecution({
      destructionRequestId: requestId, workspaceId: ws, orgId: ORG,
      executionOwner: 'owner-A', leaseMs: 1000, now: '2026-07-14T00:00:00.000Z',
    })
    expect(ownerA?.executionOwner).toBe('owner-A')
    // Later, owner B reclaims the stale preflight lease.
    const ownerB = await repo.claimDestructionForExecution({
      destructionRequestId: requestId, workspaceId: ws, orgId: ORG,
      executionOwner: 'owner-B', leaseMs: 1000, now: '2026-07-14T01:00:00.000Z',
    })
    expect(ownerB?.executionOwner).toBe('owner-B')
    // The old owner can no longer open an attempt (fenced out of preflight).
    const staleAttempt = await repo.createDestructionAttempt({
      attempt: {
        attemptId: 'att-A', orgId: ORG, workspaceId: ws, destructionRequestId: requestId,
        exportPackageId: ownerB!.exportPackageId, objectId: null, executionOwner: 'owner-A',
        providerIdempotencyKey: 'k-A', status: 'prepared', createdAt: '2026-07-14T02:00:00.000Z',
        updatedAt: '2026-07-14T02:00:00.000Z',
      },
      executionOwner: 'owner-A',
      updatedAt: '2026-07-14T02:00:00.000Z',
    })
    expect(staleAttempt).toBeUndefined()
  })
})

describe('records — access regression after destruction', () => {
  async function destroyed() {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const request = await requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' })
    await approveSageExportDestruction(deps, ctx(approver), { workspaceId: ws, requestId: request.id })
    await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId: request.id })
    return { ws, packageId }
  }

  it('a destroyed package cannot be internally downloaded', async () => {
    const { ws, packageId } = await destroyed()
    const exportApprover = actor({ actorId: 'approver_2' })
    await expect(
      getSageExportPackageContent(deps, ctx(exportApprover), { workspaceId: ws, packageId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('a destroyed package cannot be newly delivered', async () => {
    const { ws, packageId } = await destroyed()
    // Give admin delivery-request authority + a verified recipient.
    await assignSageRole(deps, ctx(admin), { workspaceId: ws, actorId: admin.actorId, role: 'export_approver', accessReason: 'x', approvedBy: admin.actorId })
    const recipient = await createSageDeliveryRecipient(deps, ctx(admin), {
      workspaceId: ws, displayName: 'R', email: 'recipient@example.com',
    })
    await expect(
      requestSageDelivery(deps, ctx(admin), {
        workspaceId: ws, exportPackageId: packageId, recipientId: recipient.id,
        accessExpiresAt: '2026-08-14T00:00:00.000Z', maxAccesses: 1,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('package metadata remains readable after destruction (tombstone, not deleted)', async () => {
    const { ws, packageId } = await destroyed()
    const pkg = await repo.getExportPackage(packageId, ws, ORG)
    expect(pkg).toBeDefined()
    expect(pkg?.availabilityStatus).toBe('destroyed')
    expect(pkg?.contentHash).toBeTruthy()
  })
})

describe('records — privacy', () => {
  it('destruction evidence and audit never contain the raw storage reference', async () => {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const request = await requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' })
    await approveSageExportDestruction(deps, ctx(approver), { workspaceId: ws, requestId: request.id })
    const result = await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId: request.id })
    const pkg = await repo.getExportPackage(packageId, ws, ORG)
    const rawRef = pkg!.storageReference
    expect(result.evidence.storageReferenceHash).not.toContain(rawRef)
    expect(result.evidence.storageReferenceHash).not.toBe(rawRef)
    const serializedAudit = JSON.stringify(sink.records)
    expect(serializedAudit).not.toContain(rawRef)
  })
})

describe('records — crash recovery (durable pre-delete attempt)', () => {
  async function approvedRequest() {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const request = await requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' })
    await approveSageExportDestruction(deps, ctx(approver), { workspaceId: ws, requestId: request.id })
    return { ws, packageId, requestId: request.id }
  }

  it('persists a durable attempt at the point of no return, then recovers idempotently after a crash', async () => {
    const { ws, requestId, packageId } = await approvedRequest()
    // First worker crosses the point of no return then crashes mid-delete.
    storage.throwOnDelete = true
    await expect(
      executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId }),
    ).rejects.toThrow(/simulated crash/i)

    // The authoritative destruction state survives the crash.
    const midRequest = await repo.getDestructionRequest(requestId, ws, ORG)
    expect(midRequest?.status).toBe('deletion_started')
    const attempt = await repo.getLatestDestructionAttemptByRequest(requestId, ws, ORG)
    expect(attempt).toBeTruthy()
    expect(attempt?.status).toBe('deletion_started')
    // The package is NOT yet tombstoned — completion only follows verified absence.
    const midPkg = await repo.getExportPackage(packageId, ws, ORG)
    expect(midPkg?.availabilityStatus ?? 'available').toBe('available')

    // A later worker recovers: replay the SAME attempt, verify absence, complete.
    storage.throwOnDelete = false
    storage.deleteCalls = 0
    const recovered = await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId })
    expect(recovered.request.status).toBe('destroyed')
    expect(recovered.evidence.result).toBe('verified_destroyed')
    // Recovery reuses the durable attempt rather than opening a new one.
    const finalAttempt = await repo.getLatestDestructionAttemptByRequest(requestId, ws, ORG)
    expect(finalAttempt?.attemptId).toBe(attempt?.attemptId)
    expect(finalAttempt?.status).toBe('completed')
    const pkg = await repo.getExportPackage(packageId, ws, ORG)
    expect(pkg?.availabilityStatus).toBe('destroyed')
  })

  it('does not open a fresh unrelated deletion after a crash — recovery uses the prior attempt', async () => {
    const { ws, requestId } = await approvedRequest()
    storage.throwOnDelete = true
    await expect(
      executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId }),
    ).rejects.toThrow()
    const firstAttempt = await repo.getLatestDestructionAttemptByRequest(requestId, ws, ORG)

    storage.throwOnDelete = false
    await executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId })
    const attempts = await repo.getLatestDestructionAttemptByRequest(requestId, ws, ORG)
    // Same attempt id proves no second, unrelated attempt was created.
    expect(attempts?.attemptId).toBe(firstAttempt?.attemptId)
  })
})

describe('records — legal hold / execution race (point of no return)', () => {
  async function approvedRequest() {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const request = await requestSageExportDestruction(deps, ctx(recordsMgr), { workspaceId: ws, packageId, reason: 'x' })
    await approveSageExportDestruction(deps, ctx(approver), { workspaceId: ws, requestId: request.id })
    return { ws, packageId, requestId: request.id }
  }

  it('a hold that races in during preflight aborts the deletion at the point of no return', async () => {
    const { ws, packageId, requestId } = await approvedRequest()
    // Worker claims and prepares an attempt (preflight), verifying presence.
    const claimed = await repo.claimDestructionForExecution({
      destructionRequestId: requestId, workspaceId: ws, orgId: ORG,
      executionOwner: 'owner-1', leaseMs: 60_000, now: '2026-07-14T00:00:00.000Z',
    })
    const attempt = await repo.createDestructionAttempt({
      attempt: {
        attemptId: 'att-race', orgId: ORG, workspaceId: ws, destructionRequestId: requestId,
        exportPackageId: claimed!.exportPackageId, objectId: null, executionOwner: 'owner-1',
        providerIdempotencyKey: 'k-race', status: 'prepared', createdAt: '2026-07-14T00:00:00.000Z',
        updatedAt: '2026-07-14T00:00:00.000Z',
      },
      executionOwner: 'owner-1', updatedAt: '2026-07-14T00:00:00.000Z',
    })
    expect(attempt).toBeTruthy()

    // A legal hold becomes active before the point of no return.
    await placeSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, packageId, reason: 'litigation' })

    // The atomic point-of-no-return check refuses to begin deletion.
    const began = await repo.beginDeletion({
      destructionRequestId: requestId, attemptId: 'att-race', workspaceId: ws, orgId: ORG,
      exportPackageId: claimed!.exportPackageId, executionOwner: 'owner-1', at: '2026-07-14T00:05:00.000Z',
    })
    expect(began).toBeUndefined()
    // No deletion was attempted.
    expect(storage.deleteCalls).toBe(0)
  })

  it('a hold placed AFTER the point of no return gets a deterministic conflict', async () => {
    const { ws, packageId, requestId } = await approvedRequest()
    // Drive the request past the point of no return via a crash.
    storage.throwOnDelete = true
    await expect(
      executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId }),
    ).rejects.toThrow()
    const midRequest = await repo.getDestructionRequest(requestId, ws, ORG)
    expect(midRequest?.status).toBe('deletion_started')

    // A hold can no longer win once deletion has begun.
    await expect(
      placeSageExportLegalHold(deps, ctx(holdMgr), { workspaceId: ws, packageId, reason: 'too late' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('two concurrent workers produce exactly one deletion', async () => {
    const { ws, requestId } = await approvedRequest()
    const results = await Promise.allSettled([
      executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId }),
      executeSageExportDestruction(deps, ctx(executor), { workspaceId: ws, requestId }),
    ])
    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    // At least one succeeds; the other is fenced out (conflict) — never two deletions.
    expect(fulfilled.length).toBeGreaterThanOrEqual(1)
    expect(storage.deleteCalls).toBeLessThanOrEqual(1)
  })
})

describe('records — retention provenance', () => {
  it('freezes the retention basis source (type/id/timestamp) from the package identity for created_at', async () => {
    const { ws, packageId } = await setupPackage()
    await assignElapsedRetention(ws, packageId)
    const assignment = await repo.getRetentionAssignment(packageId, ws, ORG)
    expect(assignment?.retentionBasis).toBe('created_at')
    expect(assignment?.retentionBasisSourceType).toBe('created_at')
    // created_at basis is anchored to the immutable package identity + generated_at.
    const pkg = await repo.getExportPackage(packageId, ws, ORG)
    expect(assignment?.retentionBasisSourceId).toBe(packageId)
    expect(assignment?.retentionBasisSourceTimestamp).toBe(pkg?.generatedAt)
  })

  it('requires an authoritative event source when the policy basis is event_date', async () => {
    const { ws, packageId } = await setupPackage()
    await createSageRetentionPolicy(deps, ctx(recordsMgr, '2020-01-01T00:00:00.000Z'), {
      workspaceId: ws, policyCode: 'evt', version: 1, name: 'Event', retentionBasis: 'event_date', retentionDurationDays: 1,
    })
    await expect(
      assignSageExportRetentionPolicy(deps, ctx(recordsMgr), { workspaceId: ws, packageId, policyCode: 'evt' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('records the supplied event source as the frozen provenance for event_date', async () => {
    const { ws, packageId } = await setupPackage()
    await createSageRetentionPolicy(deps, ctx(recordsMgr, '2020-01-01T00:00:00.000Z'), {
      workspaceId: ws, policyCode: 'evt', version: 1, name: 'Event', retentionBasis: 'event_date', retentionDurationDays: 1,
    })
    await assignSageExportRetentionPolicy(deps, ctx(recordsMgr), {
      workspaceId: ws, packageId, policyCode: 'evt',
      eventDate: '2019-06-01T00:00:00.000Z', eventSourceId: 'evt-src-9',
    })
    const assignment = await repo.getRetentionAssignment(packageId, ws, ORG)
    expect(assignment?.retentionBasisSourceType).toBe('event_date')
    expect(assignment?.retentionBasisSourceId).toBe('evt-src-9')
    expect(assignment?.retentionBasisSourceTimestamp).toBe('2019-06-01T00:00:00.000Z')
  })
})

