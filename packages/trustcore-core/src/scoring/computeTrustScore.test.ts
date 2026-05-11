import { describe, expect, it } from 'vitest'
import { CATEGORY_CAPS, computeTrustScore } from './computeTrustScore'

describe('computeTrustScore', () => {
  it('returns 100 / compliant when no deductions and no blocking risks', () => {
    const r = computeTrustScore({ deductions: [] })
    expect(r.score).toBe(100)
    expect(r.status).toBe('compliant')
    expect(r.perCategory).toEqual({
      governance: 0, data: 0, pia: 0, incidents: 0, dsr: 0, vendors: 0,
    })
  })

  it('caps per-category deductions at CATEGORY_CAPS', () => {
    const r = computeTrustScore({
      deductions: [
        { category: 'governance', raw: 100 }, // capped at 30
        { category: 'data', raw: 50 },        // capped at 25
      ],
    })
    expect(r.perCategory.governance).toBe(CATEGORY_CAPS.governance)
    expect(r.perCategory.data).toBe(CATEGORY_CAPS.data)
    expect(r.score).toBe(100 - CATEGORY_CAPS.governance - CATEGORY_CAPS.data)
  })

  it('sums multiple deductions in same category before capping', () => {
    const r = computeTrustScore({
      deductions: [
        { category: 'pia', raw: 5 },
        { category: 'pia', raw: 10 },
      ],
    })
    expect(r.perCategory.pia).toBe(15)
    expect(r.score).toBe(85)
  })

  it('floors score at 0', () => {
    const r = computeTrustScore({
      deductions: (Object.keys(CATEGORY_CAPS) as Array<keyof typeof CATEGORY_CAPS>).map((c) => ({
        category: c,
        raw: 999,
      })),
    })
    expect(r.score).toBe(0)
    expect(r.status).toBe('non-compliant')
  })

  it('classifies at-risk between 60 and 84', () => {
    const r = computeTrustScore({ deductions: [{ category: 'incidents', raw: 25 }] })
    expect(r.score).toBe(75)
    expect(r.status).toBe('at-risk')
  })

  it('classifies non-compliant when score < 60', () => {
    const r = computeTrustScore({
      deductions: [
        { category: 'incidents', raw: 35 },
        { category: 'governance', raw: 10 },
      ],
    })
    expect(r.score).toBe(55)
    expect(r.status).toBe('non-compliant')
  })

  it('blocking risks force at-risk even when score >= 85', () => {
    const r = computeTrustScore({ deductions: [], hasBlockingRisks: true })
    expect(r.score).toBe(100)
    expect(r.status).toBe('at-risk')
  })

  it('ignores negative raw deductions', () => {
    const r = computeTrustScore({ deductions: [{ category: 'data', raw: -50 }] })
    expect(r.perCategory.data).toBe(0)
    expect(r.score).toBe(100)
  })
})
