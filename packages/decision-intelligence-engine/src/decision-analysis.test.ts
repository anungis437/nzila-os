import { describe, it, expect, beforeEach } from 'vitest'
import { DecisionAnalysisEngine } from './engines/decision-analysis'
import type { DecisionAnalysisStore } from './store'
import type { DecisionAnalysis } from './schema/decision'

// ─── In-memory store ──────────────────────────────────────────────────────────

function makeDecisionStore(): DecisionAnalysisStore {
  const db = new Map<string, DecisionAnalysis>()
  return {
    async append(d) { db.set(d.id, d) },
    async getById(id) { return db.get(id) },
    async getByOrg(orgId) { return [...db.values()].filter((d) => d.orgId === orgId) },
    async update(id, delta) {
      const existing = db.get(id)
      if (!existing) throw new Error(`Not found: ${id}`)
      const updated = { ...existing, ...delta } as DecisionAnalysis
      db.set(id, updated)
      return updated
    },
  }
}

describe('DecisionAnalysisEngine', () => {
  let engine: DecisionAnalysisEngine

  beforeEach(() => {
    engine = new DecisionAnalysisEngine(makeDecisionStore())
  })

  it('creates a decision analysis with empty alternatives', async () => {
    const decision = await engine.create({
      orgId: 'org-1',
      title: 'Evidence storage vendor selection',
      objective: 'Select a compliant, cost-effective evidence storage provider',
      decisionType: 'vendor-selection',
      mustCriteria: [],
      wantCriteria: [],
      evidenceRefs: [],
      continuityImplications: [],
      supersedes: null,
      status: 'drafting',
      ownerId: 'actor-1',
    })

    expect(decision.id).toBeDefined()
    expect(decision.alternatives).toHaveLength(0)
    expect(decision.status).toBe('drafting')
  })

  it('scores alternatives using weighted criteria', async () => {
    const decision = await engine.create({
      orgId: 'org-1',
      title: 'Evidence DB selection',
      objective: 'Choose primary evidence store',
      decisionType: 'architecture',
      mustCriteria: [
        {
          id: 'must-1',
          label: 'PIPEDA compliant',
          description: 'Must meet Canadian privacy requirements',
          isGo: true,
        },
      ],
      wantCriteria: [
        { id: 'want-1', label: 'Cost efficiency', description: 'Monthly cost per GB', weight: 8 },
        { id: 'want-2', label: 'Query latency', description: 'p99 < 100ms', weight: 10 },
      ],
      evidenceRefs: [],
      continuityImplications: [],
      supersedes: null,
      status: 'drafting',
      ownerId: 'actor-1',
    })

    // Add compliant alternative
    await engine.addAlternative(decision.id, {
      name: 'Azure Blob Storage + Cosmos DB',
      description: 'Managed Azure stack with native PIPEDA attestation',
      mustScores: { 'must-1': true },
      wantScores: { 'want-1': 7, 'want-2': 9 },
      risks: [],
      assumptions: ['Azure SLA >= 99.9%'],
      notes: '',
    })

    // Add non-compliant alternative
    await engine.addAlternative(decision.id, {
      name: 'AWS S3 + DynamoDB',
      description: 'AWS stack without PIPEDA certification',
      mustScores: { 'must-1': false }, // fails must criterion
      wantScores: { 'want-1': 9, 'want-2': 10 },
      risks: ['No PIPEDA certification'],
      assumptions: [],
      notes: '',
    })

    const result = await engine.score(decision.id)

    expect(result.viableAlternatives).toHaveLength(1)
    expect(result.viableAlternatives[0].name).toBe('Azure Blob Storage + Cosmos DB')
    expect(result.eliminatedAlternatives).toHaveLength(1)
    expect(result.eliminatedAlternatives[0].failedCriteria).toContain('PIPEDA compliant')
    expect(result.recommendedAlternativeId).toBe(result.viableAlternatives[0].id)
  })

  it('records a decision with rationale and marks status as decided', async () => {
    const decision = await engine.create({
      orgId: 'org-1',
      title: 'Pilot approval: Union Eyes Phase 2',
      objective: 'Approve operational expansion of Union Eyes',
      decisionType: 'pilot-approval',
      mustCriteria: [],
      wantCriteria: [],
      evidenceRefs: [],
      continuityImplications: [],
      supersedes: null,
      status: 'drafting',
      ownerId: 'actor-1',
    })

    const withAlt = await engine.addAlternative(decision.id, {
      name: 'Proceed with full pilot',
      description: 'Deploy to all 12 union locals',
      mustScores: {},
      wantScores: {},
      risks: [],
      assumptions: [],
      notes: '',
    })

    const altId = withAlt.alternatives[0].id

    const decided = await engine.decide(
      decision.id,
      altId,
      'All must criteria satisfied. Union locals have completed training.',
      ['ev-training-001'],
    )

    expect(decided.selectedAlternativeId).toBe(altId)
    expect(decided.status).toBe('decided')
    expect(decided.decidedAt).not.toBeNull()
    expect(decided.rationale).toContain('must criteria satisfied')
  })

  it('records approver sign-offs and marks allApproversSignedOff', async () => {
    const decision = await engine.create({
      orgId: 'org-2',
      title: 'Architecture decision: event sourcing migration',
      objective: 'Migrate to CQRS + event sourcing',
      decisionType: 'architecture',
      mustCriteria: [],
      wantCriteria: [],
      evidenceRefs: [],
      continuityImplications: [],
      supersedes: null,
      status: 'under-review',
      ownerId: 'actor-1',
    })

    // Manually add approvers for test
    const withApprovers: DecisionAnalysis = {
      ...decision,
      approvers: [
        { id: 'ap-1', actorId: 'cto', role: 'CTO', approvedAt: null, signedOff: false, notes: '' },
        { id: 'ap-2', actorId: 'ciso', role: 'CISO', approvedAt: null, signedOff: false, notes: '' },
      ],
    }
    // Simulate store having these approvers
    const store = makeDecisionStore()
    await store.append(withApprovers)
    const eng2 = new DecisionAnalysisEngine(store)

    const afterCto = await eng2.signOff(decision.id, 'cto', 'Approved — technical risk acceptable')
    expect(afterCto.allApproversSignedOff).toBe(false)

    const afterCiso = await eng2.signOff(decision.id, 'ciso', 'Security review passed')
    expect(afterCiso.allApproversSignedOff).toBe(true)
  })
})
