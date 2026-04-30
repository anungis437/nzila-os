import { describe, expect, it } from 'vitest'
import {
  diffAllocation,
  simulateCapitalInjection,
  simulateFounderTimeReallocation,
} from './allocation-2'
import { computeAllocation, type AllocationEngineInput } from './allocation-engine'
import type { Venture, DependencyScore, Opportunity } from './types'

const NOW = '2026-04-28T12:00:00.000Z'

const v = (slug: string, mrr: number, pipe: number): Venture => ({
  id: `v-${slug}`,
  slug,
  name: slug,
  mission: 'm',
  icp: 'i',
  ownerUserId: 'u-1',
  secondOwnerUserId: 'u-2',
  stage: 'scaling',
  monthlyRecurringRevenueCents: mrr,
  pipelineValueCents: pipe,
  weightedPipelineCents: Math.round(pipe * 0.4),
  pilotsLive: 1,
  blockers: [],
  next30Days: [],
  confidence: 'medium',
  consoleAppId: null,
  externalLinks: {},
  createdAt: NOW,
  updatedAt: NOW,
})

const dep = (slug: string, score: number): DependencyScore => ({
  ventureSlug: slug,
  score,
  signal: score >= 70 ? 'red' : score >= 40 ? 'amber' : 'green',
  reasons: [],
  computedAt: NOW,
})

const opps: Opportunity[] = []

const baseInput: AllocationEngineInput = {
  now: NOW,
  ventures: [v('alpha', 800_000_00, 400_000_00), v('beta', 100_000_00, 50_000_00)],
  opportunities: opps,
  dependencyScores: [dep('alpha', 30), dep('beta', 80)],
}

describe('diffAllocation', () => {
  it('flags recommendation changes', () => {
    const before = computeAllocation(baseInput)
    const stronger = {
      ...baseInput,
      ventures: baseInput.ventures.map((vt) =>
        vt.slug === 'beta'
          ? { ...vt, monthlyRecurringRevenueCents: 1_500_000_00, weightedPipelineCents: 2_000_000_00 }
          : vt,
      ),
      dependencyScores: baseInput.dependencyScores.map((d) =>
        d.ventureSlug === 'beta' ? { ...d, score: 25, signal: 'green' as const } : d,
      ),
    }
    const after = computeAllocation(stronger)
    const delta = diffAllocation(before, after)
    const beta = delta.find((d) => d.ventureSlug === 'beta')!
    expect(beta.recommendationChanged).toBe(true)
    expect(beta.compositeDelta).not.toBeNull()
    expect(beta.compositeDelta!).toBeGreaterThan(0)
  })

  it('handles missing previous gracefully (new tracking)', () => {
    const after = computeAllocation(baseInput)
    const delta = diffAllocation(null, after)
    expect(delta.every((d) => d.compositeBefore === null)).toBe(true)
    expect(delta[0].headline).toContain('New tracking')
  })
})

describe('simulateCapitalInjection', () => {
  it('improves composite when MRR is added', () => {
    const result = simulateCapitalInjection(baseInput, {
      ventureSlug: 'beta',
      addedMrrCents: 500_000_00,
    })
    const beta = result.delta.find((d) => d.ventureSlug === 'beta')!
    expect(beta.compositeDelta!).toBeGreaterThan(0)
  })
})

describe('simulateFounderTimeReallocation', () => {
  it('moves time from highly-dependent to low-dependent venture and reflects net gain', () => {
    // beta has high dependency (80). Move founder time AWAY from beta TO alpha.
    // beta's founder-load axis improves; alpha's degrades a bit (60% absorption).
    const result = simulateFounderTimeReallocation(baseInput, {
      fromVentureSlug: 'beta',
      toVentureSlug: 'alpha',
      pointsTransferred: 30,
    })
    const beta = result.delta.find((d) => d.ventureSlug === 'beta')!
    const alpha = result.delta.find((d) => d.ventureSlug === 'alpha')!
    expect(beta.compositeDelta!).toBeGreaterThan(0)
    expect(alpha.compositeDelta!).toBeLessThan(0)
    // Net should still be positive — that's the whole point of the move.
    expect(result.netCompositeDelta).toBeGreaterThan(0)
  })
})
