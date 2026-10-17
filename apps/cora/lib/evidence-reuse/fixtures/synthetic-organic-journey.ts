import type { MethodologyVersionRef } from '../../evidence-foundation/contracts'
import {
  SYNTHETIC_DISPOSITIONS,
  SYNTHETIC_REQUIREMENTS,
} from '../../evidence-resolution/fixtures/synthetic-cross-institution'
import { assembleContinuityCapsule } from '../../source-continuity/capsule'
import { createSourceCapture } from '../../source-continuity/capture'
import { buildSyntheticRouteFixture } from '../../source-continuity/fixtures/synthetic-routes'
import {
  assertionCandidateDigest,
  bindEvidenceAssertion,
  referenceContinuitySupport,
} from '../authority'
import type {
  AssertionCandidate,
  AuthorityBinding,
  InstitutionalUse,
  IssuerAuthorityPort,
  ReuseAttempt,
} from '../contracts'
import type { EvidenceMobilityFriction } from '../metrics'

export const JOURNEY_TIME = '2026-03-01T12:00:00.000Z'
export const SYNTHETIC_METHODOLOGY: MethodologyVersionRef = {
  id: '00000000-0000-4000-8000-000000000001',
  authorityId: 'synthetic-standard-authority',
  methodologyId: 'synthetic-organic-status-standard',
  version: '1',
  definitionSha256: 'a'.repeat(64),
}

export function syntheticIssuerPort(candidates: AssertionCandidate[]): IssuerAuthorityPort {
  const bindings = new Map<string, AuthorityBinding>(
    candidates.map((candidate) => [
      candidate.authorityBindingRef,
      {
        bindingRef: candidate.authorityBindingRef,
        issuerAuthorityId: candidate.evidence.sourceAuthorityId,
        relationship: 'ISSUER_FOR_ASSERTION',
        state: 'ESTABLISHED',
        candidateSha256: assertionCandidateDigest(candidate),
        validFrom: '2026-02-01T00:00:00.000Z',
        validUntil: '2027-02-01T00:00:00.000Z',
      },
    ]),
  )
  return { resolveBinding: (ref) => bindings.get(ref) }
}

