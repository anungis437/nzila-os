import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  selectCall: 0,
  recentDailyScores: [] as Array<{ date: string; isAnomaly: boolean; score: number; modelKey: string }>,
  txnRows: [] as Array<{ count: number }>,
  dailyRows: [] as Array<{ count: number }>,
}))

vi.mock('@nzila/db/schema', () => ({
  mlScoresStripeDaily: {
    date: 'daily.date',
    isAnomaly: 'daily.isAnomaly',
    score: 'daily.score',
    orgId: 'daily.orgId',
    modelId: 'daily.modelId',
  },
  mlScoresStripeTxn: {
    orgId: 'txn.orgId',
    isAnomaly: 'txn.isAnomaly',
  },
  mlModels: {
    id: 'models.id',
    modelKey: 'models.modelKey',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
  and: vi.fn((...parts) => ({ op: 'and', parts })),
  desc: vi.fn((value) => ({ op: 'desc', value })),
  gte: vi.fn((left, right) => ({ op: 'gte', left, right })),
  count: vi.fn(() => ({ op: 'count' })),
}))

vi.mock('@nzila/db', () => ({
  db: {
    select: vi.fn(() => {
      state.selectCall += 1
      const call = state.selectCall

      const query = {
        from: vi.fn(() => query),
        innerJoin: vi.fn(() => query),
        where: vi.fn(() => {
          if (call === 1) {
            return query
          }
          if (call === 2) {
            return Promise.resolve(state.txnRows)
          }
          return Promise.resolve(state.dailyRows)
        }),
        orderBy: vi.fn(() => query),
        limit: vi.fn(() => Promise.resolve(state.recentDailyScores)),
      }

      return query
    }),
  },
}))

import { getPartnerMlSummary } from './server'

describe('getPartnerMlSummary', () => {
  beforeEach(() => {
    state.selectCall = 0
    state.recentDailyScores = [
      { date: '2026-04-01', isAnomaly: true, score: 0.93, modelKey: 'stripe-v1' },
      { date: '2026-04-02', isAnomaly: false, score: 0.11, modelKey: 'stripe-v1' },
    ]
    state.txnRows = [{ count: 5 }]
    state.dailyRows = [{ count: 2 }]
  })

  it('returns aggregated summary and normalizes score to string', async () => {
    const result = await getPartnerMlSummary('org-123')

    expect(result.orgId).toBe('org-123')
    expect(result.daysScored).toBe(2)
    expect(result.recentAnomalyDays).toBe(1)
    expect(result.totalTxnAnomalies).toBe(5)
    expect(result.totalDailyAnomalies).toBe(2)
    expect(result.recentDailyScores[0]?.score).toBe('0.93')
  })

  it('falls back to zero anomaly totals when count queries return no rows', async () => {
    state.txnRows = []
    state.dailyRows = []

    const result = await getPartnerMlSummary('org-456')

    expect(result.totalTxnAnomalies).toBe(0)
    expect(result.totalDailyAnomalies).toBe(0)
    expect(result.daysScored).toBe(2)
  })
})
