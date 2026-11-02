import { describe, expect, it } from 'vitest'
import { buildStabilizationReading, stabilizationReadingSchema } from './index'

const reading = { signal: 'operational-calmness', banding: 'stable', observedAt: '2026-11-02T12:00:00.000Z', windowMinutes: 5, scope: { kind: 'system', systemId: 'system-1' }, interpretation: 'No change', advisory: 'Maintain cadence' } as const

describe('Zod 4 stabilization safety', () => {
  it('preserves valid banded system readings', () => {
    expect(stabilizationReadingSchema.parse(reading).banding).toBe('stable')
    expect(buildStabilizationReading(reading).scope.systemId).toBe('system-1')
  })
  it('rejects individual keys, invalid bands and too-fast refreshes', () => {
    expect(stabilizationReadingSchema.safeParse({ ...reading, userId: 'person' }).success).toBe(false)
    expect(stabilizationReadingSchema.safeParse({ ...reading, banding: 'critical' }).success).toBe(false)
    expect(() => buildStabilizationReading({ ...reading, windowMinutes: 1 })).toThrow()
  })
})
