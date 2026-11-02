import { describe, expect, it } from 'vitest'
import { CreateDecisionNodeSchema, CreateDecisionEdgeSchema, DecisionEdgeTypes } from './types'

const node = { tenantId: '11111111-1111-4111-8111-111111111111', decisionType: 'approval', actorType: 'user', actorId: 'actor-1', entityType: 'Case', entityId: '22222222-2222-4222-8222-222222222222', summary: 'Approved', outcome: { approved: true, evidence: ['ref-1'] } }

describe('Zod 4 decision graph boundary', () => {
  it('preserves decision outcomes and defaults evidence lists', () => {
    const parsed = CreateDecisionNodeSchema.parse(node)
    expect(parsed.outcome).toEqual(node.outcome)
    expect(parsed.evidenceRefs).toEqual([])
    const edge = { fromDecisionId: '11111111-1111-4111-8111-111111111111', toDecisionId: '22222222-2222-4222-8222-222222222222', edgeType: Object.values(DecisionEdgeTypes)[0], metadata: { source: 'test' } }
    expect(CreateDecisionEdgeSchema.parse(edge).metadata).toEqual(edge.metadata)
  })
  it('rejects invalid tenants and out-of-range confidence', () => {
    expect(CreateDecisionNodeSchema.safeParse({ ...node, tenantId: 'wrong' }).success).toBe(false)
    expect(CreateDecisionNodeSchema.safeParse({ ...node, confidence: 1.5 }).success).toBe(false)
  })
})
