import { describe, expect, it } from 'vitest'
import { buildContext, mergeContexts } from './context'
import {
  classifyCorrelationStrength,
  detectCrossDomainCorrelations,
  pearsonCorrelation,
} from './correlation'

describe('intelligence core behavior', () => {
  it('builds context defaults and carries request metadata', () => {
    const ctx = buildContext({
      orgId: 'org-1',
      app: 'cfo',
      useCase: 'cash-forecast',
      input: {},
    })

    expect(ctx.locale).toBe('en')
    expect(ctx.environment).toBe('production')
    expect(ctx.dataClass).toBe('internal')
    expect(ctx.metadata?.orgId).toBe('org-1')
    expect(ctx.metadata?.app).toBe('cfo')
    expect(ctx.metadata?.useCase).toBe('cash-forecast')
    expect(typeof ctx.correlationId).toBe('string')
  })

  it('merges contexts with override precedence', () => {
    const merged = mergeContexts(
      {
        actorId: 'u1',
        locale: 'en',
        environment: 'staging',
        correlationId: 'base-corr',
        dataClass: 'internal',
        metadata: { source: 'base', team: 'ops' },
      },
      {
        locale: 'fr',
        metadata: { team: 'finance', flow: 'manual' },
      },
    )

    expect(merged.locale).toBe('fr')
    expect(merged.environment).toBe('staging')
    expect(merged.metadata).toEqual({ source: 'base', team: 'finance', flow: 'manual' })
  })

  it('computes and classifies correlation strength', () => {
    const coefficient = pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])
    expect(coefficient).toBeGreaterThan(0.99)
    expect(classifyCorrelationStrength(coefficient)).toBe('very_strong')
  })

  it('detects cross-domain correlations over overlapping day buckets', () => {
    const signals = [
      { app: 'cfo', metric: 'cash_burn', value: 10, timestamp: '2026-01-01T08:00:00.000Z' },
      { app: 'cfo', metric: 'cash_burn', value: 20, timestamp: '2026-01-02T08:00:00.000Z' },
      { app: 'cfo', metric: 'cash_burn', value: 30, timestamp: '2026-01-03T08:00:00.000Z' },
      { app: 'cfo', metric: 'cash_burn', value: 40, timestamp: '2026-01-04T08:00:00.000Z' },
      { app: 'cfo', metric: 'cash_burn', value: 50, timestamp: '2026-01-05T08:00:00.000Z' },
      { app: 'flow', metric: 'ticket_volume', value: 100, timestamp: '2026-01-01T09:00:00.000Z' },
      { app: 'flow', metric: 'ticket_volume', value: 200, timestamp: '2026-01-02T09:00:00.000Z' },
      { app: 'flow', metric: 'ticket_volume', value: 300, timestamp: '2026-01-03T09:00:00.000Z' },
      { app: 'flow', metric: 'ticket_volume', value: 400, timestamp: '2026-01-04T09:00:00.000Z' },
      { app: 'flow', metric: 'ticket_volume', value: 500, timestamp: '2026-01-05T09:00:00.000Z' },
    ]

    const correlations = detectCrossDomainCorrelations({ signals })
    expect(correlations.length).toBe(1)
    expect(correlations[0].strength).toBe('very_strong')
    expect(correlations[0].direction).toBe('positive')
    expect(correlations[0].sampleSize).toBe(5)
  })
})
