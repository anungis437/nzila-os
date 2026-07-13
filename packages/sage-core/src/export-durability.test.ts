// ─── SAGE Phase 7 — export durability + integrity (crash-safety) ─────────────
// Proves the package commit is atomic, audit-durable via the outbox, and
// cryptographically verified on access. Uses REAL SHA-256 (no mocked equality).

import { describe, it, expect, beforeEach } from 'vitest'
import { InMemorySageRepository } from './repository'
import { SAGE_AUDIT_ACTIONS } from './audit-events'
import { SAGE_PERMISSIONS } from './permissions'
import type { SageAuditPayload } from './audit-events'
import type { SageServiceContext, SageServiceActor } from './service-context'
import type { SageExportPackageObject } from './types'
import type { SageAuditSink } from './audit-sink'
import {
  addSageWorkspaceMember,
  approveSageExport,
  assignSageRole,
  classifySageEvidenceSource,
  createSageEvidenceItem,
  createSageEvidenceSource,
  createSageWorkspace,
  dispatchPendingSageAuditOutbox,
  generateSageExportPackage,
  getSageExportPackageContent,
  requestSageExport,
  type SageServiceDeps,
} from './services'

const NOW = '2026-07-12T00:00:00.000Z'
function actor(overrides: Partial<SageServiceActor> = {}): SageServiceActor {
  return {
    actorId: 'actor_1',
    orgId: 'org_1',
    actorKind: 'human',
    permissions: Object.values(SAGE_PERMISSIONS),
    ...overrides,
  }
}
function ctxFor(a: SageServiceActor): SageServiceContext {
  return { actor: a, now: () => new Date(NOW) }
}

/** Audit sink that fails on demand (simulates a temporarily-unavailable sink). */
class ToggleableAuditSink implements SageAuditSink {
  fail = false
  readonly records: SageAuditPayload[] = []
  async record(input: SageAuditPayload): Promise<void> {
    if (this.fail) throw new Error('audit sink unavailable')
    this.records.push(input)
  }
  has(action: string): boolean {
    return this.records.some((r) => r.action === action)
  }
  count(action: string): number {
    return this.records.filter((r) => r.action === action).length
  }
}

/** Repo that can tamper the stored object bytes/hash or drop it (integrity tests). */
class TamperingRepo extends InMemorySageRepository {
  tamperBytes?: Uint8Array
  tamperContentHash?: string
  dropObject = false
  async getExportPackageObject(ref: string): Promise<SageExportPackageObject | undefined> {
    if (this.dropObject) return undefined
    const obj = await super.getExportPackageObject(ref)
    if (!obj) return obj
    return {
      ...obj,
      bytes: this.tamperBytes ?? obj.bytes,
      contentHash: this.tamperContentHash ?? obj.contentHash,
    }
  }
}

let repo: TamperingRepo
let sink: ToggleableAuditSink
let deps: SageServiceDeps

beforeEach(() => {
  repo = new TamperingRepo()
  sink = new ToggleableAuditSink()
  deps = { repo, audit: sink }
})

const owner = () => actor()
const approver = () => actor({ actorId: 'approver_1' })

async function setupApproved(): Promise<{ ws: string; requestId: string }> {
  const a = owner()
  const ws = await createSageWorkspace(deps, ctxFor(a), {
    name: 'Example Service Review Office',
    institutionType: 'crown_corporation',
    riskSurface: 'general_governance',
  })
  await assignSageRole(deps, ctxFor(a), {
    workspaceId: ws.id,
    actorId: a.actorId,
    role: 'evidence_steward',
    accessReason: 'x',
    approvedBy: a.actorId,
  })
  await addSageWorkspaceMember(deps, ctxFor(a), { workspaceId: ws.id, actorId: 'approver_1' })
  await assignSageRole(deps, ctxFor(a), {
    workspaceId: ws.id,
    actorId: 'approver_1',
    role: 'export_approver',
    accessReason: 'x',
    approvedBy: a.actorId,
  })
  const src = await createSageEvidenceSource(deps, ctxFor(a), { workspaceId: ws.id, sourceType: 'public' })
  await classifySageEvidenceSource(deps, ctxFor(a), {
    workspaceId: ws.id,
    sourceId: src.id,
    sourceQuality: 'high',
    authorizationLevel: 'internal',
  })
  const item = await createSageEvidenceItem(deps, ctxFor(a), {
    workspaceId: ws.id,
    sourceId: src.id,
    confidenceLevel: 'moderate',
  })
  const req = await requestSageExport(deps, ctxFor(a), {
    workspaceId: ws.id,
    purpose: 'internal review',
    evidenceItemIds: [item.id],
  })
  await approveSageExport(deps, ctxFor(approver()), { workspaceId: ws.id, exportRequestId: req.id, rationale: 'ok' })
  return { ws: ws.id, requestId: req.id }
}

