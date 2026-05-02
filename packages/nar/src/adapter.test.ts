import { describe, expect, it } from 'vitest'
import { createNarProofAdapter } from './adapter'
import type { DecisionRecord } from '@nzila/decision-core'

function mockDecision(): DecisionRecord {
  return {
    id: 'decision-1',
    organizationId: 'org-1',
    domain: 'platform',
    resourceType: 'workflow',
    resourceId: 'wf-1',
    actor: {
      id: 'actor-1',
      type: 'user',
      authorityScope: ['workflow:execute'],
    },
    input: { workflowId: 'wf-1', requestId: 'req-1' },
    policy: { id: 'platform.workflow.execution', version: '1.0.0', domain: 'platform' },
    outcome: { status: 'approved' },
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('createNarProofAdapter', () => {
  it('maps decision-core proof creation to persisted NAR payload', async () => {
    const adapter = createNarProofAdapter({
      keyId: 'unit',
      getPreviousHash: async () => 'prev-hash',
      persistImmutableStorage: async () => ({
        type: 'azure_blob',
        uri: 'https://example.blob.core.windows.net/audit-records/org-1/unit.nar.json',
        immutable: true,
        retentionUntil: '2033-01-01T00:00:00.000Z',
      }),
      persistRecord: async (record) => ({ auditRecordId: record.id }),
      getSigningSecret: async () => 'unit-secret',
    })

    const proof = await adapter.createProof(mockDecision(), {
      decisionType: 'platform.workflow.executed',
      actionType: 'workflow:execute',
      entry: {
        type: 'platform.workflow.executed',
        domain: 'platform',
        resourceType: 'workflow-execution',
        requiredAuthority: ['workflow:execute'],
        requiredPolicy: 'platform.workflow.execution',
        auditRequired: true,
        replaySupported: true,
        exportSupported: true,
        retentionClass: 'platform_7_year',
        proofRequired: true,
        enforcementLevel: 'block',
      },
    })

    expect(proof.auditRecordId).toBeTruthy()
    expect(proof.hash).toHaveLength(64)
    expect(proof.signature).toHaveLength(64)
    expect(proof.previousHash).toBe('prev-hash')
    expect(proof.verified).toBe(true)
  })

  it('fails closed when immutable blob persistence fails', async () => {
    let persisted = false

    const adapter = createNarProofAdapter({
      keyId: 'unit',
      getPreviousHash: async () => undefined,
      persistImmutableStorage: async () => {
        throw new Error('immutable storage unavailable')
      },
      persistRecord: async (record) => {
        persisted = true
        return { auditRecordId: record.id }
      },
      getSigningSecret: async () => 'unit-secret',
    })

    await expect(
      adapter.createProof(mockDecision(), {
        decisionType: 'platform.workflow.executed',
        actionType: 'workflow:execute',
        entry: {
          type: 'platform.workflow.executed',
          domain: 'platform',
          resourceType: 'workflow-execution',
          requiredAuthority: ['workflow:execute'],
          requiredPolicy: 'platform.workflow.execution',
          auditRequired: true,
          replaySupported: true,
          exportSupported: true,
          retentionClass: 'platform_7_year',
          proofRequired: true,
          enforcementLevel: 'block',
        },
      }),
    ).rejects.toThrow('immutable storage unavailable')

    expect(persisted).toBe(false)
  })
})
