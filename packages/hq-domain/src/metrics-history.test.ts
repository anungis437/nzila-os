import { describe, expect, it } from 'vitest'
import {
  deltaPct,
  seriesOf,
  synthesizeHistory,
  windowDays,
  type HistoryInput,
} from './metrics-history'
import type { Venture, DependencyScore, PortfolioSnapshot, FinanceSnapshot, Task } from './types'

const NOW = '2026-04-28T12:00:00.000Z'

const venture = (slug: string, mrr: number): Venture => ({
  id: `v-${slug}`,
  slug,
  name: slug,
  mission: 'm',
  icp: 'i',
  ownerUserId: 'u-1',
  secondOwnerUserId: 'u-2',
  stage: 'scaling',
  monthlyRecurringRevenueCents: mrr,
  pipelineValueCents: 0,
  weightedPipelineCents: 0,
  pilotsLive: 0,
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

const portfolio: PortfolioSnapshot = {
  activeVentures: 2,
  totalMrrCents: 300_00,
  totalPipelineCents: 0,
  weightedPipelineCents: 200_00,
  pilotsLive: 1,
  strategicAlerts: 0,
  founderBottleneckScore: 55,
  founderBottleneckSignal: 'amber',
}

const finance: FinanceSnapshot = {
  totalMrrCents: 300_00,
  arrRunRateCents: 3600_00,
  pipelineValueCents: 0,
  weightedPipelineCents: 200_00,
  cacProxyCents: null,
  paybackMonths: null,
  cashRunwayMonths: 12,
  topVentureRevenueShare: 0.6,
  marginByVentureCents: {},
}

const tasks: Task[] = []

function input(window: '30d' | '90d' | '12m'): HistoryInput {
  return {
    now: NOW,
    window,
    ventures: [venture('alpha', 200_00), venture('beta', 100_00)],
    tasks,
    dependencyScores: [dep('alpha', 55), dep('beta', 30)],
    portfolio,
    finance,
  }
}

describe('synthesizeHistory', () => {
  it('emits one daily snapshot for 30d window', () => {
    const series = synthesizeHistory(input('30d'))
    expect(series.length).toBe(31)
    expect(series[0].capturedAt < series[series.length - 1].capturedAt).toBe(true)
  })

  it('uses weekly granularity for 12m window', () => {
    const series = synthesizeHistory(input('12m'))
    // 365 days, step 7 → ~53 points
    expect(series.length).toBeGreaterThan(40)
    expect(series.length).toBeLessThan(60)
  })

  it('is deterministic for the same input', () => {
    const a = synthesizeHistory(input('30d'))
    const b = synthesizeHistory(input('30d'))
    expect(a).toEqual(b)
  })

  it('most-recent snapshot anchors on live values within tolerance', () => {
    const series = synthesizeHistory(input('30d'))
    const last = series[series.length - 1]
    // last point at d=0 should be very close to live MRR (within noise)
    const liveMrr = 300_00
    expect(Math.abs(last.totalMrrCents - liveMrr) / liveMrr).toBeLessThan(0.1)
  })

  it('seriesOf + deltaPct produce a numeric percentage delta', () => {
    const series = synthesizeHistory(input('30d'))
    const mrr = seriesOf(series, 'totalMrrCents')
    const d = deltaPct(mrr)
    expect(d).not.toBeNull()
    expect(Number.isFinite(d!)).toBe(true)
  })

  it('windowDays returns expected mappings', () => {
    expect(windowDays('30d')).toBe(30)
    expect(windowDays('90d')).toBe(90)
    expect(windowDays('12m')).toBe(365)
  })
})
