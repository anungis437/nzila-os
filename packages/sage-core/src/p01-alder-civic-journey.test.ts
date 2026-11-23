/**
 * P01 — Alder Civic Services Office golden journey (fictional).
 *
 * Compulsory adversarial acceptance pack:
 * - A05 historic CAD 40k remains historically accurate
 * - A06 current CAD 30k ceiling governs new extension; cumulative refusal
 * - E04 training delivered/received but acceptance unproven
 * - Competing delay explanations stay unresolved
 * - Draft never silently becomes institutional adoption
 *
 * LOCAL_TESTED only — not staging or production proof.
 */
import { describe, expect, it } from 'vitest'
import {
  evaluateSageInstitutionalMandate,
  type SageInstitutionalAuthorityRequest,
  type SageVerifiedInstitutionalMandate,
} from './institutional-authority'
import { buildSageAccountabilityDraft } from './accountability-draft'
import { adoptSageAccountabilityDraft } from './accountability-adoption'
import {
  buildAuthorizedEvidenceContextPayload,
  type SageEvidenceContextCandidate,
  type SageSynthesisPrincipal,
} from './synthesis-context'
import type { SageAccountabilityEvidenceRef } from './accountability-draft'

const ORG = 'org-alder-civic'
const WS = 'ws-alder-redesign'
const RESOURCE = 'procurement.alder.workflow-redesign'
const AT = '2026-11-23T15:00:00.000Z'

const principal: SageSynthesisPrincipal = {
  actorId: 'officer-alder-1',
  orgId: ORG,
  workspaceId: WS,
  access: {
    hasMembership: true,
    activeRoles: ['decision_record_approver'],
    evidenceAuthorizations: ['sensitive'],
  },
}

