import { describe, it, expect, beforeEach } from 'vitest'
import { ProblemAnalysisEngine } from './engines/problem-analysis'
import type { ProblemAnalysisStore } from './store'
import type { ProblemAnalysis } from './schema/problem'

// ─── In-memory store ──────────────────────────────────────────────────────────

function makeProblemStore(): ProblemAnalysisStore {
  const db = new Map<string, ProblemAnalysis>()
  return {
    async append(a) { db.set(a.id, a) },
    async getById(id) { return db.get(id) },
    async getByOrg(orgId) { return [...db.values()].filter((a) => a.orgId === orgId) },
    async update(id, delta) {
      const existing = db.get(id)
      if (!existing) throw new Error(`Not found: ${id}`)
      const updated = { ...existing, ...delta } as ProblemAnalysis
      db.set(id, updated)
      return updated
    },
  }
}

const baseInput = {
  orgId: 'org-1',
  title: 'Evidence chain latency deviation',
  description: 'Evidence generation time increased 3× after release 2.8.0',
  deviationType: 'operational-deviation' as const,
  what: {
    is: 'Evidence pack generation',
    isNot: 'Evidence pack verification',
    distinctives: ['Generation path uses new async worker'],
  },
  where: {
    is: 'Production environment — Azure West Europe',
    isNot: 'Staging environment',
    locations: ['prod-west-eu'],
  },
  when: {
    is: 'After release 2.8.0 deployment (2026-05-20T14:00:00Z)',
    isNot: 'Before release 2.8.0',
    firstOccurrence: '2026-05-20T14:05:00Z',
    lastOccurrence: null,
    pattern: 'continuous' as const,
  },
  extent: {
    is: 'All evidence pack generation requests',
    isNot: 'Read-only evidence queries',
    affectedCount: null,
    severityLevel: 4 as const,
  },
  evidenceRefs: ['ev-telemetry-001'],
  releaseCorrelations: [{
    releaseId: 'rel-2.8.0',
    releasedAt: '2026-05-20T14:00:00Z',
    changeDescription: 'Async evidence worker migration',
    correlationStrength: 'likely' as const,
  }],
  telemetryMarkers: [],
  governanceReplayRef: null,
  continuityImplications: ['Evidence pack SLA breach may trigger compliance gap'],
  situationAssessmentRef: null,
  status: 'open' as const,
  ownerId: 'actor-1',
}

describe('ProblemAnalysisEngine', () => {
  let engine: ProblemAnalysisEngine

  beforeEach(() => {
    engine = new ProblemAnalysisEngine(makeProblemStore())
  })

  it('initiates a problem analysis with zero confidence', async () => {
    const analysis = await engine.initiate(baseInput)

    expect(analysis.id).toBeDefined()
    expect(analysis.hypotheses).toHaveLength(0)
    expect(analysis.analysisConfidence).toBe(0)
    expect(analysis.status).toBe('open')
  })

  it('adds a hypothesis and updates confidence', async () => {
    const analysis = await engine.initiate(baseInput)

    const updated = await engine.addHypothesis(analysis.id, {
      hypothesis: 'Async worker thread pool exhausted under load',
      confidence: 70,
      evidenceFor: ['telemetry-spike-001'],
      evidenceAgainst: [],
      changeCorrelation: 'rel-2.8.0',
    })

    expect(updated.hypotheses).toHaveLength(1)
    expect(updated.hypotheses[0].status).toBe('proposed')
    expect(updated.analysisConfidence).toBeGreaterThan(0)
  })

  it('confirms a root cause and sets confidence to 100', async () => {
    const analysis = await engine.initiate(baseInput)
    const withHyp = await engine.addHypothesis(analysis.id, {
      hypothesis: 'Connection pool not properly sized for async workloads',
      confidence: 85,
      evidenceFor: ['conn-pool-metrics-001'],
      evidenceAgainst: [],
      changeCorrelation: 'rel-2.8.0',
    })

    const confirmed = await engine.confirmCause(analysis.id, withHyp.hypotheses[0].id)

    expect(confirmed.confirmedCause).toBe('Connection pool not properly sized for async workloads')
    expect(confirmed.status).toBe('confirmed')
    expect(confirmed.analysisConfidence).toBe(100)
  })

  it('rejects confirming a non-existent hypothesis', async () => {
    const analysis = await engine.initiate(baseInput)
    await expect(engine.confirmCause(analysis.id, 'non-existent-uuid')).rejects.toThrow()
  })

  it('adds a mitigation recommendation', async () => {
    const analysis = await engine.initiate(baseInput)

    const updated = await engine.addMitigation(analysis.id, {
      action: 'Increase async worker thread pool from 4 to 16',
      priority: 4,
      ownerId: 'actor-1',
      targetDate: '2026-05-28T00:00:00Z',
      evidenceRef: null,
    })

    expect(updated.mitigations).toHaveLength(1)
    expect(updated.mitigations[0].status).toBe('proposed')
  })

  it('closes an analysis', async () => {
    const analysis = await engine.initiate(baseInput)
    const closed = await engine.close(analysis.id)

    expect(closed.status).toBe('closed')
    expect(closed.closedAt).not.toBeNull()
  })
})
