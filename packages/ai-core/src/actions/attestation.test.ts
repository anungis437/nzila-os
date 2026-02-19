/**
 * Unit tests for createActionAttestation (pure function, no DB/Blob).
 */
import { describe, it, expect } from 'vitest'
import { createActionAttestation } from './attestation'
import type { AttestationInput } from './attestation'

const BASE_INPUT: AttestationInput = {
  action: {
    id: '00000000-0000-0000-0000-aaaaaaaaaaaa',
    entityId: '00000000-0000-0000-0000-111111111111',
    appKey: 'console',
    profileKey: 'finance-default',
    actionType: 'finance.generate_stripe_monthly_reports',
    riskTier: 'low',
    status: 'executed',
    requestedBy: 'user_abc',
    approvedBy: 'user_def',
    approvedAt: new Date('2026-01-15T10:00:00Z'),
    proposalJson: { period: { periodLabel: '2026-01' } },
    relatedDomainType: 'period',
    relatedDomainId: '00000000-0000-0000-0000-222222222222',
    aiRequestId: null,
    evidencePackEligible: true,
    createdAt: new Date('2026-01-15T09:00:00Z'),
    updatedAt: new Date('2026-01-15T10:05:00Z'),
  },
  run: {
    id: '00000000-0000-0000-0000-bbbbbbbbbbbb',
    startedAt: new Date('2026-01-15T10:01:00Z'),
  },
  policyDecision: { allowed: true, riskTier: 'low', autoApproved: true },
  toolCalls: [
    {
      toolName: 'stripeTool.generateReports',
      startedAt: '2026-01-15T10:01:01Z',
      finishedAt: '2026-01-15T10:01:05Z',
      inputsHash: 'aaa',
      outputsHash: 'bbb',
      status: 'success',
    },
  ],
  artifacts: {
    documentIds: ['doc-1', 'doc-2'],
    reportTypes: ['revenue_summary', 'payout_recon'],
  },
}

describe('createActionAttestation', () => {
  it('produces attestation with version 1.0', () => {
    const result = createActionAttestation(BASE_INPUT)
    expect(result.attestationVersion).toBe('1.0')
  })

  it('includes all required fields', () => {
    const result = createActionAttestation(BASE_INPUT)
    expect(result.actionId).toBe(BASE_INPUT.action.id)
    expect(result.runId).toBe(BASE_INPUT.run.id)
    expect(result.entityId).toBe(BASE_INPUT.action.entityId)
    expect(result.actionType).toBe(BASE_INPUT.action.actionType)
    expect(result.riskTier).toBe('low')
    expect(result.status).toBe('executed')
    expect(result.requestedBy).toBe('user_abc')
    expect(result.approvedBy).toBe('user_def')
  })

  it('includes tool trace', () => {
    const result = createActionAttestation(BASE_INPUT)
    expect(result.toolTrace.toolCallsJson).toHaveLength(1)
    expect(result.toolTrace.toolCallsJson[0].toolName).toBe('stripeTool.generateReports')
  })

  it('includes artifacts', () => {
    const result = createActionAttestation(BASE_INPUT)
    expect(result.artifacts.documents).toHaveLength(2)
    expect(result.artifacts.documents[0].key).toBe('documentIds')
    expect(result.artifacts.documents[1].key).toBe('reportTypes')
  })

  it('includes proposalHash (non-empty hex)', () => {
    const result = createActionAttestation(BASE_INPUT)
    expect(result.hashes.proposalHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('includes self-referencing attestationHash (non-empty hex)', () => {
    const result = createActionAttestation(BASE_INPUT)
    expect(result.hashes.attestationHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces deterministic hashes for the same input', () => {
    const a = createActionAttestation(BASE_INPUT)
    const b = createActionAttestation(BASE_INPUT)
    expect(a.hashes.proposalHash).toBe(b.hashes.proposalHash)
    // attestationHash includes executedAt timestamp so may differ across calls
    // but proposalHash is always deterministic
  })

  it('sets evidencePackEligible in links', () => {
    const result = createActionAttestation(BASE_INPUT)
    expect(result.links.evidencePackEligible).toBe(true)
    expect(result.links.relatedDomainType).toBe('period')
    expect(result.links.relatedDomainId).toBe(BASE_INPUT.action.relatedDomainId)
  })

  it('handles null approvedBy/approvedAt', () => {
    const input = {
      ...BASE_INPUT,
      action: { ...BASE_INPUT.action, approvedBy: null, approvedAt: null },
    }
    const result = createActionAttestation(input)
    expect(result.approvedBy).toBeNull()
    expect(result.approvedAt).toBeNull()
  })
})
