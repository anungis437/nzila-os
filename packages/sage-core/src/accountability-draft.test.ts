import { describe, expect, it } from 'vitest'
import {
  buildSageAccountabilityDraft,
  type SageAccountabilityDraftInput,
  type SageAccountabilityEvidenceRef,
  type SageVerifiedDeliverableAcceptanceAttestation,
} from './accountability-draft'
import {
  buildAuthorizedEvidenceContextPayload,
  type SageEvidenceContextCandidate,
  type SageSynthesisPrincipal,
} from './synthesis-context'

const ORG = 'fictional-alder-institution'
const WS = 'fictional-accountability-workspace'
const principal: SageSynthesisPrincipal = {
  actorId: 'fictional-internal-reviewer',
  orgId: ORG,
  workspaceId: WS,
  access: {
    hasMembership: true,
    activeRoles: ['internal_reviewer'],
    evidenceAuthorizations: ['sensitive'],
  },
}

function evidence(name: string, level: SageEvidenceContextCandidate['authorizationLevel'] = 'internal'): SageEvidenceContextCandidate {
  return {
    evidenceItemId: 'ev-' + name,
    sourceId: 'src-' + name,
    orgId: ORG,
    workspaceId: WS,
    authorizationLevel: level,
  }
}

function ref(e: SageEvidenceContextCandidate): SageAccountabilityEvidenceRef {
  return {
    evidenceItemId: e.evidenceItemId,
    sourceId: e.sourceId,
    authorizationLevel: e.authorizationLevel,
  }
}

const expected = evidence('expected')
const observed = evidence('observed')
const mandate = evidence('mandate')
const money = evidence('commitment', 'sensitive')
const delivery = evidence('delivery')
const receipt = evidence('acceptance')
const spend = evidence('actual-spend', 'sensitive')
const competingA = evidence('staffing-explanation')
const competingB = evidence('handover-explanation')
const authorized = [expected, observed, mandate, money, delivery, receipt, spend, competingA, competingB]

function payload(candidates = authorized, access = principal) {
  return buildAuthorizedEvidenceContextPayload(access, candidates)
}

function input(overrides: Partial<SageAccountabilityDraftInput> = {}): SageAccountabilityDraftInput {
  return {
    orgId: ORG,
    workspaceId: WS,
    resourceId: 'fictional-procurement-review',
    objective: 'Reconstruct the accountable decision for an extension',
    accountableActorId: 'fictional-program-director',
    intervention: 'Workflow redesign and knowledge handover',
    reviewDueAt: '2026-12-01T00:00:00.000Z',
    authority: {
      instrumentReference: 'Fictional delegation schedule v2',
      evidence: ref(mandate),
    },
    commitment: {
      monetaryCeilingMinor: 8_000_000,
      currency: 'CAD',
      expectedDeliverables: 4,
      evidence: ref(money),
    },
    execution: {
      receivedDeliverables: 3,
      evidence: ref(delivery),
    },
    expected: {
      value: 10,
      unit: 'working_days',
      window: '2026-Q4',
      evidence: ref(expected),
    },
    observed: {
      value: 14,
      unit: 'working_days',
      window: '2026-Q4',
      evidence: ref(observed),
    },
    differingInterpretations: [
      { id: 'interpretation-1', statement: 'Staffing interruption', evidence: [ref(competingA)] },
      { id: 'interpretation-2', statement: 'Incomplete knowledge transfer', evidence: [ref(competingB)] },
    ],
    nextDecisionOwnerActorId: 'fictional-current-signing-officer',
    ...overrides,
  }
}

