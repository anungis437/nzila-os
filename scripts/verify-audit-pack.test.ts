import { describe, expect, it } from 'vitest'
import type { DecisionRecord } from '@nzila/decision-core'
import { createNarRecord, buildNarExportPack } from '@nzila/nar'
import { verifyAuditPack } from './verify-audit-pack'

function makeDecision(id: string, organizationId: string): DecisionRecord {
  return {
    id,
    organizationId,
    domain: 'platform',
    resourceType: 'workflow',
    resourceId: `resource-${id}`,
    actor: { id: 'actor-1', type: 'user', authorityScope: ['workflow:execute'] },
    input: { requestId: id },
    policy: { id: 'platform.workflow.execution', version: '1.0.0', domain: 'platform' },
    outcome: { status: 'approved' },
    createdAt: new Date().toISOString(),
  }
}

describe('verifyAuditPack', () => {
  it('verifies signed export pack integrity', async () => {
    const orgId = 'org-verify-pack'
    const r1 = await createNarRecord({
      decision: makeDecision('d1', orgId),
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow:execute',
      isGenesis: true,
      secret: 'unit-secret',
    })
    const r2 = await createNarRecord({
      decision: makeDecision('d2', orgId),
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow:execute',
      previousHash: r1.seal.hash,
      secret: 'unit-secret',
    })

    const pack = await buildNarExportPack([r1, r2], orgId, { signingSecret: 'unit-secret', generatedBy: 'test' })
    const result = await verifyAuditPack(pack, 'unit-secret')

    expect(result.valid).toBe(true)
  })

  it('fails when export pack is tampered', async () => {
    const orgId = 'org-verify-pack-2'
    const r1 = await createNarRecord({
      decision: makeDecision('d1', orgId),
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow:execute',
      isGenesis: true,
      secret: 'unit-secret',
    })
    const pack = await buildNarExportPack([r1], orgId, { signingSecret: 'unit-secret', generatedBy: 'test' })

    const tampered = {
      ...pack,
      records: [
        {
          ...pack.records[0],
          resourceId: 'tampered',
        },
      ],
    }

    const result = await verifyAuditPack(tampered, 'unit-secret')
    expect(result.valid).toBe(false)
  })
})
