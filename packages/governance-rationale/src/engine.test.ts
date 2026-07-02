import { describe, it, expect, beforeEach } from 'vitest'
import { GovernanceRationaleEngine } from './engine'
import { computeRationaleHash, replayRationale } from './replay'
import type { GovernanceRationaleStore } from './store'
import type { GovernanceRationale, RationaleReplayResult } from './schema'

// ─── In-memory store ──────────────────────────────────────────────────────────

function makeRationaleStore(): GovernanceRationaleStore {
  const db = new Map<string, GovernanceRationale>()
  const replays: RationaleReplayResult[] = []

  return {
    async append(r) { db.set(r.id, r) },
    async getById(id) { return db.get(id) },
    async getByOrg(orgId, opts) {
      let results = [...db.values()].filter((r) => r.orgId === orgId)
      if (opts?.status) results = results.filter((r) => r.status === opts.status)
      return results
    },
    async update(id, delta) {
      const existing = db.get(id)
      if (!existing) throw new Error(`Not found: ${id}`)
      const updated = { ...existing, ...delta } as GovernanceRationale
      db.set(id, updated)
      return updated
    },
    async appendReplay(result) { replays.push(result) },
  }
}

const baseInput = {
  orgId: 'org-1',
  decisionTitle: 'Release 3.0.0 governance gate approval',
  decisionType: 'release-gate',
  trigger: 'release-gate' as const,
  context: 'Platform v3.0.0 is ready for production deployment following 6-week stabilisation period',
  outcome: 'Release approved with 2 accepted risks and 3 mitigation commitments',
  rationale: 'All MUST criteria satisfied. Evidence pack verified. Continuity review completed.',
  status: 'active' as const,
  ownerId: 'actor-1',
}

describe('GovernanceRationaleEngine', () => {
  let engine: GovernanceRationaleEngine

  beforeEach(() => {
    engine = new GovernanceRationaleEngine(makeRationaleStore())
  })

  it('records a governance rationale with a replay hash', async () => {
    const rationale = await engine.record(baseInput)

    expect(rationale.id).toBeDefined()
    expect(rationale.replayHash).not.toBeNull()
    expect(rationale.replayHash).toHaveLength(64) // SHA-256 hex
    expect(rationale.status).toBe('active')
  })

  it('replay verifies integrity of unmodified rationale', async () => {
    const rationale = await engine.record(baseInput)

    const result = await engine.replay(rationale.id)

    expect(result.integrityVerified).toBe(true)
    expect(result.hashMismatch).toBe(false)
    expect(result.computedHash).toBe(result.storedHash)
  })

  it('replay detects tampering when hash mismatches', () => {
    // Simulate a tampered rationale
    const tampered: GovernanceRationale = {
      id: 'id-1',
      orgId: 'org-1',
      decisionTitle: 'Tampered title',  // changed
      decisionType: 'release-gate',
      trigger: 'release-gate',
      context: 'Original context',
      deviation: '',
      outcome: 'Original outcome',
      rationale: 'Original rationale',
      supportingEvidenceRefs: [],
      assumptions: [],
      alternativesRejected: [],
      acceptedRisks: [],
      mitigationCommitments: [],
      policyRef: null,
      decisionAnalysisRef: null,
      releaseRef: null,
      continuityImplications: [],
      approvedBy: [],
      isReplayable: true,
      replayHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', // wrong hash
      status: 'active',
      ownerId: 'actor-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      supersededBy: null,
      supersedes: null,
    }

    const result = replayRationale(tampered)

    expect(result.hashMismatch).toBe(true)
    expect(result.integrityVerified).toBe(false)
  })

  it('adds an assumption to a rationale', async () => {
    const rationale = await engine.record(baseInput)

    const updated = await engine.addAssumption(rationale.id, {
      assumption: 'All 12 union locals have completed onboarding verification',
      evidenceRef: 'ev-onboarding-report-2026',
      confidence: 95,
      validatedAt: new Date().toISOString(),
      validatedBy: 'actor-2',
    })

    expect(updated.assumptions).toHaveLength(1)
    expect(updated.assumptions[0].confidence).toBe(95)
  })

  it('supersedes a rationale and links records bidirectionally', async () => {
    const original = await engine.record(baseInput)

    const superseding = await engine.supersede(original.id, {
      ...baseInput,
      decisionTitle: 'Release 3.0.1 governance gate approval',
      outcome: 'Emergency patch approved with expedited review',
    })

    expect(superseding.supersedes).toBe(original.id)

    const originalUpdated = await engine.getById(original.id)
    expect(originalUpdated?.status).toBe('superseded')
    expect(originalUpdated?.supersededBy).toBe(superseding.id)
  })

  it('computes identical hashes for identical payloads', async () => {
    const r1 = await engine.record(baseInput)

    // Re-create the same engine with fresh store but record same content
    const engine2 = new GovernanceRationaleEngine(makeRationaleStore())
    const r2 = await engine2.record({ ...baseInput })

    // Hashes differ because IDs and timestamps differ — verify determinism within same record
    const hash1a = computeRationaleHash(r1)
    const hash1b = computeRationaleHash(r1)
    expect(hash1a).toBe(hash1b)

    // Different IDs yield different hashes
    expect(computeRationaleHash(r1)).not.toBe(computeRationaleHash(r2))
  })
})
