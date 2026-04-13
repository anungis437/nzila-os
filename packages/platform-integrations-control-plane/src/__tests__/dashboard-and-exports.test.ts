/**
 * Dashboard + Exports — Unit Tests
 */
import { describe, it, expect } from 'vitest'
import {
  buildDashboardSummary,
  webhookPayloadSchema,
  dlqReplayRequestSchema,
  rateLimitConfigSchema,
  ProviderRegistry,
  DlqManager,
} from '../index'

describe('buildDashboardSummary', () => {
  it('aggregates provider health and rounds metrics', async () => {
    const registry = {
      getProviderHealth: async () => [
        {
          provider: 'slack',
          status: 'healthy',
          circuitState: 'closed',
          successRate: 100,
          avgLatencyMs: 50,
          lastCheckedAt: new Date().toISOString(),
          consecutiveFailures: 0,
          totalDeliveries: 20,
          totalFailures: 0,
        },
        {
          provider: 'stripe',
          status: 'degraded',
          circuitState: 'half-open',
          successRate: 75,
          avgLatencyMs: 99,
          lastCheckedAt: new Date().toISOString(),
          consecutiveFailures: 2,
          totalDeliveries: 40,
          totalFailures: 10,
        },
        {
          provider: 'hubspot',
          status: 'down',
          circuitState: 'open',
          successRate: 0,
          avgLatencyMs: 151,
          lastCheckedAt: new Date().toISOString(),
          consecutiveFailures: 3,
          totalDeliveries: 10,
          totalFailures: 10,
        },
      ],
    } as unknown as ProviderRegistry

    const dlq = {
      depth: async () => 7,
    } as unknown as DlqManager

    const summary = await buildDashboardSummary({ registry, dlq }, 'org-1')

    expect(summary.totalProviders).toBe(3)
    expect(summary.healthyProviders).toBe(1)
    expect(summary.degradedProviders).toBe(1)
    expect(summary.downProviders).toBe(1)
    expect(summary.totalDeliveries24h).toBe(70)
    expect(summary.successRate24h).toBe(71.43)
    expect(summary.avgLatencyMs24h).toBe(100)
    expect(summary.dlqDepth).toBe(7)
  })

  it('returns defaults when provider list is empty', async () => {
    const registry = {
      getProviderHealth: async () => [],
    } as unknown as ProviderRegistry

    const dlq = {
      depth: async () => 0,
    } as unknown as DlqManager

    const summary = await buildDashboardSummary({ registry, dlq }, 'org-1')

    expect(summary.totalProviders).toBe(0)
    expect(summary.successRate24h).toBe(100)
    expect(summary.avgLatencyMs24h).toBe(0)
  })
})

describe('barrel exports', () => {
  it('exports constructors and zod schemas', () => {
    expect(ProviderRegistry).toBeTypeOf('function')
    expect(DlqManager).toBeTypeOf('function')

    expect(webhookPayloadSchema.parse({
      body: '{}',
      signature: 'sig',
      provider: 'test',
    }).provider).toBe('test')

    expect(() => dlqReplayRequestSchema.parse({ entryIds: [] })).toThrow()

    expect(() => rateLimitConfigSchema.parse({
      orgId: '550e8400-e29b-41d4-a716-446655440000',
      provider: 'slack',
      maxRequestsPerMinute: 10,
      maxRequestsPerHour: 100,
      burstLimit: 1001,
    })).toThrow()
  })
})
