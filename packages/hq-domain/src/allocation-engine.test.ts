import { describe, expect, it } from 'vitest'
import {
  computeAllocation,
  summarizeAllocation,
  type AllocationEngineInput,
} from './allocation-engine'
import type { DependencyScore, Opportunity, Venture } from './types'

const NOW = '2026-04-28T12:00:00.000Z'

function makeVenture(overrides: Partial<Venture> = {}): Venture {
  const base: Venture = {
    id: 'v-1',
    slug: 'demo',
    name: 'Demo',
    mission: 'm',
    icp: 'i',
    ownerUserId: 'u-1',
    secondOwnerUserId: 'u-2',
    stage: 'go-to-market',
    monthlyRecurringRevenueCents: 250_000_00,
    pipelineValueCents: 1_000_000_00,
    weightedPipelineCents: 600_000_00,
    pilotsLive: 2,
    blockers: [],
    next30Days: [],
    confidence: 'high',
    consoleAppId: null,
    externalLinks: {},
    createdAt: NOW,
    updatedAt: NOW,
  }
  return { ...base, ...overrides }
}

function makeDep(slug: string, score: number): DependencyScore {
  return {
    ventureSlug: slug,
    score,
    signal: score >= 70 ? 'red' : score >= 40 ? 'amber' : 'green',
    reasons: [],
    computedAt: NOW,
  }
}

const NO_OPPS: Opportunity[] = []

describe('allocation-engine', () => {
  it('returns one score per venture, sorted by composite descending', () => {
    const input: AllocationEngineInput = {
      now: NOW,
      ventures: [
        makeVenture({ slug: 'weak', monthlyRecurringRevenueCents: 0, confidence: 'low' }),
        makeVenture({ slug: 'strong' }),
      ],
      opportunities: NO_OPPS,
      dependencyScores: [makeDep('weak', 90), makeDep('strong', 20)],
    }
    const out = computeAllocation(input)
    expect(out).toHaveLength(2)
    expect(out[0].ventureSlug).toBe('strong')
    expect(out[1].ventureSlug).toBe('weak')
    expect(out[0].composite).toBeGreaterThan(out[1].composite)
  })

  it('recommends "invest-more" for a high-traction venture with low founder load', () => {
    const input: AllocationEngineInput = {
      now: NOW,
      ventures: [
        makeVenture({
          slug: 'rocket',
          stage: 'scaling',
          monthlyRecurringRevenueCents: 1_400_000_00,
          weightedPipelineCents: 20_000_000_00,
          confidence: 'high',
        }),
      ],
      opportunities: NO_OPPS,
      dependencyScores: [makeDep('rocket', 15)],
      strategicPriority: { rocket: 0.95 },
    }
    const [score] = computeAllocation(input)
    expect(score.recommendation).toBe('invest-more')
    expect(score.signal).toBe('green')
  })

  it('recommends "exit" for sunset stage regardless of other inputs', () => {
    const input: AllocationEngineInput = {
      now: NOW,
      ventures: [
        makeVenture({
          slug: 'wind-down',
          stage: 'sunset',
          monthlyRecurringRevenueCents: 5_000_000_00,
        }),
      ],
      opportunities: NO_OPPS,
      dependencyScores: [makeDep('wind-down', 10)],
    }
    const [score] = computeAllocation(input)
    expect(score.recommendation).toBe('exit')
  })

  it('flags founder dependency in the reasons when score is high', () => {
    const input: AllocationEngineInput = {
      now: NOW,
      ventures: [makeVenture({ slug: 'depy' })],
      opportunities: NO_OPPS,
      dependencyScores: [makeDep('depy', 85)],
    }
    const [score] = computeAllocation(input)
    expect(score.reasons.some((r) => r.toLowerCase().includes('founder dependency'))).toBe(true)
    expect(score.axes.founderLoad.score).toBe(15) // 100 - 85
  })

  it('summarizeAllocation tallies recommendations and signals', () => {
    const input: AllocationEngineInput = {
      now: NOW,
      ventures: [
        makeVenture({ slug: 'a', stage: 'sunset' }),
        makeVenture({ slug: 'b', confidence: 'low', monthlyRecurringRevenueCents: 0 }),
        makeVenture({ slug: 'c' }),
      ],
      opportunities: NO_OPPS,
      dependencyScores: [makeDep('a', 30), makeDep('b', 80), makeDep('c', 25)],
    }
    const scores = computeAllocation(input)
    const summary = summarizeAllocation(scores)
    expect(summary.byRecommendation.exit).toBeGreaterThanOrEqual(1)
    expect(
      summary.greenCount + summary.amberCount + summary.redCount,
    ).toBe(scores.length)
    expect(summary.topVentureSlug).not.toBeNull()
    expect(summary.bottomVentureSlug).not.toBeNull()
  })

  it('handles empty input gracefully', () => {
    const summary = summarizeAllocation([])
    expect(summary.averageComposite).toBe(0)
    expect(summary.topVentureSlug).toBeNull()
  })
})
