import { describe, it, expect } from 'vitest'
import { rank, rankCompare, explainTopFactors, DEFAULT_WEIGHTS } from './rank'

describe('rank', () => {
  it('produces higher score for high-value urgent reversible items', () => {
    const urgent = rank({
      estimatedValueCad: 100_000,
      urgency: 1,
      confidence: 0.9,
      effort: 0.2,
      reversibility: 1,
      founderUniqueness: 0.2,
      downsideIfIgnored: 0.8,
      strategicLeverage: 0.7,
    })
    const lowPriority = rank({
      estimatedValueCad: 500,
      urgency: 0.1,
      confidence: 0.4,
      effort: 0.8,
      reversibility: 0.2,
      founderUniqueness: 0.9,
      downsideIfIgnored: 0.1,
      strategicLeverage: 0.1,
    })
    expect(urgent.score).toBeGreaterThan(lowPriority.score)
    expect(urgent.bucket === 'now' || urgent.bucket === 'today').toBe(true)
    expect(lowPriority.bucket === 'backlog' || lowPriority.bucket === 'this_month').toBe(true)
  })

  it('penalizes high effort + high founder dependence', () => {
    const lowEffort = rank({
      estimatedValueCad: 10_000,
      urgency: 0.5,
      confidence: 0.8,
      effort: 0.1,
      reversibility: 0.8,
      founderUniqueness: 0.1,
      downsideIfIgnored: 0.3,
    })
    const sameButExpensive = rank({
      estimatedValueCad: 10_000,
      urgency: 0.5,
      confidence: 0.8,
      effort: 0.9,
      reversibility: 0.8,
      founderUniqueness: 0.9,
      downsideIfIgnored: 0.3,
    })
    expect(lowEffort.score).toBeGreaterThan(sameButExpensive.score)
  })

  it('is deterministic: identical inputs yield identical outputs', () => {
    const inputs = {
      estimatedValueCad: 5_000,
      urgency: 0.5,
      confidence: 0.5,
      effort: 0.5,
      reversibility: 0.5,
      founderUniqueness: 0.5,
      downsideIfIgnored: 0.5,
    }
    expect(rank(inputs)).toEqual(rank(inputs))
  })

  it('handles zero value without blowing up', () => {
    const r = rank({
      estimatedValueCad: 0,
      urgency: 0.9,
      confidence: 0.9,
      effort: 0.1,
      reversibility: 1,
      founderUniqueness: 0,
      downsideIfIgnored: 0.9,
    })
    expect(Number.isFinite(r.score)).toBe(true)
    expect(r.explanation.some((e) => e.factor === 'value')).toBe(false)
  })

  it('clamps out-of-range inputs instead of throwing', () => {
    const r = rank({
      estimatedValueCad: 1000,
      urgency: 1.5, // out of range
      confidence: -0.3, // out of range
      effort: 2,
      reversibility: -1,
      founderUniqueness: 99,
      downsideIfIgnored: 0.5,
    })
    expect(Number.isFinite(r.score)).toBe(true)
  })

  it('explanation is sorted by contribution magnitude, dropping near-zero noise', () => {
    const r = rank({
      estimatedValueCad: 1_000_000,
      urgency: 0.8,
      confidence: 0.9,
      effort: 0.3,
      reversibility: 0.7,
      founderUniqueness: 0.2,
      downsideIfIgnored: 0.6,
    })
    // Positive contributions should come before negative
    const firstPositiveIdx = r.explanation.findIndex((e) => e.contribution > 0)
    const firstNegativeIdx = r.explanation.findIndex((e) => e.contribution < 0)
    if (firstNegativeIdx !== -1) {
      expect(firstPositiveIdx).toBeLessThan(firstNegativeIdx)
    }
  })

  it('breaks ties by confidence then reversibility', () => {
    const a = { rank: rank({ estimatedValueCad: 100, urgency: 0.5, confidence: 0.9, effort: 0.5, reversibility: 0.5, founderUniqueness: 0.5, downsideIfIgnored: 0.5 }), confidence: 0.9, reversibility: 0.5 }
    const b = { rank: { ...a.rank }, confidence: 0.5, reversibility: 0.9 }
    const sorted = [b, a].sort(rankCompare)
    expect(sorted[0]).toBe(a)
  })

  it('bucket monotonicity: a strictly better item is never in a lower bucket', () => {
    const better = rank({ estimatedValueCad: 50_000, urgency: 0.9, confidence: 0.9, effort: 0.1, reversibility: 0.9, founderUniqueness: 0.1, downsideIfIgnored: 0.9 })
    const worse = rank({ estimatedValueCad: 50_000, urgency: 0.2, confidence: 0.5, effort: 0.5, reversibility: 0.5, founderUniqueness: 0.5, downsideIfIgnored: 0.2 })
    const bucketOrder: Record<string, number> = { now: 5, today: 4, this_week: 3, this_month: 2, backlog: 1 }
    expect(bucketOrder[better.bucket]).toBeGreaterThanOrEqual(bucketOrder[worse.bucket])
  })

  it('custom weights shift outcomes', () => {
    const inputs = { estimatedValueCad: 10_000, urgency: 0.9, confidence: 0.5, effort: 0.5, reversibility: 0.5, founderUniqueness: 0.5, downsideIfIgnored: 0.5 }
    const base = rank(inputs)
    const urgencyHeavy = rank(inputs, { weights: { urgency: 0.9 } })
    expect(urgencyHeavy.score).toBeGreaterThan(base.score)
  })

  it('explainTopFactors returns a readable one-liner', () => {
    const r = rank({
      estimatedValueCad: 50_000,
      urgency: 0.8,
      confidence: 0.9,
      effort: 0.3,
      reversibility: 0.7,
      founderUniqueness: 0.2,
      downsideIfIgnored: 0.6,
    })
    const s = explainTopFactors(r, 3)
    expect(s).toContain('=')
    expect(s.split(', ').length).toBeLessThanOrEqual(3)
  })

  it('DEFAULT_WEIGHTS sum is near zero (balanced)', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((s, v) => s + v, 0)
    expect(Math.abs(sum)).toBeLessThan(1.1)
  })
})
