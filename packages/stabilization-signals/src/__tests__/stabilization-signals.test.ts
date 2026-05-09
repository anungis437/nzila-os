import { describe, it, expect } from 'vitest'
import {
  bandFromObservation,
  buildStabilizationReading,
  composite,
  stabilizationAdvisory,
  STABILIZATION_REFRESH_MS,
} from '../index'

describe('stabilization signals', () => {
  it('bands observations conservatively', () => {
    expect(bandFromObservation({ disturbanceCount: 0, windowMinutes: 60 })).toBe('stable')
    expect(bandFromObservation({ disturbanceCount: 2, windowMinutes: 60 })).toBe('warming')
    expect(bandFromObservation({ disturbanceCount: 8, windowMinutes: 60 })).toBe('concerning')
    expect(bandFromObservation({ disturbanceCount: 50, windowMinutes: 60 })).toBe('destabilizing')
  })

  it('produces stabilization-oriented advisory text', () => {
    expect(stabilizationAdvisory('stable')).toMatch(/maintain/i)
    expect(stabilizationAdvisory('warming')).toMatch(/extend/i)
    expect(stabilizationAdvisory('concerning')).toMatch(/reduce/i)
    expect(stabilizationAdvisory('destabilizing')).toMatch(/pause/i)
    for (const band of ['stable', 'warming', 'concerning', 'destabilizing'] as const) {
      expect(stabilizationAdvisory(band)).not.toMatch(/accelerate|push|faster/i)
    }
  })

  it('refuses windows shorter than 5 minutes', () => {
    expect(() =>
      buildStabilizationReading({
        signal: 'operational-calmness',
        banding: 'stable',
        observedAt: '2026-05-09T12:00:00.000Z',
        windowMinutes: 1,
        scope: { kind: 'system', systemId: 'union-eyes' },
        interpretation: 'Calm.',
      }),
    ).toThrow(/at_least_5_minutes/)
  })

  it('default refresh cadence is at least five minutes', () => {
    expect(STABILIZATION_REFRESH_MS).toBeGreaterThanOrEqual(5 * 60_000)
  })

  it('refuses composite scoring', () => {
    expect(() => composite()).toThrow(/refuse_composite/)
  })
})