describe('export package — atomic commit + durable audit outbox', () => {
  it('commits the package and dispatches the durable audit event', async () => {
    const { ws, requestId } = await setupApproved()
    const pkg = await generateSageExportPackage(deps, ctxFor(approver()), { workspaceId: ws, exportRequestId: requestId })
    expect(pkg.status).toBe('generated')
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_GENERATED)).toBe(true)
    // No pending outbox left once dispatched.
    expect(await repo.listPendingAuditOutbox(50)).toHaveLength(0)
  })

  it('keeps the package committed but the audit intent pending when the sink is down (crash window)', async () => {
    const { ws, requestId } = await setupApproved()
    sink.fail = true // audit sink temporarily unavailable
    const pkg = await generateSageExportPackage(deps, ctxFor(approver()), { workspaceId: ws, exportRequestId: requestId })
    // The material package IS committed…
    expect(pkg.status).toBe('generated')
    expect(await repo.getExportPackage(pkg.id, ws, 'org_1')).toBeDefined()
    // …but the audit event was NOT lost — it is durably pending.
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_GENERATED)).toBe(false)
    const pending = await repo.listPendingAuditOutbox(50)
    expect(pending.some((e) => e.action === SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_GENERATED)).toBe(true)
  })

  it('recovers the pending audit event on retry, once per successful drain (crash recovery)', async () => {
    const { ws, requestId } = await setupApproved()
    sink.fail = true
    await generateSageExportPackage(deps, ctxFor(approver()), { workspaceId: ws, exportRequestId: requestId })
    // Sink comes back; the dispatcher drains the durable outbox.
    sink.fail = false
    const r1 = await dispatchPendingSageAuditOutbox(deps, { now: () => NOW })
    expect(r1.dispatched).toBeGreaterThanOrEqual(1)
    expect(sink.count(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_GENERATED)).toBe(1)
    // A second drain finds nothing claimable — the row is 'dispatched' and its
    // lease is closed, so no duplicate delivery for a successfully-dispatched row.
    const r2 = await dispatchPendingSageAuditOutbox(deps, { now: () => NOW })
    expect(r2.dispatched).toBe(0)
    expect(sink.count(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_GENERATED)).toBe(1)
  })

  it('concurrent generation yields one package, one storage object, one audit event', async () => {
    const { ws, requestId } = await setupApproved()
    const [a, b] = await Promise.all([
      generateSageExportPackage(deps, ctxFor(approver()), { workspaceId: ws, exportRequestId: requestId }),
      generateSageExportPackage(deps, ctxFor(approver()), { workspaceId: ws, exportRequestId: requestId }),
    ])
    expect(a.id).toBe(b.id) // callers receive the same package
    expect(await repo.listExportPackages(ws, 'org_1')).toHaveLength(1)
    expect(sink.count(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_GENERATED)).toBe(1)
  })

  it('rejects a package object commit with a conflicting content hash at the same reference', async () => {
    // Directly exercise the insert-only, content-addressed object guard.
    await expect(
      repo.commitExportPackage({
        package: {
          orgId: 'org_1',
          workspaceId: 'ws_x',
          exportRequestId: 'req_x',
          status: 'generated',
          packageType: 'internal_review_bundle',
          manifestJson: '{"items":[]}',
          manifestHash: 'mh',
          contentHash: 'ch-1',
          storageReference: 'sage-internal://dup',
          mediaType: 'application/json',
          sizeBytes: 3,
          policyVersion: 'sage-export-v1',
          itemCount: 0,
          excludedCount: 0,
          generatedBy: 'actor_1',
          generatedAt: NOW,
          createdAt: NOW,
        },
        object: { storageReference: 'sage-internal://dup', mediaType: 'application/json', bytes: new TextEncoder().encode('{}'), contentHash: 'ch-1', sizeBytes: 2 },
        auditEvent: { eventId: 'e1', actorId: 'actor_1', action: 'sage.export.package_generated', resourceType: 'sage_export_package', safePayload: {} },
      }),
    ).resolves.toBeDefined()

    await expect(
      repo.commitExportPackage({
        package: {
          orgId: 'org_1',
          workspaceId: 'ws_y',
          exportRequestId: 'req_y',
          status: 'generated',
          packageType: 'internal_review_bundle',
          manifestJson: '{"items":[]}',
          manifestHash: 'mh',
          contentHash: 'ch-2',
          storageReference: 'sage-internal://dup', // same reference, DIFFERENT content
          mediaType: 'application/json',
          sizeBytes: 3,
          policyVersion: 'sage-export-v1',
          itemCount: 0,
          excludedCount: 0,
          generatedBy: 'actor_1',
          generatedAt: NOW,
          createdAt: NOW,
        },
        object: { storageReference: 'sage-internal://dup', mediaType: 'application/json', bytes: new TextEncoder().encode('xx'), contentHash: 'ch-2', sizeBytes: 2 },
        auditEvent: { eventId: 'e2', actorId: 'actor_1', action: 'sage.export.package_generated', resourceType: 'sage_export_package', safePayload: {} },
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})

describe('export package — stored-content integrity verification', () => {
  async function generated(): Promise<{ ws: string; packageId: string }> {
    const { ws, requestId } = await setupApproved()
    const pkg = await generateSageExportPackage(deps, ctxFor(approver()), { workspaceId: ws, exportRequestId: requestId })
    return { ws, packageId: pkg.id }
  }

  it('downloads untouched stored bytes successfully', async () => {
    const { ws, packageId } = await generated()
    const content = await getSageExportPackageContent(deps, ctxFor(approver()), { workspaceId: ws, packageId })
    expect(content.bytes.byteLength).toBeGreaterThan(0)
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_ACCESS_AUTHORIZED)).toBe(true)
  })

  it('rejects modified object bytes (recomputed SHA-256 mismatch)', async () => {
    const { ws, packageId } = await generated()
    repo.tamperBytes = new TextEncoder().encode('{"manifest":{"tampered":true}}')
    await expect(
      getSageExportPackageContent(deps, ctxFor(approver()), { workspaceId: ws, packageId }),
    ).rejects.toMatchObject({ code: 'INTEGRITY_ERROR' })
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_ACCESS_AUTHORIZED)).toBe(false)
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_ACCESS_DENIED)).toBe(true)
  })

  it('rejects a mismatched stored object content hash', async () => {
    const { ws, packageId } = await generated()
    repo.tamperContentHash = 'deadbeef'
    await expect(
      getSageExportPackageContent(deps, ctxFor(approver()), { workspaceId: ws, packageId }),
    ).rejects.toMatchObject({ code: 'INTEGRITY_ERROR' })
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_ACCESS_AUTHORIZED)).toBe(false)
  })

  it('rejects a package pointing to a missing object', async () => {
    const { ws, packageId } = await generated()
    repo.dropObject = true
    await expect(
      getSageExportPackageContent(deps, ctxFor(approver()), { workspaceId: ws, packageId }),
    ).rejects.toMatchObject({ code: 'INTEGRITY_ERROR' })
    expect(sink.has(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_ACCESS_AUTHORIZED)).toBe(false)
  })
})

