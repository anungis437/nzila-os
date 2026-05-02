import { describe, expect, it } from 'vitest'
import type { DecisionRecord } from '@nzila/decision-core'
import { createNarRecord } from './record'
import { verifyFullChain } from './chain-verify'

function makeDecision(id: string, organizationId: string): DecisionRecord {
  return {
    id,
    organizationId,
    domain: 'platform',
    resourceType: 'workflow',
    resourceId: `resource-${id}`,
    actor: { id: 'actor-1', type: 'user', authorityScope: ['workflow:execute'] },
    input: { workflowId: 'wf-1', requestId: id },
    policy: { id: 'platform.workflow.execution', version: '1.0.0', domain: 'platform' },
    outcome: { status: 'approved' },
    createdAt: new Date().toISOString(),
  }
}

describe('verifyFullChain', () => {
  it('detects chain breaks when a record is removed', async () => {
    const orgId = 'org-chain'
    const r1 = await createNarRecord({
      decision: makeDecision('d1', orgId),
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow:execute',
      isGenesis: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      secret: 'unit-secret',
    })
    const r2 = await createNarRecord({
      decision: makeDecision('d2', orgId),
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow:execute',
      previousHash: r1.seal.hash,
      createdAt: '2026-01-01T00:01:00.000Z',
      secret: 'unit-secret',
    })
    const r3 = await createNarRecord({
      decision: makeDecision('d3', orgId),
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow:execute',
      previousHash: r2.seal.hash,
      createdAt: '2026-01-01T00:02:00.000Z',
      secret: 'unit-secret',
    })

    const verification = await verifyFullChain({ organizationId: orgId, records: [r1, r3], signingSecret: 'unit-secret' })

    expect(verification.valid).toBe(false)
    expect(verification.corruptionIndex).toBe(1)
    expect(verification.anomalies.some((item) => item.reason.includes('Chain break'))).toBe(true)
  })
})
