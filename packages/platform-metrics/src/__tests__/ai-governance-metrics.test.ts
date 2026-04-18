import { describe, expect, it } from 'vitest'
import { aggregateAiOperatingMetrics, type AiTelemetryRecord } from '../ai-governance-metrics'

const baseRows: AiTelemetryRecord[] = [
  {
    timestamp: '2026-04-18T08:05:00.000Z',
    appKey: 'union-eyes',
    orgId: 'org-a',
    endpoint: '/api/ai/summarize',
    modelUsed: 'gpt-4.1-mini',
    provider: 'azure-openai',
    status: 'approved',
    latencyMs: 920,
    tokenCostUsd: 0.11,
    tokensIn: 800,
    tokensOut: 260,
    retryCount: 0,
    timedOut: false,
    degradedMode: false,
    providerFailure: false,
    confidenceScore: 0.82,
    evidenceRefsCount: 2,
    reviewRequired: true,
    approved: true,
    overridden: false,
    conversionType: 'workflow',
    converted: true,
    queueName: 'ue-review',
    queueBacklog: 7,
  },
  {
    timestamp: '2026-04-18T08:35:00.000Z',
    appKey: 'union-eyes',
    orgId: 'org-a',
    endpoint: '/api/ai/search',
    modelUsed: 'gpt-4.1-mini',
    provider: 'azure-openai',
    status: 'rejected',
    latencyMs: 1430,
    tokenCostUsd: 0.2,
    tokensIn: 1200,
    tokensOut: 500,
    retryCount: 1,
    timedOut: true,
    degradedMode: true,
    providerFailure: true,
    errorClass: 'timeout',
    confidenceScore: 0.42,
    evidenceRefsCount: 0,
    reviewRequired: true,
    approved: false,
    overridden: true,
    conversionType: 'workflow',
    converted: false,
    queueName: 'ue-review',
    queueBacklog: 12,
  },
  {
    timestamp: '2026-04-18T11:00:00.000Z',
    appKey: 'cfo',
    orgId: 'org-b',
    endpoint: '/actions/advisor',
    modelUsed: 'gpt-4.1-mini',
    provider: 'azure-openai',
    status: 'success',
    latencyMs: 530,
    tokenCostUsd: 0.09,
    tokensIn: 640,
    tokensOut: 220,
    retryCount: 0,
    timedOut: false,
    degradedMode: false,
    providerFailure: false,
    confidenceScore: 0.76,
    evidenceRefsCount: 1,
    reviewRequired: false,
    conversionType: 'lead',
    converted: true,
    queueName: 'finance-review',
    queueBacklog: 2,
  },
]

describe('aggregateAiOperatingMetrics', () => {
  it('aggregates costs, latency, quality, and operations per app', () => {
    const result = aggregateAiOperatingMetrics(baseRows)

    expect(result.recordCount).toBe(3)
    expect(Object.keys(result.byApp).sort()).toEqual(['cfo', 'union-eyes'])

    expect(result.byApp['union-eyes']?.cost.tokenSpendUsd).toBe(0.31)
    expect(result.byApp['union-eyes']?.cost.costPerSuccessfulActionUsd).toBe(0.31)
    expect(result.byApp['union-eyes']?.performance.timeoutPct).toBe(50)
    expect(result.byApp['union-eyes']?.performance.retryPct).toBe(50)
    expect(result.byApp['union-eyes']?.quality.approvalRatePct).toBe(50)
    expect(result.byApp['union-eyes']?.quality.overrideRatePct).toBe(50)
    expect(result.byApp['union-eyes']?.quality.rejectionRatePct).toBe(50)
    expect(result.byApp['union-eyes']?.quality.confidenceDistribution).toEqual({ low: 1, medium: 0, high: 1 })
    expect(result.byApp['union-eyes']?.quality.evidenceAttachedPct).toBe(50)
    expect(result.byApp['union-eyes']?.operations.errorClasses['timeout']).toBe(1)
    expect(result.byApp['union-eyes']?.operations.queueBacklog['ue-review']).toBe(12)
    expect(result.byApp['union-eyes']?.operations.volumeByEndpoint['/api/ai/summarize']).toBe(1)
    expect(result.byApp['union-eyes']?.operations.volumeByEndpoint['/api/ai/search']).toBe(1)

    expect(result.byApp['cfo']?.cost.tokenSpendUsd).toBe(0.09)
    expect(result.byApp['cfo']?.cost.costPerConvertedLeadUsd).toBe(0.09)
    expect(result.byApp['cfo']?.quality.evidenceAttachedPct).toBe(100)
    expect(result.byApp['cfo']?.performance.p50LatencyMs).toBe(530)
    expect(result.byApp['cfo']?.operations.modelRoutingPct['azure-openai:gpt-4.1-mini']).toBe(100)
  })

  it('returns empty app map for empty input', () => {
    const result = aggregateAiOperatingMetrics([])
    expect(result.recordCount).toBe(0)
    expect(result.byApp).toEqual({})
  })
})
