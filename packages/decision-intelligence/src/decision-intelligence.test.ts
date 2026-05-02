import { describe, expect, it } from 'vitest'

import { aggregateDecisionRecords, anonymizeAggregates, buildDecisionBenchmarks, getBenchmark } from './index'
import type { DecisionAggregateInputRecord } from './types'
import {
  FRESHNESS_BREACH_THRESHOLD_MS,
  FRESHNESS_WARNING_THRESHOLD_MS,
  computeFreshnessLag,
  evaluateFreshnessSla,
} from './freshness'

const records: DecisionAggregateInputRecord[] = [
  {
    organizationId: 'org-1',
    decisionType: 'flow.quote.created',
    policyVersion: '1.0.0',
    createdAt: '2026-05-01T00:00:00.000Z',
    payload: {
      id: 'd1',
      organizationId: 'org-1',
      domain: 'commerce',
      resourceType: 'quote',
      resourceId: 'q1',
      actor: { id: 'u1', type: 'user', authorityScope: ['quote:create'] },
      input: { customerId: 'c1', title: 'Quote 1', decisionTimeMs: 500 },
      policy: { id: 'commerce.quote.approval', version: '1.0.0', domain: 'commerce' },
      outcome: { status: 'approved', explanationTrace: ['auto decision'] },
      createdAt: '2026-05-01T00:00:00.000Z',
    },
  },
  {
    organizationId: 'org-1',
    decisionType: 'flow.quote.created',
    policyVersion: '1.0.0',
    createdAt: '2026-05-01T01:00:00.000Z',
    payload: {
      id: 'd2',
      organizationId: 'org-1',
      domain: 'commerce',
      resourceType: 'quote',
      resourceId: 'q2',
      actor: { id: 'u2', type: 'user', authorityScope: ['quote:create'] },
      input: { customerId: 'c2', title: 'Quote 2', decisionTimeMs: 1500 },
      policy: { id: 'commerce.quote.approval', version: '1.0.0', domain: 'commerce' },
      outcome: { status: 'rejected', explanationTrace: ['manual override'] },
      proof: { previousHash: 'prev' },
      createdAt: '2026-05-01T01:00:00.000Z',
    },
  },
  {
    organizationId: 'org-2',
    decisionType: 'flow.quote.created',
    policyVersion: '1.0.0',
    createdAt: '2026-05-01T02:00:00.000Z',
    payload: {
      id: 'd3',
      organizationId: 'org-2',
      domain: 'commerce',
      resourceType: 'quote',
      resourceId: 'q3',
      actor: { id: 'api-1', type: 'api', authorityScope: ['quote:create'] },
      input: { customerId: 'c3', title: 'Quote 3', decisionTimeMs: 250 },
      policy: { id: 'commerce.quote.approval', version: '1.0.0', domain: 'commerce' },
      outcome: { status: 'approved', explanationTrace: ['automatic'] },
      createdAt: '2026-05-01T02:00:00.000Z',
    },
  },
]

describe('@nzila/decision-intelligence', () => {
  it('aggregates decision outcomes into analytics-ready structures', () => {
    const aggregates = aggregateDecisionRecords(records)
    const org1 = aggregates.find((entry) => entry.organizationId === 'org-1')

    expect(org1).toBeDefined()
    expect(org1?.metrics.total).toBe(2)
    expect(org1?.metrics.approvalRate).toBe(0.5)
    expect(org1?.behavior.overrideRate).toBe(0.5)
    expect(org1?.policy.effectivenessScore).toBeGreaterThanOrEqual(0)
  })

  it('anonymizes organization identifiers and buckets latency', () => {
    const [aggregate] = aggregateDecisionRecords(records)
    const [anonymized] = anonymizeAggregates([aggregate])

    expect(anonymized.organizationBucket).not.toBe('org-1')
    expect(anonymized.metrics.avgDecisionTimeMs).toBeGreaterThanOrEqual(1000)
  })

  it('builds stable cross-org benchmarks', () => {
    const aggregates = aggregateDecisionRecords(records)
    const benchmarks = buildDecisionBenchmarks(aggregates)
    const benchmark = getBenchmark(aggregates, { decisionType: 'flow.quote.created', domain: 'commerce' })

    expect(benchmarks.length).toBe(1)
    expect(benchmark?.sampleSize).toBe(2)
    expect(benchmark?.topQuartile).toBeGreaterThanOrEqual(benchmark?.bottomQuartile ?? 0)
  })
})

describe('computeFreshnessLag', () => {
  it('returns 0 when aggregate window end is ahead of latest audit record', () => {
    const latestAuditRecordAt = new Date('2026-06-01T00:00:00.000Z')
    const latestAggregateWindowEnd = new Date('2026-06-01T01:00:00.000Z')
    const { lagMs } = computeFreshnessLag({ latestAuditRecordAt, latestAggregateWindowEnd })
    expect(lagMs).toBe(0)
  })

  it('returns exact ms difference when audit record is newer than aggregate window', () => {
    const latestAggregateWindowEnd = new Date('2026-06-01T00:00:00.000Z')
    const latestAuditRecordAt = new Date('2026-06-01T00:30:00.000Z') // 30 min lag
    const { lagMs } = computeFreshnessLag({ latestAuditRecordAt, latestAggregateWindowEnd })
    expect(lagMs).toBe(30 * 60 * 1000)
  })

  it('returns 0 when dates are equal', () => {
    const ts = new Date('2026-06-01T00:00:00.000Z')
    const { lagMs } = computeFreshnessLag({ latestAuditRecordAt: ts, latestAggregateWindowEnd: ts })
    expect(lagMs).toBe(0)
  })
})

describe('evaluateFreshnessSla', () => {
  it('returns healthy when lag is 0', () => {
    const { status } = evaluateFreshnessSla({ lagMs: 0 })
    expect(status).toBe('healthy')
  })

  it('returns healthy when lag is just below the warning threshold', () => {
    const { status } = evaluateFreshnessSla({ lagMs: FRESHNESS_WARNING_THRESHOLD_MS - 1 })
    expect(status).toBe('healthy')
  })

  it('returns warning when lag equals the warning threshold', () => {
    const { status } = evaluateFreshnessSla({ lagMs: FRESHNESS_WARNING_THRESHOLD_MS })
    expect(status).toBe('warning')
  })

  it('returns warning when lag is between warning and breach thresholds', () => {
    const midpoint = (FRESHNESS_WARNING_THRESHOLD_MS + FRESHNESS_BREACH_THRESHOLD_MS) / 2
    const { status } = evaluateFreshnessSla({ lagMs: midpoint })
    expect(status).toBe('warning')
  })

  it('returns breached when lag equals the default breach threshold', () => {
    const { status } = evaluateFreshnessSla({ lagMs: FRESHNESS_BREACH_THRESHOLD_MS })
    expect(status).toBe('breached')
  })

  it('returns breached when lag exceeds the default breach threshold', () => {
    const { status } = evaluateFreshnessSla({ lagMs: FRESHNESS_BREACH_THRESHOLD_MS + 1 })
    expect(status).toBe('breached')
  })

  it('respects a custom thresholdMs override', () => {
    const customThreshold = 3 * 60 * 60 * 1000 // 3 hours — above the 1hr warning threshold
    // Just below custom breach → warning (lag >= 1hr warning, < 3hr breach)
    expect(evaluateFreshnessSla({ lagMs: customThreshold - 1, thresholdMs: customThreshold }).status).toBe('warning')
    // At custom breach → breached
    expect(evaluateFreshnessSla({ lagMs: customThreshold, thresholdMs: customThreshold }).status).toBe('breached')
  })
})