function evidence(
  name: string,
  level: SageEvidenceContextCandidate['authorizationLevel'] = 'internal',
): SageEvidenceContextCandidate {
  return {
    evidenceItemId: `ev-${name}`,
    sourceId: `src-${name}`,
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

function request(
  changes: Partial<SageInstitutionalAuthorityRequest> = {},
): SageInstitutionalAuthorityRequest {
  return {
    orgId: ORG,
    actorId: 'officer-alder-1',
    actorKind: 'human',
    currentPositionId: 'pos-procurement',
    resourceId: RESOURCE,
    action: 'resource.commit',
    mandateId: 'current-30k',
    evaluatedAt: AT,
    authenticated: true,
    activeWorkspaceMembership: true,
    applicationPermissionGranted: true,
    conflictOrRecusal: false,
    ...changes,
  }
}

function mandate(
  changes: Partial<SageVerifiedInstitutionalMandate> = {},
): SageVerifiedInstitutionalMandate {
  return {
    id: 'current-30k',
    orgId: ORG,
    principalActorId: 'officer-alder-1',
    positionId: 'pos-procurement',
    resourceId: RESOURCE,
    permittedActions: ['resource.commit', 'decision.ratify'],
    instrumentRef: 'DEL-ALDER-2026-30K',
    instrumentVersion: 'v2',
    issuerActorId: 'board-alder',
    monetaryLimitMinor: 3_000_000,
    currency: 'CAD',
    verificationStatus: 'verified',
    attestedAt: '2026-01-01T00:00:00.000Z',
    acceptedAt: '2026-01-02T00:00:00.000Z',
    effectiveAt: '2026-01-03T00:00:00.000Z',
    expiresAt: '2027-01-01T00:00:00.000Z',
    revokedAt: null,
    status: 'active',
    ...changes,
  }
}

describe('P01 Alder Civic Services — golden journey', () => {
  it('A05 preserves historic CAD 40k while A06 refuses a CAD 15k extension that breaches the current CAD 30k ceiling', () => {
    const historic = mandate({
      id: 'historic-40k',
      instrumentRef: 'DEL-ALDER-2025-40K',
      instrumentVersion: 'v1',
      monetaryLimitMinor: 4_000_000,
      effectiveAt: '2025-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:00:00.000Z',
      attestedAt: '2025-01-01T00:00:00.000Z',
      acceptedAt: '2025-01-02T00:00:00.000Z',
    })
    const current = mandate()

    // Historic instrument remains readable with its original ceiling (A05).
    expect(historic.monetaryLimitMinor).toBe(4_000_000)
    expect(historic.instrumentRef).toBe('DEL-ALDER-2025-40K')

    // Historic mandate cannot authorize a new November action.
    expect(
      evaluateSageInstitutionalMandate(request({ mandateId: historic.id }), [historic]).allowed,
    ).toBe(false)

    // Current 30k ceiling admits a 15k first commitment...
    const first = evaluateSageInstitutionalMandate(
      request({
        mandateId: current.id,
        commitment: { currency: 'CAD', totalCommittedMinorAfterAction: 1_500_000 },
      }),
      [current],
    )
    expect(first.allowed).toBe(true)

    // ...but refuses when prior spend + extension would exceed 30k (A06 cumulative).
    const extension = evaluateSageInstitutionalMandate(
      request({
        mandateId: current.id,
        commitment: { currency: 'CAD', totalCommittedMinorAfterAction: 3_500_000 },
      }),
      [current],
    )
    expect(extension.allowed).toBe(false)
    if (!extension.allowed) expect(extension.reason).toBe('MONETARY_LIMIT_EXCEEDED')
  })

  it('E04 keeps training delivery received with acceptance unproven and competing delay explanations unresolved', () => {
    const trainingReceipt = evidence('training-delivery-receipt')
    const delayStaffing = evidence('delay-staffing')
    const delayHandover = evidence('delay-handover')
    const commitmentEv = evidence('commitment-30k', 'sensitive')
    const expectedEv = evidence('expected-turnaround')
    const observedEv = evidence('observed-turnaround')
    const payload = buildAuthorizedEvidenceContextPayload(principal, [
      trainingReceipt,
      delayStaffing,
      delayHandover,
      commitmentEv,
      expectedEv,
      observedEv,
    ])

    // Supplier reports training delivered; institution has receipt but no signoff.
    const brief = buildSageAccountabilityDraft(payload, {
      orgId: ORG,
      workspaceId: WS,
      resourceId: RESOURCE,
      objective: 'Complete workflow redesign training for service officers',
      accountableActorId: 'officer-alder-1',
      intervention: 'Delegated redesign programme',
      reviewDueAt: '2026-12-01T00:00:00.000Z',
      commitment: {
        monetaryCeilingMinor: 3_000_000,
        currency: 'CAD',
        expectedDeliverables: 1,
        evidence: ref(commitmentEv),
      },
      execution: {
        receivedDeliverables: 1,
        evidence: ref(trainingReceipt),
        // intentionally no acceptedDeliverables / acceptanceEvidence
      },
      expected: {
        value: 10,
        unit: 'working_days',
        window: '2026-Q4',
        evidence: ref(expectedEv),
      },
      observed: {
        value: 14,
        unit: 'working_days',
        window: '2026-Q4',
        evidence: ref(observedEv),
      },
      differingInterpretations: [
        {
          id: 'delay-staffing',
          statement: 'Staffing interruption delayed facilitator availability',
          evidence: [ref(delayStaffing)],
        },
        {
          id: 'delay-handover',
          statement: 'Incomplete knowledge transfer after lead change',
          evidence: [ref(delayHandover)],
        },
      ],
      nextDecisionOwnerActorId: 'exec-sponsor-1',
    })

    expect(brief.executionDisposition).toBe('RECEIVED_ACCEPTANCE_UNPROVEN')
    expect(brief.openEvidenceTasks).toEqual(
      expect.arrayContaining(['deliverable_acceptance', 'actual_spend', 'authority_attestation']),
    )
    expect(brief.commitment.receivedDeliverables).toBe(1)
    expect(brief.commitment.acceptedDeliverables).toBeNull()
    expect(brief.missing).toContain('deliverable_acceptance')
    expect(brief.outcome).toMatchObject({ delta: 4, percentVsExpected: 40 })
    expect(brief.differingInterpretations).toHaveLength(2)
    expect(brief.differingInterpretations.every((x) => x.disposition === 'UNRESOLVED')).toBe(true)
    expect(brief.causalAttribution).toBe('NOT_ASSESSED')
    expect(brief.humanAdoption).toBe('NOT_ESTABLISHED')

    // Contested / forged source: fabricated training acceptance must not bind.
    expect(() =>
      buildSageAccountabilityDraft(payload, {
        orgId: ORG,
        workspaceId: WS,
        resourceId: RESOURCE,
        objective: 'Forge training completion',
        accountableActorId: 'officer-alder-1',
        intervention: 'x',
        reviewDueAt: '2026-12-01T00:00:00.000Z',
        commitment: {
          monetaryCeilingMinor: 3_000_000,
          currency: 'CAD',
          expectedDeliverables: 1,
          evidence: ref(commitmentEv),
        },
        execution: {
          receivedDeliverables: 1,
          acceptedDeliverables: 1,
          evidence: ref(trainingReceipt),
          acceptanceEvidence: {
            evidenceItemId: trainingReceipt.evidenceItemId,
            sourceId: 'src-attacker-forged',
            authorizationLevel: 'internal',
          },
        },
        expected: {
          value: 10,
          unit: 'working_days',
          window: '2026-Q4',
          evidence: ref(expectedEv),
        },
      }),
    ).toThrow(/not bound/)
  })

  it('refuses silent adoption of the P01 draft without an admitted institutional mandate', () => {
    const trainingReceipt = evidence('training-delivery-receipt')
    const commitmentEv = evidence('commitment-30k', 'sensitive')
    const expectedEv = evidence('expected-turnaround')
    const payload = buildAuthorizedEvidenceContextPayload(principal, [
      trainingReceipt,
      commitmentEv,
      expectedEv,
    ])
    const draft = buildSageAccountabilityDraft(payload, {
      orgId: ORG,
      workspaceId: WS,
      resourceId: RESOURCE,
      objective: 'Complete workflow redesign training',
      accountableActorId: 'officer-alder-1',
      intervention: 'Delegated redesign programme',
      reviewDueAt: '2026-12-01T00:00:00.000Z',
      commitment: {
        monetaryCeilingMinor: 3_000_000,
        currency: 'CAD',
        expectedDeliverables: 1,
        evidence: ref(commitmentEv),
      },
      execution: { receivedDeliverables: 1, evidence: ref(trainingReceipt) },
      expected: {
        value: 10,
        unit: 'working_days',
        window: '2026-Q4',
        evidence: ref(expectedEv),
      },
      nextDecisionOwnerActorId: 'exec-sponsor-1',
    })

    expect(() =>
      adoptSageAccountabilityDraft({
        draft,
        choice: 'adopt',
        adoptedAt: '2026-11-23T16:00:00.000Z',
        adoptingActorId: 'exec-sponsor-1',
        adoptingPositionId: 'pos-sponsor',
        rationale: 'Sponsor wants to close without mandate proof',
        mandateDecision: { allowed: false, reason: 'UNVERIFIED_INSTRUMENT' },
      }),
    ).toThrow(/institutional mandate denied/i)
  })
})
