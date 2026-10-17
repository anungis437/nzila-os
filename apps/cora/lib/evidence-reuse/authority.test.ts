import { describe, expect, it } from 'vitest'
import { continuityCapsuleSchema } from '../source-continuity/capsule'
import { bindEvidenceAssertion, referenceContinuitySupport } from './authority'
import { buildSyntheticOrganicJourney } from './fixtures/synthetic-organic-journey'
import { qualifyEvidenceReuse } from './reuse'

describe('continuity material / issuer authority boundary', () => {
  it('retains normalized source data as support, rejecting an assertion without issuer binding', () => {
    const journey = buildSyntheticOrganicJourney()
    expect(journey.support.kind).toBe('EVIDENCE_SUPPORT')
    expect(journey.support.claims).toContainEqual({
      conceptRef: 'certification.status',
      value: 'CERTIFIED',
    })
    const result = bindEvidenceAssertion(
      journey.candidate,
      { resolveBinding: () => undefined },
      journey.attempt.at,
    )
    expect(result.state).toBe('REJECTED')
    if (result.state !== 'REJECTED') throw new Error('Expected authority rejection')
    expect(result.reasonRefs).toContain('ISSUER_BINDING_NOT_ESTABLISHED')
    expect(result.support).toEqual(journey.support)
    expect(result).not.toHaveProperty('assertion')
  })

  it('allows an exact issuer-bound assertion with source, scope, provenance and methodology preserved', () => {
    const journey = buildSyntheticOrganicJourney()
    const result = bindEvidenceAssertion(journey.candidate, journey.authority, journey.attempt.at)
    expect(result.state).toBe('BOUND')
    if (result.state !== 'BOUND') throw new Error('Expected synthetic issuer binding')
    expect(result.assertion.kind).toBe('EVIDENCE_ASSERTION')
    expect(result.assertion.evidence.sourceAuthorityId).toBe(journey.support.sourceAuthorityId)
    expect(result.assertion.evidence.provenanceRef).toBe(journey.support.provenanceRef)
    expect(result.assertion.support.capsuleId).toBe(journey.capsule.capsuleId)
  })

  it.each(['issuer', 'subject', 'scope', 'class', 'provenance', 'value', 'methodology'] as const)(
    'rejects changing the bound %s',
    (part) => {
      const journey = buildSyntheticOrganicJourney()
      const candidate = structuredClone(journey.candidate)
      if (part === 'issuer') candidate.evidence.sourceAuthorityId = 'unbound-issuer'
      if (part === 'subject') candidate.subjectRef = 'other-subject'
      if (part === 'scope') candidate.scopeRef = 'other-scope'
      if (part === 'class') candidate.evidenceClass = 'UNBOUND_CERTIFICATE'
      if (part === 'provenance') candidate.evidence.provenanceRef = 'invented-provenance'
      if (part === 'value') candidate.support.claims[0]!.value = 'invented-value'
      if (part === 'methodology') candidate.evidence.methodology = undefined
      expect(bindEvidenceAssertion(candidate, journey.authority, journey.attempt.at).state).toBe(
        'REJECTED',
      )
    },
  )

  it.each(['UNKNOWN', 'REVOKED'] as const)(
    'rechecks issuer authority and fails closed when %s',
    (state) => {
      const journey = buildSyntheticOrganicJourney()
      const binding = journey.authority.resolveBinding(journey.candidate.authorityBindingRef)!
      const authority = { resolveBinding: () => ({ ...binding, state }) }
      expect(bindEvidenceAssertion(journey.candidate, authority, journey.attempt.at).state).toBe(
        'REJECTED',
      )
      const event = qualifyEvidenceReuse(journey.attempt, authority)
      expect(event.qualification).toBe('INELIGIBLE')
      expect(event.consumingResolution.reasonRefs).toContain(
        'ISSUER_AUTHORITY_RELATIONSHIP_NOT_ESTABLISHED',
      )
    },
  )

  it('checks upstream source rights separately from recipient authorization', () => {
    const journey = buildSyntheticOrganicJourney()
    journey.attempt.consuming.assertion = {
      ...journey.assertion,
      support: { ...journey.support, rights: { ...journey.support.rights, disclosure: 'UNKNOWN' } },
    }
    const event = qualifyEvidenceReuse(journey.attempt, journey.authority)
    expect(event.originatingResolution.state).toBe('MATCHED')
    expect(event.consumingResolution.state).toBe('NOT_AUTHORIZED')
    expect(event.qualification).toBe('NOT_AUTHORIZED')
  })

  it('rejects support-only authority and expired issuer bindings', () => {
    const journey = buildSyntheticOrganicJourney()
    const binding = journey.authority.resolveBinding(journey.candidate.authorityBindingRef)!
    const supportOnly = {
      resolveBinding: () => ({ ...binding, relationship: 'SUPPORT_ONLY' as const }),
    }
    const expired = {
      resolveBinding: () => ({ ...binding, validUntil: '2026-02-28T00:00:00.000Z' }),
    }
    expect(bindEvidenceAssertion(journey.candidate, supportOnly, journey.attempt.at).state).toBe(
      'REJECTED',
    )
    expect(bindEvidenceAssertion(journey.candidate, expired, journey.attempt.at).state).toBe(
      'REJECTED',
    )
  })

  it('rejects tampered capsules and never adds institutional outcomes to a capsule', () => {
    const journey = buildSyntheticOrganicJourney()
    expect(() =>
      referenceContinuitySupport(
        {
          ...journey.capsule,
          limitations: ['tampered'],
        },
        journey.support.captureId,
        journey.support.mappingRef,
        journey.support.mappingVersion,
        journey.attempt.at,
      ),
    ).toThrow('integrity')
    const before = JSON.stringify(journey.capsule)
    qualifyEvidenceReuse(journey.attempt, journey.authority)
    expect(JSON.stringify(journey.capsule)).toBe(before)
    for (const property of [
      'recipientDecision',
      'institutionalEligibility',
      'institutionalApproval',
      'certification',
      'fundingDetermination',
      'procurementQualification',
      'disposition',
    ]) {
      expect(
        continuityCapsuleSchema.safeParse({ ...journey.capsule, [property]: 'NOT_ALLOWED' })
          .success,
      ).toBe(false)
      expect(journey.capsule).not.toHaveProperty(property)
    }
    expect(journey.capsule.captures[0]!.payload).toHaveProperty('status', 'active')
  })
})
