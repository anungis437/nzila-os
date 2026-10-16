import { describe, expect, it } from 'vitest'
import { replayDigest } from './post-w4p-replay'
import {
  inspectBoundaryEvidence,
  proveMissingPolicyParent,
  verifyBoundaryReceipt,
  type ReceiptBinding,
} from './original-boundary-inspection'

const bindings: ReceiptBinding = {
  BOUNDARY_ID: 'boundary',
  SOURCE_SHA256: replayDigest('source'),
  GRAPH_DIGEST: replayDigest('graph'),
  PLAN_DIGEST: replayDigest('plan'),
  DATABASE_SCOPE: 'UE_OPERATIONAL',
  W4P_VERIFICATION_DIGEST: replayDigest('verified-w4p'),
  PREDECESSOR_STATE_DIGEST: replayDigest('predecessors'),
  EXECUTION_RESULT_DIGEST: replayDigest('result'),
  POSTCONDITION_VERIFICATION_DIGEST: replayDigest('postverification'),
}
const receipt = { ...bindings, RECEIPT_DIGEST: replayDigest(bindings) }

describe('prospective receipt binding,not a receipt persistence authority', () => {
  it('accepts all nine exact bindings and the body digest', () => {
    expect(verifyBoundaryReceipt(receipt, bindings)).toBe(true)
  })
  for (const key of Object.keys(bindings) as (keyof ReceiptBinding)[])
    it(`rejects altered receipt binding:${key}`, () => {
      expect(verifyBoundaryReceipt({ ...receipt, [key]: 'wrong' }, bindings)).toBe(false)
    })
  it('rejects extra fields,digest mismatch and empty binding', () => {
    const withExtra = { ...receipt, EXTRA: 'not authorized' }
    expect(verifyBoundaryReceipt(withExtra, bindings)).toBe(false)
    expect(verifyBoundaryReceipt({ ...receipt, RECEIPT_DIGEST: 'wrong' }, bindings)).toBe(false)
    expect(verifyBoundaryReceipt(receipt, { ...bindings, SOURCE_SHA256: '' })).toBe(false)
  })
})

describe('offline effect evidence denial,not full catalog inspector or replay handler', () => {
  const complete = {
    expectedEffectIds: ['effect'],
    observations: [{ effectId: 'effect', definition: 'EXACT', receiptRequired: false }] as const,
    prerequisitesVerified: true,
    receiptVerified: false,
    replayAbsenceProven: false,
  }
  const input = () => ({ ...complete, observations: [...complete.observations] })
  it('reports full supplied exact evidence as ALREADY_COMPLETE without sending SQL', () => {
    expect(inspectBoundaryEvidence(input())).toBe('ALREADY_COMPLETE')
  })
  it('denies missing W4P/scope/predecessor prerequisite even with an execution receipt', () => {
    expect(
      inspectBoundaryEvidence({ ...input(), prerequisitesVerified: false, receiptVerified: true }),
    ).toBe('PRECONDITION_MISSING')
  })
  for (const definition of ['PARTIAL', 'DRIFTED'] as const)
    it(`never treats ${definition} as absent or complete`, () => {
      expect(
        inspectBoundaryEvidence({
          ...input(),
          observations: [{ effectId: 'effect', definition, receiptRequired: false }],
        }),
      ).toBe(definition === 'PARTIAL' ? 'PARTIAL_OR_AMBIGUOUS' : 'DRIFTED')
    })
  it('requires actual absence proof and supplied satisfied prerequisites for a replay candidate', () => {
    const absent = {
      ...input(),
      observations: [{ effectId: 'effect', definition: 'ABSENT' as const, receiptRequired: false }],
    }
    expect(inspectBoundaryEvidence(absent)).toBe('PARTIAL_OR_AMBIGUOUS')
    expect(inspectBoundaryEvidence({ ...absent, replayAbsenceProven: true })).toBe(
      'REPLAY_REQUIRED',
    )
  })
  it('denies non-monotonic completion without a verified receipt', () => {
    const nonMonotonic = {
      ...input(),
      observations: [{ effectId: 'effect', definition: 'EXACT' as const, receiptRequired: true }],
    }
    expect(inspectBoundaryEvidence(nonMonotonic)).toBe('PARTIAL_OR_AMBIGUOUS')
    expect(inspectBoundaryEvidence({ ...nonMonotonic, receiptVerified: true })).toBe(
      'ALREADY_COMPLETE',
    )
  })
  it('rejects missing/duplicate/unbound effect evidence explicitly', () => {
    expect(() => inspectBoundaryEvidence({ ...input(), observations: [] })).toThrow(
      'BOUNDARY_EVIDENCE_COVERAGE_INVALID',
    )
    expect(() =>
      inspectBoundaryEvidence({
        ...input(),
        observations: [...input().observations, ...input().observations],
      }),
    ).toThrow('BOUNDARY_EVIDENCE_COVERAGE_INVALID')
    expect(() =>
      inspectBoundaryEvidence({ ...input(), expectedEffectIds: ['effect', 'effect'] }),
    ).toThrow('BOUNDARY_EVIDENCE_COVERAGE_INVALID')
  })
  it('cannot certify missing parent.id via either a fake receipt or successful W4P assertion', () => {
    const proof = proveMissingPolicyParent({
      requiredColumns: ['id', 'organization_id'],
      baselineColumns: ['organization_id'],
    })
    expect(proof.MISSING_COLUMNS).toEqual(['id'])
    expect(proof.BEFORE.STATE).toBe('PRECONDITION_MISSING')
    expect(proof.SAFE_REPLAY_REQUIRED_ELIGIBILITY).toBe('NO')
    expect(proof.AFTER_COLUMNS).toEqual(['organization_id'])
    expect(proof.SEND_ATTEMPTS).toBe(0)
    expect(proof.DATABASE_CONNECTIONS).toBe(0)
    expect(proof.SQL_EXECUTED).toBe(0)
  })
  it('rejects a counterexample when the parent key is actually present', () => {
    expect(() =>
      proveMissingPolicyParent({
        requiredColumns: ['id'],
        baselineColumns: ['id', 'organization_id'],
      }),
    ).toThrow('POLICY_PARENT_COUNTEREXAMPLE_REQUIRES_MISSING_COLUMNS')
  })
})
