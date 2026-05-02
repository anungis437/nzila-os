import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  buildNarExportPack,
  canonicalStringify,
  createNarRecord,
  verifyNarRecord,
} from './index'
import type { DecisionRecord } from '@nzila/decision-core'

function makeDecision(partial?: Partial<DecisionRecord>): DecisionRecord {
  return {
    id: partial?.id ?? randomUUID(),
    organizationId: partial?.organizationId ?? randomUUID(),
    domain: partial?.domain ?? 'platform',
    resourceType: partial?.resourceType ?? 'workflow',
    resourceId: partial?.resourceId ?? randomUUID(),
    actor: partial?.actor ?? { id: 'actor-1', type: 'user', authorityScope: ['workflow:execute'] },
    input: partial?.input ?? { requestId: 'req-1', nested: { a: 1, b: 2 } },
    policy: partial?.policy ?? { id: 'platform.workflow.authorization', version: '1.0.0', domain: 'platform' },
    outcome: partial?.outcome ?? { status: 'approved' },
    createdAt: partial?.createdAt ?? new Date().toISOString(),
  }
}

describe('nar record', () => {
  it('produces canonical JSON with stable key ordering', () => {
    const first = canonicalStringify({ b: 2, a: 1, nested: { y: 2, x: 1 } })
    const second = canonicalStringify({ nested: { x: 1, y: 2 }, a: 1, b: 2 })
    expect(first).toBe(second)
  })

  it('detects tampering via hash mismatch', async () => {
    const record = await createNarRecord({
      decision: makeDecision(),
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow.execute',
      isGenesis: true,
      secret: 'unit-secret',
      keyId: 'unit',
    })

    const tampered = {
      ...record,
      payload: {
        ...record.payload,
        resourceId: 'tampered',
      },
    }

    const verification = await verifyNarRecord(tampered, 'unit-secret')
    expect(verification.valid).toBe(false)
    expect(verification.errors).toContain('NAR hash mismatch')
  })

  it('validates signatures and previous-hash linkage values', async () => {
    const first = await createNarRecord({
      decision: makeDecision({ id: 'decision-1' }),
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow.execute',
      isGenesis: true,
      secret: 'unit-secret',
      keyId: 'unit',
    })

    const second = await createNarRecord({
      decision: makeDecision({ id: 'decision-2', organizationId: first.organizationId }),
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow.execute',
      previousHash: first.seal.hash,
      secret: 'unit-secret',
      keyId: 'unit',
    })

    expect(second.seal.previousHash).toBe(first.seal.hash)
    const verification = await verifyNarRecord(second, 'unit-secret')
    expect(verification.valid).toBe(true)
  })

  it('builds deterministic export pack hash for identical records', async () => {
    const decision = makeDecision({ id: 'decision-pack', organizationId: 'org-pack' })
    const one = await createNarRecord({
      decision,
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow.execute',
      isGenesis: true,
      secret: 'unit-secret',
      keyId: 'unit',
    })

    const two = await createNarRecord({
      decision: { ...decision, id: 'decision-pack-2' },
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow.execute',
      previousHash: one.seal.hash,
      secret: 'unit-secret',
      keyId: 'unit',
    })

    const packA = await buildNarExportPack([one, two], 'org-pack', {
      signingSecret: 'unit-secret',
      generatedAt: '2026-01-01T00:00:00.000Z',
    })
    const packB = await buildNarExportPack([one, two], 'org-pack', {
      signingSecret: 'unit-secret',
      generatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(packA.verification.checksum).toBe(packB.verification.checksum)
    expect(packA.chainProof.totalRecords).toBe(2)
    expect(packA.chainProof.rootHash).toBe(two.seal.hash)
  })

  it('fails record creation when previousHash is omitted for non-genesis records', async () => {
    await expect(
      createNarRecord({
        decision: makeDecision(),
        decisionType: 'platform.workflow.executed',
        actionType: 'workflow.execute',
        secret: 'unit-secret',
        keyId: 'unit',
      }),
    ).rejects.toThrow('previousHash is required')
  })
})