describe('verifySageExportPackageBytes (real SHA-256, all failure modes)', () => {
  it('accepts untouched bytes, and rejects content/manifest/malformed tampering', async () => {
    const { buildSageExportPackage } = await import('./export-package')
    const { verifySageExportPackageBytes } = await import('./export-package')
    const { canonicalizeSageExportScope, sha256Hex, canonicalJsonStringify } = await import('./export-scope')
    const scope = canonicalizeSageExportScope({
      policyVersion: 'sage-export-v1',
      packageType: 'internal_review_bundle',
      items: [
        {
          resourceType: 'evidence_item',
          resourceId: 'id-a',
          contentHash: 'hash-a',
          authorizationLevel: 'internal',
          excludedFromExternalReview: false,
          included: true,
          exclusionReason: null,
          order: 0,
        },
      ],
    })
    const artifact = buildSageExportPackage({
      scope,
      workspaceId: 'ws',
      exportRequestId: 'req',
      approvedScopeHash: 'h',
      resources: [{ resourceType: 'evidence_item', resourceId: 'id-a', authorizationLevel: 'internal', contentHash: 'hash-a', content: { id: 'id-a' } }],
    })
    const expected = { contentHash: artifact.contentHash, manifestHash: artifact.manifestHash }

    // 1. Untouched bytes verify.
    expect(verifySageExportPackageBytes(artifact.contentBytes, expected).ok).toBe(true)

    // 2. Modified bytes → content_hash mismatch.
    const flipped = new TextEncoder().encode(new TextDecoder().decode(artifact.contentBytes) + ' ')
    expect(verifySageExportPackageBytes(flipped, expected)).toMatchObject({ ok: false, reason: 'content_hash' })

    // 3. Manifest changed but content hash "recomputed" → manifest_hash mismatch.
    const doc = JSON.parse(new TextDecoder().decode(artifact.contentBytes)) as { manifest: Record<string, unknown> }
    doc.manifest = { ...doc.manifest, tampered: true }
    const tamperedBytes = new TextEncoder().encode(canonicalJsonStringify(doc))
    expect(
      verifySageExportPackageBytes(tamperedBytes, { contentHash: sha256Hex(tamperedBytes), manifestHash: expected.manifestHash }),
    ).toMatchObject({ ok: false, reason: 'manifest_hash' })

    // 4. Malformed (non-JSON) bytes.
    const malformed = new TextEncoder().encode('not json{')
    expect(
      verifySageExportPackageBytes(malformed, { contentHash: sha256Hex(malformed), manifestHash: expected.manifestHash }),
    ).toMatchObject({ ok: false, reason: 'malformed' })
  })
})

