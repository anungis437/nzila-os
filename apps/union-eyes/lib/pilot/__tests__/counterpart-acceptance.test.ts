import { describe, expect, it } from 'vitest'
import {
  ACCEPTANCE_DEPENDENT_STATES,
  COUNTERPART_ACCEPTANCE_POLICY,
  MAX_RECORDED_ACCEPTANCE_CLAIMS,
  acceptanceMaySupport,
  classifyAcceptanceStanding,
  isAcceptanceDependentState,
  withRecordedAcceptanceClaim,
  type AcceptancePolicy,
  type RecordedAcceptanceClaim,
} from '../counterpart-acceptance'

const policy = (over: Partial<AcceptancePolicy>): AcceptancePolicy => ({ ...COUNTERPART_ACCEPTANCE_POLICY, ...over })
const claim = (n = 1): RecordedAcceptanceClaim => ({
  claimedByRole: 'President',
  channelClaimed: 'countersigned_document',
  evidenceReference: `doc-${n}`,
  recordedBy: 'admin-1',
  recordedAt: '2026-11-01T00:00:00.000Z',
  standing: 'unverified_claim',
  reason: 'pilot.commercial.contract_signed',
  policyVersion: 'p',
})

describe('commercial acceptance policy', () => {
  it('ships unapproved and requiring verification', () => {
    expect(COUNTERPART_ACCEPTANCE_POLICY).toMatchObject({ approvedBy: null, activationRequires: 'provider_verified' })
  })

  it('refuses an administrator\'s statement and the absence of any acceptance under the shipped policy', () => {
    expect(acceptanceMaySupport('op', 'operator_recorded_unverified').allowed).toBe(false)
    expect(acceptanceMaySupport('op', 'none').allowed).toBe(false)
    expect(acceptanceMaySupport('op', null).allowed).toBe(false)
    expect(acceptanceMaySupport('op', 'provider_verified').allowed).toBe(true)
  })

  it('names the operation, the policy and its approval state in the refusal', () => {
    expect(acceptanceMaySupport('pilot.commercial.pilot_active', 'none').blocked).toEqual({
      operation: 'pilot.commercial.pilot_active',
      requires: 'provider_verified_acceptance',
      policyVersion: COUNTERPART_ACCEPTANCE_POLICY.version,
      policyApprovedBy: null,
      evidence: 'none',
    })
  })

  it('honours operator-recorded acceptance only when the setting AND an approver are present, and never for no acceptance', () => {
    expect(acceptanceMaySupport('op', 'operator_recorded_unverified', policy({ activationRequires: 'operator_recorded', approvedBy: null })).allowed).toBe(false)
    expect(acceptanceMaySupport('op', 'operator_recorded_unverified', policy({ activationRequires: 'operator_recorded', approvedBy: '  ' })).allowed).toBe(false)
    expect(acceptanceMaySupport('op', 'operator_recorded_unverified', policy({ activationRequires: 'operator_recorded', approvedBy: 'board-resolution-7' })).allowed).toBe(true)
    expect(acceptanceMaySupport('op', 'none', policy({ activationRequires: 'operator_recorded', approvedBy: 'board-resolution-7' })).allowed).toBe(false)
  })

  it('treats every state from the signed contract onward as resting on the acceptance, and no earlier one', () => {
    expect([...ACCEPTANCE_DEPENDENT_STATES]).toEqual(['contract_signed', 'invoice_issued', 'pilot_active', 'pilot_complete', 'subscription_offered', 'subscription_active'])
    for (const state of ['lead', 'qualified', 'pilot', 'proposal', 'approved', 'contract_sent']) expect(isAcceptanceDependentState(state)).toBe(false)
  })
})

describe('acceptance standing of a contract (read, never written)', () => {
  it('names a contract activated on an administrator\'s statement as unverifiable', () => {
    const standing = classifyAcceptanceStanding({ status: 'active', metadata: { counterpartAcceptance: { verification: 'recorded_by_platform_operator' } } })
    expect(standing.standing).toBe('activated_on_unverified_acceptance')
    expect(standing.explanation).toMatch(/cannot advance the pilot/)
  })

  it('names a provider-confirmed acceptance as verified', () => {
    expect(classifyAcceptanceStanding({ status: 'active', metadata: { counterpartAcceptance: { verificationDetail: { status: 'provider_verified' } } } }).standing).toBe('verified')
  })

  it('does not count a recorded claim as an acceptance', () => {
    expect(classifyAcceptanceStanding({ status: 'pending_approval', metadata: { acceptanceClaims: [claim(), claim(2)] } })).toMatchObject({ standing: 'awaiting_verified_acceptance', claimsRecorded: 2 })
    expect(classifyAcceptanceStanding({ status: 'pending_approval', metadata: {} }).standing).toBe('no_acceptance')
    expect(classifyAcceptanceStanding(null).standing).toBe('no_acceptance')
    // An active contract with no recorded acceptance is not accepted either.
    expect(classifyAcceptanceStanding({ status: 'active', metadata: {} }).standing).toBe('no_acceptance')
  })

  it('does not change what it is given', () => {
    const contract = { status: 'active', metadata: { counterpartAcceptance: { verification: 'recorded_by_platform_operator' } } }
    const before = JSON.stringify(contract)
    classifyAcceptanceStanding(contract)
    expect(JSON.stringify(contract)).toBe(before)
  })
})

describe('recording an acceptance claim as evidence', () => {
  it('adds the claim beside the rest of the metadata without creating an acceptance', () => {
    const next = withRecordedAcceptanceClaim({ source: 'pilot-commercial-transition', commercialTermsFingerprint: 'f' }, claim())

    expect(next).toMatchObject({ source: 'pilot-commercial-transition', commercialTermsFingerprint: 'f' })
    expect(next.counterpartAcceptance).toBeUndefined()
    expect(next.acceptanceClaims).toEqual([claim()])
  })

  it('does not mutate the original metadata and tolerates none', () => {
    const original = { acceptanceClaims: [claim()] }
    withRecordedAcceptanceClaim(original, claim(2))
    expect(original.acceptanceClaims).toHaveLength(1)
    expect(withRecordedAcceptanceClaim(null, claim()).acceptanceClaims).toHaveLength(1)
  })

  it('keeps the most recent claims up to a bound', () => {
    let metadata: Record<string, unknown> = {}
    for (let n = 1; n <= MAX_RECORDED_ACCEPTANCE_CLAIMS + 5; n += 1) metadata = withRecordedAcceptanceClaim(metadata, claim(n))
    const claims = metadata.acceptanceClaims as RecordedAcceptanceClaim[]
    expect(claims).toHaveLength(MAX_RECORDED_ACCEPTANCE_CLAIMS)
    expect(claims.at(-1)?.evidenceReference).toBe(`doc-${MAX_RECORDED_ACCEPTANCE_CLAIMS + 5}`)
  })
})
