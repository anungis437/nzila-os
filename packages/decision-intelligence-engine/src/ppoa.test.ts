import { describe, it, expect, beforeEach } from 'vitest'
import { PPOAEngine } from './engines/ppoa.js'
import type { PPOAStore } from './store.js'
import type { PPOAAnalysis } from './schema/ppoa.js'

// ─── In-memory store ──────────────────────────────────────────────────────────

function makePPOAStore(): PPOAStore {
  const db = new Map<string, PPOAAnalysis>()
  return {
    async append(a) { db.set(a.id, a) },
    async getById(id) { return db.get(id) },
    async getByOrg(orgId) { return [...db.values()].filter((a) => a.orgId === orgId) },
    async update(id, delta) {
      const existing = db.get(id)
      if (!existing) throw new Error(`Not found: ${id}`)
      const updated = { ...existing, ...delta } as PPOAAnalysis
      db.set(id, updated)
      return updated
    },
  }
}

describe('PPOAEngine', () => {
  let engine: PPOAEngine

  beforeEach(() => {
    engine = new PPOAEngine(makePPOAStore())
  })

  it('creates a PPOA analysis with full readiness score initially', async () => {
    const analysis = await engine.create({
      orgId: 'org-1',
      title: 'Release 3.0.0 PPOA',
      context: 'Major platform release including event sourcing migration',
      contextType: 'release',
      governanceMaturity: 'defined',
      status: 'preparing',
      ownerId: 'actor-1',
    })

    expect(analysis.id).toBeDefined()
    expect(analysis.operationalReadinessScore).toBe(100)
    expect(analysis.rolloutConfidenceScore).toBe(100)
    expect(analysis.risks).toHaveLength(0)
  })

  it('reduces readiness score when risks are added', async () => {
    const analysis = await engine.create({
      orgId: 'org-1',
      title: 'Union Eyes Phase 2 PPOA',
      context: 'Expand Union Eyes to Phase 2 locals',
      contextType: 'pilot',
      governanceMaturity: 'managed',
      status: 'preparing',
      ownerId: 'actor-1',
    })

    const updated = await engine.addRisk(analysis.id, {
      description: 'Integration API rate limits may be exceeded during onboarding surge',
      category: 'technical',
      probability: 4,
      severity: 3,
      detectionDifficulty: 2,
      preventionActions: ['Implement request throttling', 'Pre-warm connection pools'],
      contingencyActions: ['Stagger onboarding over 3 days'],
      ownerId: 'actor-1',
      residualRisk: 2,
      evidenceRef: null,
    })

    expect(updated.risks).toHaveLength(1)
    expect(updated.risks[0].riskScore).toBe(12) // 4 × 3
    expect(updated.operationalReadinessScore).toBeLessThan(100)
  })

  it('marks critical risks above threshold', async () => {
    const analysis = await engine.create({
      orgId: 'org-1',
      title: 'TrustCore Migration PPOA',
      context: 'Migrate TrustCore from monolith to microservices',
      contextType: 'migration',
      governanceMaturity: 'repeatable',
      status: 'preparing',
      ownerId: 'actor-1',
    })

    // Add a critical risk (5×5 = 25)
    const updated = await engine.addRisk(analysis.id, {
      description: 'Data loss during migration if rollback fails',
      category: 'continuity',
      probability: 5,
      severity: 5,
      detectionDifficulty: 3,
      preventionActions: ['Full backup before migration'],
      contingencyActions: ['Restore from backup snapshot'],
      ownerId: 'actor-1',
      residualRisk: 3,
      evidenceRef: null,
    })

    expect(updated.criticalRiskCount).toBe(1)
    const report = await engine.generateReadinessReport(analysis.id)
    expect(report.criticalRisks).toHaveLength(1)
    expect(report.recommendation).toBe('abort') // confidence will be very low
  })

  it('generates proceed recommendation when confidence is high', async () => {
    const analysis = await engine.create({
      orgId: 'org-2',
      title: 'Hotfix deployment PPOA',
      context: 'Emergency hotfix for locale redirect bug',
      contextType: 'deployment',
      governanceMaturity: 'defined',
      status: 'preparing',
      ownerId: 'actor-1',
    })

    // Small, low-severity risk
    await engine.addRisk(analysis.id, {
      description: 'Minor cache invalidation delay on first deploy',
      category: 'operational',
      probability: 2,
      severity: 1,
      detectionDifficulty: 1,
      preventionActions: ['Pre-warm cache after deploy'],
      contingencyActions: ['Manual cache flush'],
      ownerId: 'actor-1',
      residualRisk: 1,
      evidenceRef: null,
    })

    const report = await engine.generateReadinessReport(analysis.id)
    expect(report.operationalReadinessScore).toBeGreaterThan(80)
    expect(report.recommendation).toBe('proceed')
  })
})
