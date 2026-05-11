import { describe, it, expect } from 'vitest'
import {
  buildContinuityReviewCard,
  stabilizationGuidanceFor,
} from '../index'

describe('continuity review', () => {
  it('builds a system-scoped card', () => {
    const card = buildContinuityReviewCard({
      dimension: 'fragmentation',
      banding: 'warming',
      trajectory: 'drifting',
      scope: { kind: 'system', systemId: 'union-eyes-pilot' },
      interpretation: 'Fragmentation is warming across the rollout corridor.',
      stabilizationGuidance: stabilizationGuidanceFor('warming'),
      observedAt: '2026-05-09T12:00:00.000Z',
      windowMinutes: 60,
    })
    expect(card.banding).toBe('warming')
  })

  it('refuses person-scoping (literal "system" only)', () => {
    expect(() =>
      buildContinuityReviewCard({
        dimension: 'fragmentation',
        banding: 'stable',
        trajectory: 'holding',
        // @ts-expect-error structural refusal
        scope: { kind: 'person', systemId: 'x' },
        interpretation: 'x',
        stabilizationGuidance: 'x',
        observedAt: '2026-05-09T12:00:00.000Z',
        windowMinutes: 60,
      }),
    ).toThrow()
  })

  it('refuses person-resolving language in interpretation', () => {
    expect(() =>
      buildContinuityReviewCard({
        dimension: 'fragmentation',
        banding: 'stable',
        trajectory: 'holding',
        scope: { kind: 'system', systemId: 'x' },
        interpretation: 'employee_id 42 is fragmenting',
        stabilizationGuidance: 'ok',
        observedAt: '2026-05-09T12:00:00.000Z',
        windowMinutes: 60,
      }),
    ).toThrow(/forbidden_person_key_in_text/)
  })

  it('produces stabilization-oriented guidance for every band', () => {
    expect(stabilizationGuidanceFor('stable')).toMatch(/maintain/i)
    expect(stabilizationGuidanceFor('warming')).toMatch(/extend/i)
    expect(stabilizationGuidanceFor('concerning')).toMatch(/reduce/i)
    expect(stabilizationGuidanceFor('destabilizing')).toMatch(/pause/i)
  })
})