export function buildSyntheticOrganicJourney() {
  const route = buildSyntheticRouteFixture('NATIVE_STRATEGIC_CONNECTOR')
  const { integritySha256: _digest, ...captureDraft } = route.capture
  const capture = createSourceCapture(
    {
      ...captureDraft,
      rights: {
        ...captureDraft.rights,
        decisionRef: 'synthetic-support-rights',
        permittedPurposes: [
          captureDraft.purpose,
          ...SYNTHETIC_REQUIREMENTS.map((requirement) => requirement.purpose),
        ],
        permittedRecipients: [
          captureDraft.recipientId,
          ...SYNTHETIC_REQUIREMENTS.map((requirement) => requirement.recipientId),
        ],
        export: 'UNKNOWN',
        rehydration: 'UNKNOWN',
        deletion: 'UNKNOWN',
      },
    },
    route.capture.orgId,
    route.capture.capturedAt,
  )
  const capsule = assembleContinuityCapsule(
    {
      format: 'CORA_CONTINUITY_CAPSULE',
      formatVersion: '1.0',
      capsuleId: 'synthetic-organic-continuity-capsule',
      orgId: capture.orgId,
      purpose: capture.purpose,
      createdAt: capture.capturedAt,
      subjectRef: capture.sourceRef,
      captures: [capture],
      mappings: [route.mapping],
      limitations: [
        'Synthetic only; not certification, institutional acceptance, or live-source proof',
      ],
    },
    capture.orgId,
  )
  const support = referenceContinuitySupport(
    capsule,
    capture.captureId,
    route.mapping.mappingId,
    route.mapping.version,
    JOURNEY_TIME,
  )
  const candidate: AssertionCandidate = {
    evidence: {
      evidenceId: 'synthetic-organic-evidence-001',
      version: 'v1',
      sourceAuthorityId: capture.sourceAuthority.authorityId,
      provenanceRef: support.provenanceRef,
      methodology: structuredClone(SYNTHETIC_METHODOLOGY),
      observedAt: capture.sourceObservedAt,
      validFrom: '2026-02-01T00:00:00.000Z',
      validUntil: '2027-02-01T00:00:00.000Z',
      freshness: 'NOT_VERIFIED',
    },
    support,
    evidenceClass: 'SYNTHETIC_ORGANIC_STATUS_ASSERTION',
    subjectRef: 'synthetic-operator-001',
    scopeRef: 'synthetic-site-001',
    authorityBindingRef: 'synthetic-issuer-binding-001',
  }
  const authority = syntheticIssuerPort([candidate])
  const bound = bindEvidenceAssertion(candidate, authority, JOURNEY_TIME)
  if (bound.state !== 'BOUND')
    throw new Error(`Synthetic issuer binding failed: ${bound.reasonRefs.join(', ')}`)
  const assertion = bound.assertion
  const requirements = structuredClone(SYNTHETIC_REQUIREMENTS)
  const makeUse = (index: number): InstitutionalUse => {
    const requirement = requirements[index]!
    return {
      contextId:
        index === 0 ? 'synthetic-canada-organic-context' : 'synthetic-independent-second-context',
      institutionId: `synthetic-institution-${index}`,
      decisionAuthorityRef: SYNTHETIC_DISPOSITIONS[index]!.authorityRef,
      assertion,
      supplementalAssertions: [],
      requirement: {
        ...requirement,
        expectedEvidenceVersion: assertion.evidence.version,
        requiredMethodology: structuredClone(SYNTHETIC_METHODOLOGY),
        expectedInterpretationVersion: index === 0 ? '1' : '3',
        validFrom: '2026-02-01T00:00:00.000Z',
        validUntil: index === 0 ? '2026-12-31T00:00:00.000Z' : '2026-06-01T00:00:00.000Z',
        requiredCriterionRefs:
          index === 0 ? ['organic-status'] : ['organic-status', 'supplemental-review'],
        evidenceCriterionStates: {},
      },
      interpretation: {
        interpretationRef: `synthetic-interpretation-${index}`,
        version: index === 0 ? '1' : '3',
        acceptedEvidenceClasses: ['SYNTHETIC_ORGANIC_STATUS_ASSERTION'],
        subjectRef: candidate.subjectRef,
        scopeRef: candidate.scopeRef,
        rules: [
          {
            criterionRef: 'organic-status',
            conceptRef: 'certification.status',
            expectedValue: 'CERTIFIED',
          },
          ...(index === 1
            ? [
                {
                  criterionRef: 'supplemental-review',
                  conceptRef: 'independent.review',
                  expectedValue: 'DONE',
                },
              ]
            : []),
        ],
      },
    }
  }
  const uses: [InstitutionalUse, InstitutionalUse] = [makeUse(0), makeUse(1)]
  const attempt: ReuseAttempt = {
    eventId: 'synthetic-reuse-001',
    originating: uses[0],
    consuming: uses[1],
    at: JOURNEY_TIME,
    acquisition: 'GOVERNED_REFERENCE',
    reconstructionAvoided: 'ESTABLISHED',
    reconstructionEvidence: {
      traceRef: 'synthetic-b-action-trace',
      contextId: uses[1].contextId,
      evidenceId: assertion.evidence.evidenceId,
      evidenceVersion: assertion.evidence.version,
      sourceRetrieval: 0,
      manualReentry: 0,
      duplicateDocumentProduction: 0,
      evidenceReconstruction: 0,
    },
    originDispositionUsedAsAuthority: false,
  }
  const frictionBase = {
    proofKind: 'SYNTHETIC_ACTION_COUNTS' as const,
    contextId: uses[1].contextId,
    evidenceId: assertion.evidence.evidenceId,
    evidenceVersion: assertion.evidence.version,
  }
  const baseline: EvidenceMobilityFriction = {
    ...frictionBase,
    scenario: 'BASELINE_WITHOUT_REUSE',
    events: {
      sourceRetrieval: 1,
      manualReentry: 1,
      duplicateDocumentProduction: 1,
      semanticClarification: 1,
      permissionRemediation: 1,
      institutionalReverification: 1,
      evidenceReconstruction: 1,
    },
  }
  const reused: EvidenceMobilityFriction = {
    ...frictionBase,
    scenario: 'GOVERNED_REUSE',
    events: {
      sourceRetrieval: 0,
      manualReentry: 0,
      duplicateDocumentProduction: 0,
      semanticClarification: 1,
      permissionRemediation: 1,
      institutionalReverification: 1,
      evidenceReconstruction: 0,
    },
  }
  return {
    capsule,
    support,
    candidate,
    authority,
    assertion,
    attempt,
    baseline,
    reused,
    dispositions: structuredClone(SYNTHETIC_DISPOSITIONS),
  }
}

export function journeyScenario(outcome: 'MATCHED' | 'PARTIAL' | 'NOT_SATISFIED') {
  const journey = buildSyntheticOrganicJourney()
  const b = journey.attempt.consuming
  if (outcome !== 'PARTIAL') {
    b.requirement.requiredCriterionRefs = ['organic-status']
    b.interpretation.rules = [
      {
        criterionRef: 'organic-status',
        conceptRef: 'certification.status',
        expectedValue: outcome === 'MATCHED' ? 'CERTIFIED' : 'NOT_CERTIFIED',
      },
    ]
  }
  return journey
}
