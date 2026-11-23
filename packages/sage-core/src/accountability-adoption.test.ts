import { describe, expect, it } from 'vitest'
import { SageInvariantError } from './invariants'
import {
  buildSageAccountabilityDraft,
  type SageAccountabilityDraftInput,
  type SageAccountabilityEvidenceRef,
} from './accountability-draft'
import { adoptSageAccountabilityDraft } from './accountability-adoption'
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

function evidence(
  name: string,
  level: SageEvidenceContextCandidate['authorizationLevel'] = 'internal',
): SageEvidenceContextCandidate {
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
const competingA = evidence('staffing-explanation')
const competingB = evidence('handover-explanation')
const authorized = [expected, observed, mandate, money, delivery, competingA, competingB]

function payload(candidates = authorized) {
  return buildAuthorizedEvidenceContextPayload(principal, candidates)
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

describe('adoptSageAccountabilityDraft (T01 human adoption)', () => {
  const draft = buildSageAccountabilityDraft(payload(), input())

  it('keeps T01 draft facts: CAD 80k, 4/3 deliverables, +4/+40%, missing spend/acceptance', () => {
    expect(draft.status).toBe('DRAFT_REQUIRES_HUMAN_ADOPTION')
    expect(draft.authority.status).toBe('UNATTESTED')
    expect(draft.outcome).toMatchObject({ comparison: 'COMPARABLE', delta: 4, percentVsExpected: 40 })
    expect(draft.commitment).toMatchObject({
      monetaryCeilingMinor: 8_000_000,
      expectedDeliverables: 4,
      receivedDeliverables: 3,
      acceptedDeliverables: null,
      actualSpendMinor: null,
    })
    expect(draft.missing).toEqual(
      expect.arrayContaining(['actual_spend', 'deliverable_acceptance', 'human_adoption', 'authority_attestation']),
    )
    expect(draft.differingInterpretations).toHaveLength(2)
    expect(draft.causalAttribution).toBe('NOT_ASSESSED')
    expect(draft.humanAdoption).toBe('NOT_ESTABLISHED')
  })

  it('fails closed without an admitted mandate or named human', () => {
    expect(() =>
      adoptSageAccountabilityDraft({
        draft,
        choice: 'adopt',
        adoptedAt: '2026-11-23T15:00:00.000Z',
        adoptingActorId: 'officer-1',
        adoptingPositionId: 'pos-1',
        rationale: 'Accept the draft as the institutional record',
        mandateDecision: { allowed: false, reason: 'MANDATE_INACTIVE' },
      }),
    ).toThrow(SageInvariantError)

    expect(() =>
      adoptSageAccountabilityDraft({
        draft,
        choice: 'adopt',
        adoptedAt: '2026-11-23T15:00:00.000Z',
        adoptingActorId: 'system',
        adoptingPositionId: 'pos-1',
        rationale: 'nope',
        mandateDecision: {
          allowed: true,
          reason: 'ADMITTED',
          mandateId: 'm1',
          instrumentRef: 'I1',
          instrumentVersion: 'v1',
        },
      }),
    ).toThrow(/named human/i)
  })

  it('records adopt and defer without mutating the draft or inventing facts', () => {
    const adopted = adoptSageAccountabilityDraft({
      draft,
      choice: 'adopt',
      adoptedAt: '2026-11-23T15:00:00.000Z',
      adoptingActorId: 'officer-1',
      adoptingPositionId: 'pos-1',
      rationale: 'Board accepts the variance record without assigning cause',
      mandateDecision: {
        allowed: true,
        reason: 'ADMITTED',
        mandateId: 'm-adopt',
        instrumentRef: 'DEL-T01',
        instrumentVersion: 'v1',
      },
    })
    expect(adopted.status).toBe('ADOPTED')
    expect(adopted.draftStatusPreserved).toBe('DRAFT_REQUIRES_HUMAN_ADOPTION')
    expect(adopted.preservesDraftFacts).toBe(true)
    expect(draft.status).toBe('DRAFT_REQUIRES_HUMAN_ADOPTION')
    expect(draft.humanAdoption).toBe('NOT_ESTABLISHED')

    const deferred = adoptSageAccountabilityDraft({
      draft,
      choice: 'defer',
      adoptedAt: '2026-11-23T15:05:00.000Z',
      adoptingActorId: 'officer-1',
      adoptingPositionId: 'pos-1',
      rationale: 'Need successor review of competing explanations',
      nextDecisionOwnerActorId: 'successor-1',
      mandateDecision: {
        allowed: true,
        reason: 'ADMITTED',
        mandateId: 'm-defer',
        instrumentRef: 'DEL-T01',
        instrumentVersion: 'v1',
      },
    })
    expect(deferred.status).toBe('DEFERRED')
    expect(deferred.nextDecisionOwnerActorId).toBe('successor-1')
  })
})