describe('SAGE source-bound executive accountability draft (synthetic, no institutional adoption)', () => {
  it('builds an honest P01-style +4 day / +40% variance without inventing spend or acceptance', () => {
    const brief = buildSageAccountabilityDraft(payload(), input())
    expect(brief.status).toBe('DRAFT_REQUIRES_HUMAN_ADOPTION')
    expect(brief.authority.status).toBe('UNATTESTED')
    expect(brief.outcome).toMatchObject({
      comparison: 'COMPARABLE',
      delta: 4,
      percentVsExpected: 40,
    })
    expect(brief.commitment).toMatchObject({
      expectedDeliverables: 4,
      receivedDeliverables: 3,
      acceptedDeliverables: null,
      actualSpendMinor: null,
    })
    expect(brief.missing).toContain('actual_spend')
    expect(brief.missing).toContain('deliverable_acceptance')
    expect(brief.missing).toContain('authority_attestation')
    expect(brief.missing).toContain('human_adoption')
    expect(brief.executionDisposition).toBe('RECEIVED_ACCEPTANCE_UNPROVEN')
    expect(brief.openEvidenceTasks).toEqual(
      expect.arrayContaining(['deliverable_acceptance', 'actual_spend', 'authority_attestation']),
    )
    expect(brief.humanAdoption).toBe('NOT_ESTABLISHED')
    expect(brief.causalAttribution).toBe('NOT_ASSESSED')
    expect(brief.differingInterpretations).toHaveLength(2)
    // Every displayed institutional claim retains a visible, authorized
    // reference chain rather than an unattributed executive narrative.
    expect(brief.authority.evidence).toEqual(ref(mandate))
    expect(brief.commitment.commitmentEvidence).toEqual(ref(money))
    expect(brief.commitment.executionEvidence).toEqual(ref(delivery))
    expect(brief.commitment.acceptanceEvidence).toBeNull()
    expect(brief.commitment.actualSpendEvidence).toBeNull()
    expect(brief.differingInterpretations[0]?.evidence).toEqual([ref(competingA)])
    expect(brief.differingInterpretations.every((x) => x.disposition === 'UNRESOLVED')).toBe(true)
  })

  it('keeps an absent observation absent, rather than suggesting success', () => {
    const brief = buildSageAccountabilityDraft(payload(), input({ observed: undefined }))
    expect(brief.outcome.comparison).toBe('MISSING_OBSERVATION')
    expect(brief.outcome.observed).toBeNull()
    expect(brief.outcome.delta).toBeNull()
    expect(brief.outcome.percentVsExpected).toBeNull()
    expect(brief.missing).toContain('observation')
  })

  it('marks incomparable units or windows without forcing a numeric variance', () => {
    const differentUnit = buildSageAccountabilityDraft(payload(), input({
      observed: { value: 14, unit: 'count', window: '2026-Q4', evidence: ref(observed) },
    }))
    expect(differentUnit.outcome.comparison).toBe('INCOMPARABLE')
    expect(differentUnit.outcome.delta).toBeNull()
    const differentWindow = buildSageAccountabilityDraft(payload(), input({
      observed: { value: 14, unit: 'working_days', window: '2027-Q1', evidence: ref(observed) },
    }))
    expect(differentWindow.outcome.comparison).toBe('INCOMPARABLE')
  })

  it('never divides by zero or invents an outcome percentage', () => {
    const brief = buildSageAccountabilityDraft(payload(), input({
      expected: { value: 0, unit: 'count', window: '2026-Q4', evidence: ref(expected) },
      observed: { value: 3, unit: 'count', window: '2026-Q4', evidence: ref(observed) },
    }))
    expect(brief.outcome.delta).toBe(3)
    expect(brief.outcome.percentVsExpected).toBeNull()
  })

  function verifiedAcceptance(
    overrides: Partial<SageVerifiedDeliverableAcceptanceAttestation> = {},
  ): SageVerifiedDeliverableAcceptanceAttestation {
    return {
      attestationId: 'att-accept-1',
      recordType: 'institutional_deliverable_acceptance',
      orgId: ORG,
      workspaceId: WS,
      resourceId: 'fictional-procurement-review',
      acceptorActorId: 'fictional-acceptance-officer',
      instrumentReference: 'acceptance-minute-17',
      instrumentVersion: 'v1',
      acceptedDeliverableCount: 2,
      evidence: ref(receipt),
      verificationStatus: 'verified',
      attestedAt: '2026-11-20T00:00:00.000Z',
      ...overrides,
    }
  }

  it('admits server-verified acceptance and spend as recorded but NEVER as institutionally adopted', () => {
    const accepted = buildSageAccountabilityDraft(
      payload(),
      input({
        execution: {
          receivedDeliverables: 3,
          evidence: ref(delivery),
          acceptanceAttestationId: 'att-accept-1',
        },
        actualSpend: { amountMinor: 4_500_000, currency: 'CAD', evidence: ref(spend) },
      }),
      { verifiedAcceptanceAttestations: [verifiedAcceptance()] },
    )
    expect(accepted.commitment.actualSpendMinor).toBe(4_500_000)
    expect(accepted.commitment.acceptedDeliverables).toBe(2)
    expect(accepted.commitment.acceptanceEvidence).toEqual(ref(receipt))
    expect(accepted.commitment.actualSpendEvidence).toEqual(ref(spend))
    expect(accepted.missing).not.toContain('deliverable_acceptance')
    expect(accepted.missing).not.toContain('actual_spend')
    expect(accepted.executionDisposition).toBe('PARTIALLY_ACCEPTED')
    expect(accepted.openEvidenceTasks).toContain('deliverable_acceptance')
    expect(accepted.humanAdoption).toBe('NOT_ESTABLISHED')
  })

  it('refuses reusing a delivery/training receipt as acceptance evidence (E04)', () => {
    expect(() =>
      buildSageAccountabilityDraft(
        payload(),
        input({
          execution: {
            receivedDeliverables: 3,
            evidence: ref(delivery),
            acceptanceAttestationId: 'att-reuse-delivery',
          },
        }),
        {
          verifiedAcceptanceAttestations: [
            verifiedAcceptance({
              attestationId: 'att-reuse-delivery',
              acceptedDeliverableCount: 3,
              evidence: ref(delivery),
            }),
          ],
        },
      ),
    ).toThrow(/independent of delivery receipt/)
  })

  it('does not promote a readable non-acceptance source + forged attestor metadata to FULLY_ACCEPTED', () => {
    // Caller invents an attestation id that is not in the institution-owned registry.
    // A perfectly readable memo (receipt) remains accessible but is NOT acceptance.
    const forged = buildSageAccountabilityDraft(
      payload(),
      input({
        execution: {
          receivedDeliverables: 3,
          evidence: ref(delivery),
          // No acceptanceAttestationId — readable unrelated docs cannot invent acceptance.
        },
      }),
      {
        // Registry empty / unrelated — even if a memo is readable in the payload.
        verifiedAcceptanceAttestations: [],
      },
    )
    expect(forged.executionDisposition).toBe('RECEIVED_ACCEPTANCE_UNPROVEN')
    expect(forged.commitment.acceptedDeliverables).toBeNull()
    expect(forged.missing).toContain('deliverable_acceptance')

    expect(() =>
      buildSageAccountabilityDraft(
        payload(),
        input({
          execution: {
            receivedDeliverables: 3,
            evidence: ref(delivery),
            acceptanceAttestationId: 'forged-caller-asserted-id',
          },
        }),
        { verifiedAcceptanceAttestations: [] },
      ),
    ).toThrow(/acceptance attestation not found/)
  })

  it('refuses exact source substitution, sensitivity downgrade, missing and ambiguous evidence', () => {
    const forged = input({
      expected: {
        value: 10,
        unit: 'working_days',
        window: '2026-Q4',
        evidence: { ...ref(expected), sourceId: 'src-attacker' },
      },
    })
    expect(() => buildSageAccountabilityDraft(payload(), forged)).toThrow(/not bound/)
    const downgraded = input({
      commitment: {
        monetaryCeilingMinor: 8_000_000,
        currency: 'CAD',
        expectedDeliverables: 4,
        evidence: { ...ref(money), authorizationLevel: 'public' },
      },
    })
    expect(() => buildSageAccountabilityDraft(payload(), downgraded)).toThrow(/not bound/)
    expect(() => buildSageAccountabilityDraft(payload(), input({
      actualSpend: { amountMinor: 10, currency: 'CAD', evidence: { ...ref(spend), evidenceItemId: 'ev-unknown' } },
    }))).toThrow(/not bound/)
    expect(() => buildSageAccountabilityDraft(payload([...authorized, { ...expected }]), input())).toThrow(/not bound/)
  })

  it('rejects wrong institution/workspace and a revoked restricted-evidence grant', () => {
    expect(() => buildSageAccountabilityDraft(payload(), input({ orgId: 'different-institution' })))
      .toThrow(/exact workspace scope/)
    expect(() => buildSageAccountabilityDraft(payload(), input({ workspaceId: 'other-workspace' })))
      .toThrow(/exact workspace scope/)
    const revoked: SageSynthesisPrincipal = {
      ...principal,
      access: {
        ...principal.access,
        evidenceAuthorizations: [],
      },
    }
    expect(() => buildSageAccountabilityDraft(payload(authorized, revoked), input()))
      .toThrow(/not bound/)
  })

  it('rejects malformed or impossible review timestamps', () => {
    expect(() => buildSageAccountabilityDraft(payload(), input({
      reviewDueAt: '2026-02-30T12:00:00.000Z',
    }))).toThrow(/reviewDueAt/)
    expect(() => buildSageAccountabilityDraft(payload(), input({
      reviewDueAt: '2026-12-01',
    }))).toThrow(/reviewDueAt/)
  })

  it('denies fabricated acceptance, invalid commitment, nonfinite observations and mismatched spend currency', () => {
    expect(() =>
      buildSageAccountabilityDraft(
        payload(),
        input({
          execution: {
            receivedDeliverables: 3,
            evidence: ref(delivery),
            acceptanceAttestationId: 'missing-attestation',
          },
        }),
        { verifiedAcceptanceAttestations: [] },
      ),
    ).toThrow(/acceptance attestation not found/)
    expect(() => buildSageAccountabilityDraft(payload(), input({
      commitment: { monetaryCeilingMinor: -1, currency: 'CAD', expectedDeliverables: 4, evidence: ref(money) },
    }))).toThrow(/monetary ceiling/)
    expect(() => buildSageAccountabilityDraft(payload(), input({
      observed: { value: Number.NaN, unit: 'working_days', window: '2026-Q4', evidence: ref(observed) },
    }))).toThrow(/observed/)
    expect(() => buildSageAccountabilityDraft(payload(), input({
      actualSpend: { amountMinor: 3_000, currency: 'USD', evidence: ref(spend) },
    }))).toThrow(/currency/)
  })

  it('rejects fabricated competing interpretations without readable evidence', () => {
    expect(() => buildSageAccountabilityDraft(payload(), input({
      differingInterpretations: [{
        id: 'claim-missing',
        statement: 'Unverified historical source says so',
        evidence: [{ ...ref(competingA), sourceId: 'wrong-source' }],
      }],
    }))).toThrow(/not bound/)
    expect(() => buildSageAccountabilityDraft(payload(), input({
      differingInterpretations: [
        { id: 'duplicate', statement: 'A', evidence: [ref(competingA)] },
        { id: 'duplicate', statement: 'B', evidence: [ref(competingB)] },
      ],
    }))).toThrow(/duplicate interpretation id/)
  })

  it('does not leak later mutations of caller-provided measurement objects into the output', () => {
    const submitted = input()
    const brief = buildSageAccountabilityDraft(payload(), submitted)
    submitted.expected.value = 1000
    expect(brief.outcome.expected.value).toBe(10)
  })
})
