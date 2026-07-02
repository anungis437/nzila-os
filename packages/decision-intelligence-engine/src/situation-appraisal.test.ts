import { describe, it, expect, beforeEach } from 'vitest'
import { SituationAppraisalEngine } from './engines/situation-appraisal.js'
import type { SituationAppraisalStore } from './store.js'
import type { SituationAssessment } from './schema/situation.js'

// ─── In-memory store for testing ─────────────────────────────────────────────

function makeSituationStore(): SituationAppraisalStore {
  const db = new Map<string, SituationAssessment>()
  return {
    async append(a) { db.set(a.id, a) },
    async getById(id) { return db.get(id) },
    async getByOrg(orgId, opts) {
      const all = [...db.values()].filter((a) => a.orgId === orgId)
      if (opts?.status) return all.filter((a) => a.status === opts.status)
      return all
    },
    async update(id, delta) {
      const existing = db.get(id)
      if (!existing) throw new Error(`Not found: ${id}`)
      const updated = { ...existing, ...delta } as SituationAssessment
      db.set(id, updated)
      return updated
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SituationAppraisalEngine', () => {
  let engine: SituationAppraisalEngine

  beforeEach(() => {
    engine = new SituationAppraisalEngine(makeSituationStore())
  })

  it('records an assessment and computes priority score', async () => {
    const assessment = await engine.record({
      orgId: 'org-1',
      category: 'governance',
      concern: 'Evidence chain latency exceeds SLA by 3×',
      urgency: 4,
      impact: 3,
      trend: 'worsening',
      evidenceRefs: ['ev-001'],
      dependencies: ['audit-service'],
      unknowns: [],
      recommendedActions: ['Scale evidence worker'],
      escalationThreshold: 'urgency >= 4 AND impact >= 4',
      ownerId: 'actor-1',
      continuityImplications: ['Evidence pack generation may fail'],
      status: 'open',
    })

    expect(assessment.id).toBeDefined()
    expect(assessment.priorityScore).toBe(12) // 4 × 3
    expect(assessment.escalated).toBe(false)
  })

  it('triggers escalation when urgency × impact are both >= 4', async () => {
    const high = await engine.record({
      orgId: 'org-1',
      category: 'security',
      concern: 'Credential exposure in audit log',
      urgency: 5,
      impact: 5,
      trend: 'volatile',
      evidenceRefs: [],
      dependencies: [],
      unknowns: ['Scope of exposure unknown'],
      recommendedActions: ['Rotate credentials immediately'],
      escalationThreshold: 'urgency >= 4 AND impact >= 4',
      ownerId: 'actor-1',
      continuityImplications: [],
      status: 'open',
    })

    expect(engine.evaluateEscalation(high)).toBe(true)
    expect(high.priorityScore).toBe(25) // max
  })

  it('does not trigger escalation when impact is low', async () => {
    const low = await engine.record({
      orgId: 'org-1',
      category: 'operational',
      concern: 'Minor UI rendering delay',
      urgency: 2,
      impact: 2,
      trend: 'stable',
      evidenceRefs: [],
      dependencies: [],
      unknowns: [],
      recommendedActions: [],
      escalationThreshold: 'urgency >= 4 AND impact >= 4',
      ownerId: 'actor-1',
      continuityImplications: [],
      status: 'open',
    })

    expect(engine.evaluateEscalation(low)).toBe(false)
  })

  it('prioritizes by descending priority score', async () => {
    const store = makeSituationStore()
    const eng = new SituationAppraisalEngine(store)

    await eng.record({
      orgId: 'org-2', category: 'financial', concern: 'Low', urgency: 1, impact: 1, trend: 'stable',
      evidenceRefs: [], dependencies: [], unknowns: [], recommendedActions: [],
      escalationThreshold: '', ownerId: 'a', continuityImplications: [], status: 'open',
    })
    await eng.record({
      orgId: 'org-2', category: 'continuity', concern: 'High', urgency: 5, impact: 5, trend: 'worsening',
      evidenceRefs: [], dependencies: [], unknowns: [], recommendedActions: [],
      escalationThreshold: '', ownerId: 'a', continuityImplications: [], status: 'open',
    })
    await eng.record({
      orgId: 'org-2', category: 'governance', concern: 'Medium', urgency: 3, impact: 3, trend: 'stable',
      evidenceRefs: [], dependencies: [], unknowns: [], recommendedActions: [],
      escalationThreshold: '', ownerId: 'a', continuityImplications: [], status: 'open',
    })

    const entries = await eng.prioritize('org-2')
    expect(entries[0].assessment.concern).toBe('High')
    expect(entries[1].assessment.concern).toBe('Medium')
    expect(entries[2].assessment.concern).toBe('Low')
  })

  it('computes org signal score as mean priority of open assessments', async () => {
    const assessments = [
      { priorityScore: 20, status: 'open' },
      { priorityScore: 10, status: 'open' },
      { priorityScore: 5, status: 'resolved' }, // excluded
    ] as SituationAssessment[]

    const score = engine.computeOrgSignalScore(assessments)
    expect(score).toBe(15) // (20 + 10) / 2
  })

  it('resolves an assessment', async () => {
    const store = makeSituationStore()
    const eng = new SituationAppraisalEngine(store)

    const a = await eng.record({
      orgId: 'org-3', category: 'compliance', concern: 'Audit gap', urgency: 2, impact: 3,
      trend: 'stable', evidenceRefs: [], dependencies: [], unknowns: [],
      recommendedActions: [], escalationThreshold: '', ownerId: 'u1',
      continuityImplications: [], status: 'open',
    })

    const resolved = await eng.resolve(a.id)
    expect(resolved.status).toBe('resolved')
  })
})
