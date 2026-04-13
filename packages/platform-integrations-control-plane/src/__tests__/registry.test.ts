/**
 * Provider Registry — Unit Tests
 */
import { describe, it, expect, vi } from 'vitest'
import { ProviderRegistry, type RegistryPorts } from '../registry'

function makePorts(overrides: Partial<RegistryPorts> = {}): RegistryPorts {
  return {
    listProviders: vi.fn(async () => ['slack', 'stripe', 'hubspot']),
    getCircuitState: vi.fn(async () => 'closed' as const),
    getDeliveryStats: vi.fn(async () => ({
      total: 100,
      succeeded: 95,
      failed: 5,
      avgLatencyMs: 120,
    })),
    ...overrides,
  }
}

describe('ProviderRegistry', () => {
  it('returns health for all providers', async () => {
    const registry = new ProviderRegistry(makePorts())
    const health = await registry.getProviderHealth('org-123')

    expect(health).toHaveLength(3)
    expect(health[0].provider).toBe('slack')
    expect(health[0].status).toBe('healthy')
    expect(health[0].successRate).toBe(95)
    expect(health[0].avgLatencyMs).toBe(120)
  })

  it('marks provider as degraded when circuit is half-open', async () => {
    const ports = makePorts({
      getCircuitState: vi.fn(async () => 'half-open' as const),
    })
    const registry = new ProviderRegistry(ports)
    const health = await registry.getProviderHealth('org-123')

    expect(health[0].status).toBe('degraded')
  })

  it('marks provider as down when circuit is open', async () => {
    const ports = makePorts({
      getCircuitState: vi.fn(async () => 'open' as const),
    })
    const registry = new ProviderRegistry(ports)
    const health = await registry.getProviderHealth('org-123')

    expect(health[0].status).toBe('down')
  })

  it('marks provider as degraded when success rate < 90%', async () => {
    const ports = makePorts({
      getDeliveryStats: vi.fn(async () => ({
        total: 100,
        succeeded: 80,
        failed: 20,
        avgLatencyMs: 200,
      })),
    })
    const registry = new ProviderRegistry(ports)
    const health = await registry.getProviderHealth('org-123')

    expect(health[0].status).toBe('degraded')
    expect(health[0].successRate).toBe(80)
  })

  it('treats zero total deliveries as 100% success', async () => {
    const ports = makePorts({
      getDeliveryStats: vi.fn(async () => ({
        total: 0,
        succeeded: 0,
        failed: 0,
        avgLatencyMs: 0,
      })),
    })
    const registry = new ProviderRegistry(ports)
    const health = await registry.getProviderHealth('org-123')

    expect(health[0].status).toBe('healthy')
    expect(health[0].successRate).toBe(100)
    expect(health[0].totalDeliveries).toBe(0)
  })

  it('returns unknown status on error', async () => {
    const ports = makePorts({
      getCircuitState: vi.fn(async () => { throw new Error('connection failed') }),
    })
    const registry = new ProviderRegistry(ports)
    const health = await registry.getProviderHealth('org-123')

    expect(health[0].status).toBe('unknown')
  })

  it('returns unknown status on non-Error throw', async () => {
    const ports = makePorts({
      getCircuitState: vi.fn(async () => { throw 'registry panic' }),
    })
    const registry = new ProviderRegistry(ports)
    const health = await registry.getProviderHealth('org-123')

    expect(health[0].status).toBe('unknown')
    expect(health[0].totalDeliveries).toBe(0)
  })

  it('getProviderHealthSingle returns specific provider', async () => {
    const registry = new ProviderRegistry(makePorts())
    const health = await registry.getProviderHealthSingle('org-123', 'stripe')

    expect(health.provider).toBe('stripe')
    expect(health.status).toBe('healthy')
  })

  it('getProviderHealthSingle returns unknown for missing provider', async () => {
    const ports = makePorts({
      listProviders: vi.fn(async () => ['slack']),
    })
    const registry = new ProviderRegistry(ports)
    const health = await registry.getProviderHealthSingle('org-123', 'nonexistent')

    expect(health.status).toBe('unknown')
  })
})