// ─── Loser-path correctness: a commit that does NOT win the generation claim ──
// must produce NO side effects — no orphan object, no package, no audit intent.

describe('export package commit — loser paths have no side effects', () => {
  function commitInput(over: {
    exportRequestId: string
    storageReference: string
    contentHash: string
    eventId: string
  }) {
    return {
      package: {
        orgId: 'org_1',
        workspaceId: 'ws_1',
        exportRequestId: over.exportRequestId,
        status: 'generated' as const,
        packageType: 'internal_review_bundle' as const,
        manifestJson: '{"items":[]}',
        manifestHash: 'mh',
        contentHash: over.contentHash,
        storageReference: over.storageReference,
        mediaType: 'application/json',
        sizeBytes: 2,
        policyVersion: 'sage-export-v1',
        itemCount: 0,
        excludedCount: 0,
        generatedBy: 'actor_1',
        generatedAt: NOW,
        createdAt: NOW,
      },
      object: {
        storageReference: over.storageReference,
        mediaType: 'application/json',
        bytes: new TextEncoder().encode('{}'),
        contentHash: over.contentHash,
        sizeBytes: 2,
      },
      auditEvent: {
        eventId: over.eventId,
        actorId: 'actor_1',
        action: 'sage.export.package_generated' as const,
        resourceType: 'sage_export_package' as const,
        safePayload: {},
      },
    }
  }

  it('a second commit for the same request inserts no new object/package/outbox', async () => {
    const first = await repo.commitExportPackage(
      commitInput({ exportRequestId: 'req_1', storageReference: 'ref_1', contentHash: 'ch_1', eventId: 'e_1' }),
    )
    expect(first.created).toBe(true)
    expect(await repo.listPendingAuditOutbox(50)).toHaveLength(1)

    // A loser supplies a DIFFERENT object reference/content for the SAME request.
    const second = await repo.commitExportPackage(
      commitInput({ exportRequestId: 'req_1', storageReference: 'ref_2', contentHash: 'ch_2', eventId: 'e_2' }),
    )
    expect(second.created).toBe(false)
    expect(second.package.id).toBe(first.package.id)
    // No orphan object at the loser's reference.
    expect(await repo.getExportPackageObject('ref_2')).toBeUndefined()
    // Still exactly one package and one (original) pending audit intent.
    expect(await repo.listExportPackages('ws_1', 'org_1')).toHaveLength(1)
    const pending = await repo.listPendingAuditOutbox(50)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.eventId).toBe('e_1')
  })

  it('a conflicting content hash at the same reference commits no package/outbox', async () => {
    await repo.commitExportPackage(
      commitInput({ exportRequestId: 'req_a', storageReference: 'ref_shared', contentHash: 'ch_a', eventId: 'e_a' }),
    )
    await expect(
      repo.commitExportPackage(
        commitInput({ exportRequestId: 'req_b', storageReference: 'ref_shared', contentHash: 'ch_b', eventId: 'e_b' }),
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT' })
    // The conflicting request produced no package and no audit intent.
    expect(await repo.getExportPackageByRequest('req_b', 'ws_1', 'org_1')).toBeUndefined()
    const pending = await repo.listPendingAuditOutbox(50)
    expect(pending.map((e) => e.eventId)).toEqual(['e_a'])
  })
})

// ─── Outbox delivery: leased claim + owner fencing (at-least-once) ────────────

describe('audit outbox — leased claim + owner fencing', () => {
  async function enqueue(eventId: string): Promise<void> {
    await repo.enqueueAuditOutbox({
      intent: {
        eventId,
        actorId: 'actor_1',
        action: SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_GENERATED,
        resourceType: 'sage_export_package',
        safePayload: {},
      },
      orgId: 'org_1',
      workspaceId: 'ws_1',
      resourceId: 'pkg_1',
      createdAt: NOW,
    })
  }

  it('only one owner can hold a live claim; the other cannot mark or release it', async () => {
    await enqueue('ev_fence')
    const lease = '2026-07-12T00:00:30.000Z'
    const a = await repo.claimAuditOutboxEvent({ eventId: 'ev_fence', owner: 'owner_A', leaseExpiresAt: lease, now: NOW })
    expect(a).toBeDefined()
    // A live event cannot be claimed by a second owner.
    const b = await repo.claimAuditOutboxEvent({ eventId: 'ev_fence', owner: 'owner_B', leaseExpiresAt: lease, now: NOW })
    expect(b).toBeUndefined()
    // A non-owner cannot finalize or release the claim (fencing).
    expect(await repo.markAuditOutboxDispatched('ev_fence', 'owner_B', NOW)).toBe(false)
    expect(await repo.releaseAuditOutbox('ev_fence', 'owner_B', 'x')).toBe(false)
    // The true owner can finalize.
    expect(await repo.markAuditOutboxDispatched('ev_fence', 'owner_A', NOW)).toBe(true)
    expect(await repo.listPendingAuditOutbox(50)).toHaveLength(0)
  })

  it('reclaims a stale (expired-lease) claim exactly once and increments attempt_count', async () => {
    await enqueue('ev_stale')
    // Owner A claims with a lease that is already expired relative to "later".
    const claimedA = await repo.claimAuditOutboxEvent({
      eventId: 'ev_stale',
      owner: 'owner_A',
      leaseExpiresAt: '2026-07-12T00:00:10.000Z',
      now: NOW,
    })
    expect(claimedA?.attemptCount).toBe(1)
    // Later, B drains: the expired lease is reclaimable.
    const later = '2026-07-12T00:05:00.000Z'
    const reclaimed = await repo.claimPendingAuditOutbox({
      owner: 'owner_B',
      leaseExpiresAt: '2026-07-12T00:05:30.000Z',
      limit: 10,
      now: later,
    })
    expect(reclaimed).toHaveLength(1)
    expect(reclaimed[0]?.eventId).toBe('ev_stale')
    expect(reclaimed[0]?.attemptCount).toBe(2)
  })

  it('two concurrent dispatchers deliver a pending event once (single claim wins)', async () => {
    await enqueue('ev_race')
    const [r1, r2] = await Promise.all([
      dispatchPendingSageAuditOutbox(deps, { now: () => NOW }),
      dispatchPendingSageAuditOutbox(deps, { now: () => NOW }),
    ])
    expect(r1.dispatched + r2.dispatched).toBe(1)
    expect(sink.count(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_GENERATED)).toBe(1)
    expect(await repo.listPendingAuditOutbox(50)).toHaveLength(0)
  })

  it('a sink failure releases the claim back to pending for a later retry', async () => {
    await enqueue('ev_retry')
    sink.fail = true
    const failed = await dispatchPendingSageAuditOutbox(deps, { now: () => NOW })
    expect(failed.failed).toBe(1)
    // The event is pending again (reclaimable), with an incremented attempt.
    const pending = await repo.listPendingAuditOutbox(50)
    expect(pending).toHaveLength(1)
    expect(pending[0]?.attemptCount).toBe(1)
    // Sink recovers; the retry delivers it.
    sink.fail = false
    const ok = await dispatchPendingSageAuditOutbox(deps, { now: () => NOW })
    expect(ok.dispatched).toBe(1)
    expect(sink.count(SAGE_AUDIT_ACTIONS.EXPORT_PACKAGE_GENERATED)).toBe(1)
  })
})
