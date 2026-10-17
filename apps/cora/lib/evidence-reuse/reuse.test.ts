import { describe, expect, it } from 'vitest'
import { resolveEvidence } from '../evidence-resolution/resolve'
import { evaluateRights } from '../source-continuity/rights'
import { measureEvidenceReuseRatio, compareEvidenceMobilityFriction } from './metrics'
import { qualifyEvidenceReuse } from './reuse'
import {
  buildSyntheticOrganicJourney,
  journeyScenario,
  syntheticIssuerPort,
} from './fixtures/synthetic-organic-journey'
import { candidateFromAssertion } from './resolve-use'
import { bindEvidenceAssertion } from './authority'

describe('synthetic institutional evidence reuse', () => {
  it.each(['MATCHED', 'PARTIAL', 'NOT_SATISFIED'] as const)(
    'reuses one governed assertion: A MATCHED / B %s',
    (outcome) => {
      const journey = journeyScenario(outcome)
      const event = qualifyEvidenceReuse(journey.attempt, journey.authority)
      expect(event.originatingResolution.state).toBe('MATCHED')
      expect(event.consumingResolution.state).toBe(outcome)
      expect(event.qualification).toBe('QUALIFIED_REUSE')
      expect(event.reconstructionAvoided).toBe('ESTABLISHED')
      expect(journey.attempt.originating.assertion).toBe(journey.attempt.consuming.assertion)
      expect(event.originatingResolution.evidence).toEqual(event.consumingResolution.evidence)
      expect(event.originating.authorizationRef).not.toBe(event.consuming.authorizationRef)
      expect(event.originating.interpretationRef).not.toBe(event.consuming.interpretationRef)
      expect(event).not.toHaveProperty('disposition')
      expect(event).not.toHaveProperty('claims')
    },
  )

  it('fails closed for A authorized / B unauthorized and excludes the opportunity', () => {
    const journey = buildSyntheticOrganicJourney()
    journey.attempt.consuming.requirement.rights.disclosure = 'UNKNOWN'
    const event = qualifyEvidenceReuse(journey.attempt, journey.authority)
    expect(event.originatingResolution.state).toBe('MATCHED')
    expect(event.consumingResolution.state).toBe('NOT_AUTHORIZED')
    expect(event.qualification).toBe('NOT_AUTHORIZED')
    const metric = measureEvidenceReuseRatio([event])
    expect(metric).toMatchObject({
      numerator: 0,
      denominator: 0,
      ratio: null,
      state: 'NO_ELIGIBLE_OPPORTUNITIES',
    })
    expect(metric.excludedEventCounts.NOT_AUTHORIZED).toBe(1)
  })

  it.each(['DUPLICATE_UPLOAD', 'RECONSTRUCTED_ASSERTION', 'TECHNICAL_COPY_ONLY'] as const)(
    'excludes %s rather than counting repeated payload as reuse',
    (acquisition) => {
      const journey = buildSyntheticOrganicJourney()
      journey.attempt.acquisition = acquisition
      if (acquisition === 'DUPLICATE_UPLOAD') {
        journey.attempt.consuming.assertion = {
          ...journey.assertion,
          evidence: { ...journey.assertion.evidence, evidenceId: 'new-technical-upload-record' },
        }
      }
      const event = qualifyEvidenceReuse(journey.attempt, journey.authority)
      expect(event.qualification).toBe(acquisition)
      const metric = measureEvidenceReuseRatio([event])
      expect(metric.numerator).toBe(0)
      expect(metric.denominator).toBe(0)
      expect(metric.excludedEventCounts[acquisition]).toBe(1)
    },
  )

  it('counts qualified reuse once across repeated evaluation and event IDs', () => {
    const journey = buildSyntheticOrganicJourney()
    const first = qualifyEvidenceReuse(journey.attempt, journey.authority)
    const repeat = qualifyEvidenceReuse(
      { ...journey.attempt, eventId: 'synthetic-repeat' },
      journey.authority,
    )
    expect(measureEvidenceReuseRatio([first, first, repeat])).toMatchObject({
      numerator: 1,
      denominator: 1,
      ratio: 1,
      repeatedEvaluationCount: 2,
    })
  })

  it.each([
    'manualReentry',
    'sourceRetrieval',
    'duplicateDocumentProduction',
    'evidenceReconstruction',
  ] as const)('requires measured reconstruction avoidance: %s', (step) => {
    const journey = buildSyntheticOrganicJourney()
    journey.attempt.reconstructionEvidence[step] = 1
    const event = qualifyEvidenceReuse(journey.attempt, journey.authority)
    expect(event.qualification).toBe('INELIGIBLE')
    expect(event.rejectionReasons).toContain('RECONSTRUCTION_AVOIDANCE_NOT_ESTABLISHED')
    expect(measureEvidenceReuseRatio([event])).toMatchObject({
      numerator: 0,
      denominator: 1,
      ratio: 0,
    })
  })

  it('calculates numerator, eligible denominator and excluded-event counts', () => {
    const journey = buildSyntheticOrganicJourney()
    const qualified = qualifyEvidenceReuse(journey.attempt, journey.authority)
    const pending = qualifyEvidenceReuse(
      {
        ...journey.attempt,
        eventId: 'synthetic-pending',
        consuming: { ...journey.attempt.consuming, contextId: 'synthetic-other-opportunity' },
        reconstructionAvoided: 'UNKNOWN',
      },
      journey.authority,
    )
    const excluded = (
      ['DUPLICATE_UPLOAD', 'RECONSTRUCTED_ASSERTION', 'TECHNICAL_COPY_ONLY'] as const
    ).map((acquisition) =>
      qualifyEvidenceReuse(
        { ...journey.attempt, eventId: `pseudo-${acquisition}`, acquisition },
        journey.authority,
      ),
    )
    const metric = measureEvidenceReuseRatio([qualified, pending, ...excluded])
    expect(metric).toMatchObject({ numerator: 1, denominator: 2, ratio: 0.5 })
    expect(metric.excludedEventCounts).toMatchObject({
      DUPLICATE_UPLOAD: 1,
      RECONSTRUCTED_ASSERTION: 1,
      TECHNICAL_COPY_ONLY: 1,
    })
  })

  it('refuses conflicting event IDs or changed qualification for the same opportunity', () => {
    const journey = buildSyntheticOrganicJourney()
    const qualified = qualifyEvidenceReuse(journey.attempt, journey.authority)
    const pending = qualifyEvidenceReuse(
      { ...journey.attempt, eventId: 'pending', reconstructionAvoided: 'UNKNOWN' },
      journey.authority,
    )
    expect(() => measureEvidenceReuseRatio([qualified, pending])).toThrow('conflicting evaluations')
    expect(() =>
      measureEvidenceReuseRatio([qualified, { ...pending, eventId: qualified.eventId }]),
    ).toThrow('conflicting content')
  })

  it.each(['same-institution', 'same-context', 'same-authority', 'origin-disposition'] as const)(
    'rejects non-independent context: %s',
    (caseName) => {
      const journey = buildSyntheticOrganicJourney()
      const { originating: a, consuming: b } = journey.attempt
      if (caseName === 'same-institution') b.institutionId = a.institutionId
      if (caseName === 'same-context') b.contextId = a.contextId
      if (caseName === 'same-authority') b.decisionAuthorityRef = a.decisionAuthorityRef
      if (caseName === 'origin-disposition') journey.attempt.originDispositionUsedAsAuthority = true
      expect(qualifyEvidenceReuse(journey.attempt, journey.authority).qualification).toBe(
        'NOT_INDEPENDENT_CONTEXT',
      )
    },
  )

  it('does not silently reuse an evidence version or provenance change', () => {
    const journey = buildSyntheticOrganicJourney()
    journey.attempt.consuming.assertion = {
      ...journey.assertion,
      evidence: {
        ...journey.assertion.evidence,
        version: 'v2',
        provenanceRef: 'different-provenance',
      },
    }
    const event = qualifyEvidenceReuse(journey.attempt, journey.authority)
    expect(event.qualification).toBe('NOT_SAME_EVIDENCE')
    expect(event.consumingResolution.state).toBe('UNKNOWN')
    expect(event.consumingResolution.reasonRefs).toContain('EVIDENCE_VERSION_MISMATCH')
  })

  it.each(['DENIED', 'UNKNOWN', 'ALLOWED_WITH_CONDITIONS', 'EXPIRED'] as const)(
    'never grants recipient disclosure from %s',
    (disclosure) => {
      const journey = buildSyntheticOrganicJourney()
      journey.attempt.consuming.requirement.rights.disclosure = disclosure
      const event = qualifyEvidenceReuse(journey.attempt, journey.authority)
      expect(event.consumingResolution.state).toBe('NOT_AUTHORIZED')
      expect(event.qualification).toBe('NOT_AUTHORIZED')
    },
  )

  it.each(['recipient', 'purpose', 'revoked', 'expired', 'future'] as const)(
    'enforces recipient authorization scope/time: %s',
    (caseName) => {
      const journey = buildSyntheticOrganicJourney()
      const rights = journey.attempt.consuming.requirement.rights
      if (caseName === 'recipient') rights.permittedRecipients = ['not-b']
      if (caseName === 'purpose') rights.permittedPurposes = ['not-b-purpose']
      if (caseName === 'revoked') rights.revokedAt = '2026-02-28T00:00:00.000Z'
      if (caseName === 'expired') rights.expiresAt = '2026-02-28T00:00:00.000Z'
      if (caseName === 'future') rights.validFrom = '2026-04-01T00:00:00.000Z'
      const event = qualifyEvidenceReuse(journey.attempt, journey.authority)
      expect(event.consumingResolution.state).toBe(
        caseName === 'expired' ? 'EXPIRED' : 'NOT_AUTHORIZED',
      )
      expect(measureEvidenceReuseRatio([event]).numerator).toBe(0)
    },
  )

  it.each([
    'expired',
    'future-requirement',
    'stale',
    'methodology',
    'interpretation',
    'old-observation',
  ] as const)('excludes temporal/version incompatibility: %s', (caseName) => {
    const journey = buildSyntheticOrganicJourney()
    const b = journey.attempt.consuming
    if (caseName === 'expired') b.requirement.evidenceValidUntil = '2026-02-28T00:00:00.000Z'
    if (caseName === 'future-requirement') b.requirement.validFrom = '2026-04-01T00:00:00.000Z'
    if (caseName === 'stale')
      b.assertion = {
        ...journey.assertion,
        evidence: { ...journey.assertion.evidence, freshness: 'STALE' },
      }
    if (caseName === 'methodology')
      b.requirement.requiredMethodology = {
        ...journey.candidate.evidence.methodology!,
        version: '2',
      }
    if (caseName === 'interpretation') b.interpretation.version = '4'
    if (caseName === 'old-observation') b.requirement.maximumEvidenceAgeSeconds = 60
    const event = qualifyEvidenceReuse(journey.attempt, journey.authority)
    expect(event.consumingResolution.state).toBe(caseName === 'expired' ? 'EXPIRED' : 'UNKNOWN')
    expect(event.qualification).not.toBe('QUALIFIED_REUSE')
    expect(measureEvidenceReuseRatio([event]).numerator).toBe(0)
  })

  it('preserves disagreeing assertions and authorities without choosing a winner', () => {
    const journey = buildSyntheticOrganicJourney()
    const conflicting = {
      ...candidateFromAssertion(journey.assertion),
      evidence: {
        ...journey.assertion.evidence,
        evidenceId: 'synthetic-conflict',
        sourceAuthorityId: 'synthetic-other-issuer',
      },
      support: {
        ...journey.support,
        sourceAuthorityId: 'synthetic-other-issuer',
        sourceRef: { ...journey.support.sourceRef, objectId: 'synthetic-other-record' },
        claims: [{ conceptRef: 'certification.status', value: 'NOT_CERTIFIED' }],
      },
      authorityBindingRef: 'synthetic-conflict-binding',
    }
    const authority = syntheticIssuerPort([journey.candidate, conflicting])
    const bound = bindEvidenceAssertion(conflicting, authority, journey.attempt.at)
    if (bound.state !== 'BOUND') throw new Error('Synthetic conflicting assertion did not bind')
    journey.attempt.consuming.supplementalAssertions = [bound.assertion]
    const event = qualifyEvidenceReuse(journey.attempt, authority)
    expect(event.originatingResolution.state).toBe('MATCHED')
    expect(event.consumingResolution.state).toBe('CONFLICT')
    expect(event.qualification).toBe('INELIGIBLE')
    expect(event.supportingEvidence).toHaveLength(2)
    expect(new Set(event.supportingEvidence.map((item) => item.sourceAuthorityId)).size).toBe(2)
    expect(journey.attempt.consuming.supplementalAssertions[0]!.support.claims[0]!.value).toBe(
      'NOT_CERTIFIED',
    )
    expect(journey.assertion.support.claims[0]!.value).toBe('CERTIFIED')
  })

  it('keeps recipient dispositions external and rights action-specific', () => {
    const journey = buildSyntheticOrganicJourney()
    const [a, b] = journey.dispositions
    expect(a!.authorityRef).not.toBe(b!.authorityRef)
    expect(a!.dispositionRef).not.toBe(b!.dispositionRef)
    const requirement = journey.attempt.consuming.requirement
    expect(resolveEvidence(journey.assertion.evidence, requirement)).not.toHaveProperty(
      'disposition',
    )
    expect(qualifyEvidenceReuse(journey.attempt, journey.authority)).not.toHaveProperty(
      'disposition',
    )
    for (const action of ['PERSIST', 'TRANSFORM', 'EXPORT', 'REHYDRATE', 'DELETE'] as const) {
      expect(
        evaluateRights(requirement.rights, action, {
          purpose: requirement.purpose,
          recipientId: requirement.recipientId,
          at: journey.attempt.at,
        }).allowed,
      ).toBe(false)
    }
  })

  it('compares synthetic friction counts without claiming elapsed-time savings', () => {
    const journey = buildSyntheticOrganicJourney()
    const comparison = compareEvidenceMobilityFriction(journey.baseline, journey.reused)
    expect(comparison).toMatchObject({ baselineTotal: 7, reuseTotal: 3, frictionDelta: 4 })
    expect(comparison.avoided.map((item) => item.step)).toEqual([
      'sourceRetrieval',
      'manualReentry',
      'duplicateDocumentProduction',
      'evidenceReconstruction',
    ])
    expect(comparison.remaining.map((item) => item.step)).toEqual([
      'semanticClarification',
      'permissionRemediation',
      'institutionalReverification',
    ])
    expect(comparison).not.toHaveProperty('timeSavings')
    expect(() =>
      compareEvidenceMobilityFriction(journey.baseline, {
        ...journey.reused,
        evidenceVersion: 'v2',
      }),
    ).toThrow('same context and evidence version')
    expect(() =>
      compareEvidenceMobilityFriction(journey.baseline, {
        ...journey.reused,
        events: { ...journey.reused.events, manualReentry: -1 },
      }),
    ).toThrow()
  })
})
