import { describe, expect, it } from 'vitest'

import {
  assertNotConflated,
  assertPerformanceClaim,
  deriveEpistemicClass,
  makeClaim,
} from '../kernel'
import { createEnvelope } from '../envelope'
import { sealThesis } from '../decision'

describe('E. epistemic integrity', () => {
  it('keeps fact, assumption, estimate, scenario, and thesis distinct', () => {
    expect(assertNotConflated('FACT', 'ESTIMATE').ok).toBe(false)
    expect(assertNotConflated('SCENARIO', 'FACT').ok).toBe(false)
    expect(assertNotConflated('THESIS', 'AUTHORIZATION').ok).toBe(false)
    expect(assertNotConflated('DECISION', 'DECISION').ok).toBe(true)
    const fact = makeClaim({ epistemicClass: 'FACT', confidenceBps: 10_000, statement: 'Cash was observed.', evidenceIds: [] })
    expect(fact.ok).toBe(false)
    const factWithEvidence = makeClaim({
      epistemicClass: 'FACT',
      confidenceBps: 10_000,
      statement: 'Cash was observed.',
      evidenceIds: ['e1'],
    })
    expect(factWithEvidence.ok).toBe(true)
    const scenario = makeClaim({ epistemicClass: 'SCENARIO', confidenceBps: 9_000, statement: 'Bull case.' })
    expect(scenario.ok).toBe(false)
    if (!scenario.ok) expect(scenario.code).toBe('EXCESSIVE_CONFIDENCE')
    const bounded = makeClaim({ epistemicClass: 'SCENARIO', confidenceBps: 5_000, statement: 'Bull case.' })
    expect(bounded.ok).toBe(true)
    if (bounded.ok) expect(bounded.value.epistemicClass).toBe('SCENARIO')
  })

  it('does not promote a counterfactual or a scenario to fact', () => {
    const cost = deriveEpistemicClass(['FACT', 'FACT'], { counterfactual: true })
    expect(cost.ok && cost.value).toBe('ESTIMATE')
    const mixed = deriveEpistemicClass(['FACT', 'SCENARIO'])
    expect(mixed.ok && mixed.value).toBe('SCENARIO')
    const assumption = deriveEpistemicClass(['ESTIMATE', 'ASSUMPTION'])
    expect(assumption.ok && assumption.value).toBe('ASSUMPTION')
    const guaranteed = assertPerformanceClaim({
      epistemicClass: 'FACT',
      returnBps: 4000,
      narrative: 'This return is guaranteed.',
    })
    expect(guaranteed.ok).toBe(false)
    if (!guaranteed.ok) expect(guaranteed.code).toBe('SPECULATIVE_AS_FACT')
    const impossible = assertPerformanceClaim({ epistemicClass: 'FACT', returnBps: 200_000 })
    expect(impossible.ok).toBe(false)
    if (!impossible.ok) expect(impossible.code).toBe('IMPOSSIBLE_RETURN')
  })

  it('refuses to store an envelope or a model note as fact', () => {
    const envelope = createEnvelope({
      id: 'env',
      currency: 'CAD',
      ceilingMinor: 10,
      benchmarkAlternativeId: 'b',
      evidenceGateIds: [],
      thesisId: 't',
      downsideCaseIds: ['d'],
      impairmentScenarioIds: ['i'],
      liquidityNote: 'plan',
      concentrationNote: 'plan',
      epistemicClass: 'FACT',
    })
    expect(envelope.ok).toBe(false)
    if (!envelope.ok) expect(envelope.code).toBe('EPISTEMIC_CONFLATION')
    const thesis = sealThesis({
      id: 't',
      version: 1,
      epistemicClass: 'THESIS',
      statement: 'A thesis is not a fill.',
      sourceIds: ['s'],
      priorHash: null,
    })
    expect(thesis.ok).toBe(true)
    if (thesis.ok) expect(thesis.value.epistemicClass).toBe('THESIS')
  })
})
