import { describe, expect, it } from 'vitest'
import { continuityIndicatorSchema } from './posture'
import { cognitiveSafetyThresholdSchema } from './cognitive-safety'

const indicator = { id: 'ind-1', description: 'System pacing', scope: { kind: 'product', product: 'union-eyes' }, posture: 'stable', trajectory: 'improving', observedAt: '2026-11-02T12:00:00.000Z' } as const

describe('Zod 4 continuity isolation', () => {
  it('preserves valid system-only indicators', () => {
    expect(continuityIndicatorSchema.parse(indicator).scope.kind).toBe('product')
  })
  it('rejects person-resolving keys and invalid thresholds', () => {
    expect(continuityIndicatorSchema.safeParse({ ...indicator, userId: 'person' }).success).toBe(false)
    expect(continuityIndicatorSchema.safeParse({ ...indicator, scope: { kind: 'product', product: 'union-eyes', userId: 'person' } }).success).toBe(false)
    expect(cognitiveSafetyThresholdSchema.safeParse({ dimension: 'density', surfaceId: 'surface', threshold: -1, currentValue: 0, calmWindowSeconds: 60, observedAt: '2026-11-02T12:00:00.000Z' }).success).toBe(false)
  })
})
