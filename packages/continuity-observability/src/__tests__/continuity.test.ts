import { describe, it, expect } from 'vitest'

import {
  cognitiveSafetyThresholdSchema,
  continuityIndicatorSchema,
  dominantPosture,
  dominantTrajectory,
  isOverBudget,
  recommendStabilization,
  type CognitiveSafetyThreshold,
  type ContinuityIndicator,
} from '../index'

const baseIndicator: ContinuityIndicator = {
  id: 'ind.ue.case.detail',
  description: 'Case detail surface posture.',
  scope: { kind: 'surface', surfaceId: 'ue/case/detail' },
  posture: 'stable',
  trajectory: 'stable',
  observedAt: '2026-05-09T12:00:00.000Z',
}

describe('posture helpers', () => {
  it('validates a well-formed indicator', () => {
    expect(() => continuityIndicatorSchema.parse(baseIndicator)).not.toThrow()
  })

  it('selects the worst posture across indicators', () => {
    const indicators: ContinuityIndicator[] = [
      baseIndicator,
      { ...baseIndicator, id: 'b', posture: 'concerning' },
      { ...baseIndicator, id: 'c', posture: 'warming' },
    ]
    expect(dominantPosture(indicators)).toBe('concerning')
  })

  it('returns stable on empty input', () => {
    expect(dominantPosture([])).toBe('stable')
    expect(dominantTrajectory([])).toBe('stable')
  })

  it('selects the worst trajectory', () => {
    const indicators: ContinuityIndicator[] = [
      { ...baseIndicator, trajectory: 'improving' },
      { ...baseIndicator, id: 'b', trajectory: 'drifting' },
    ]
    expect(dominantTrajectory(indicators)).toBe('drifting')
  })
})

describe('cognitive safety', () => {
  const threshold: CognitiveSafetyThreshold = {
    dimension: 'density',
    surfaceId: 'exec/dashboard',
    threshold: 20,
    currentValue: 18,
    calmWindowSeconds: 600,
    observedAt: '2026-05-09T12:00:00.000Z',
  }

  it('validates a well-formed threshold', () => {
    expect(() => cognitiveSafetyThresholdSchema.parse(threshold)).not.toThrow()
  })

  it('reports under-budget correctly', () => {
    expect(isOverBudget(threshold)).toBe(false)
    expect(
      recommendStabilization(threshold, { issuedAt: '2026-05-09T12:00:00.000Z' }),
    ).toBeNull()
  })

  it('issues a stabilization recommendation when over budget', () => {
    const over: CognitiveSafetyThreshold = { ...threshold, currentValue: 30 }
    const rec = recommendStabilization(over, { issuedAt: '2026-05-09T12:00:00.000Z' })
    expect(rec).not.toBeNull()
    expect(rec?.kind).toBe('reduce-density')
    expect(rec?.doctrineCitations.length).toBeGreaterThan(0)
  })
})
