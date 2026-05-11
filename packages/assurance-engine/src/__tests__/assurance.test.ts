import { describe, it, expect } from 'vitest'

import {
  CompositeCollapseRefusedError,
  StandardAssuranceCalculator,
  deriveBand,
  deriveConfidence,
  refuseCompositeCollapse,
  type AssuranceDimensionInput,
} from '../index'

const baseInput: AssuranceDimensionInput = {
  dimension: 'deployment-legitimacy',
  scope: { kind: 'product', product: 'union-eyes' },
  observed: 100,
  compliant: 99,
  signalCompleteness: 0.95,
  evidence: [
    {
      id: 'evd-001',
      contentHash: 'sha256-abcdefg123',
      description: 'release attestation manifest 2026-05-09',
    },
  ],
  windowStart: '2026-05-01T00:00:00.000Z',
  windowEnd: '2026-05-09T00:00:00.000Z',
}

describe('band derivation', () => {
  it('strong at >= 99% compliance', () => {
    expect(deriveBand({ ...baseInput, observed: 100, compliant: 99 })).toBe('strong')
  })

  it('established at 95-98%', () => {
    expect(deriveBand({ ...baseInput, observed: 100, compliant: 96 })).toBe('established')
  })

  it('forming at 85-94%', () => {
    expect(deriveBand({ ...baseInput, observed: 100, compliant: 90 })).toBe('forming')
  })

  it('concern below 85%', () => {
    expect(deriveBand({ ...baseInput, observed: 100, compliant: 50 })).toBe('concern')
  })

  it('forming when no observations', () => {
    expect(deriveBand({ ...baseInput, observed: 0, compliant: 0 })).toBe('forming')
  })
})

describe('confidence derivation', () => {
  it('high with strong signal and volume', () => {
    expect(deriveConfidence(baseInput)).toBe('high')
  })

  it('low with weak signal', () => {
    expect(deriveConfidence({ ...baseInput, signalCompleteness: 0.4 })).toBe('low')
  })

  it('moderate with moderate signal and volume', () => {
    expect(
      deriveConfidence({ ...baseInput, signalCompleteness: 0.75, observed: 15 }),
    ).toBe('moderate')
  })
})

describe('StandardAssuranceCalculator', () => {
  it('returns a per-dimension posture read', () => {
    const calc = new StandardAssuranceCalculator()
    const read = calc.band(baseInput, { evaluatedAt: '2026-05-09T12:00:00.000Z' })
    expect(read.dimension).toBe('deployment-legitimacy')
    expect(read.band).toBe('strong')
    expect(read.confidence).toBe('high')
    expect(read.evidence.length).toBe(1)
  })

  it('rejects malformed inputs (compliant > observed)', () => {
    const calc = new StandardAssuranceCalculator()
    expect(() => calc.band({ ...baseInput, compliant: 200 })).toThrow()
  })
})

describe('composite collapse refusal', () => {
  it('throws CompositeCollapseRefusedError', () => {
    expect(() => refuseCompositeCollapse()).toThrow(CompositeCollapseRefusedError)
  })
})
