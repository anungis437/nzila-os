import { describe, expect, it, vi } from 'vitest'

const { mockRegisterHandler } = vi.hoisted(() => ({
  mockRegisterHandler: vi.fn(),
}))

vi.mock('@/lib/control/command-bus', () => ({
  registerHandler: mockRegisterHandler,
}))

vi.mock('@/lib/repositories', () => ({}))
vi.mock('@/lib/repositories/workflow-repository', () => ({}))

vi.mock('@/lib/control/guards/invariant-guard', () => ({}))
vi.mock('@/lib/control/guards/payment-guard', () => ({}))
vi.mock('@/lib/control/guards/production-guard', () => ({}))
vi.mock('@/lib/control/guards/shipment-guard', () => ({}))
vi.mock('@/lib/control/guards/workflow-guard', () => ({}))

vi.mock('@/lib/control/dispatch/audit-dispatcher', () => ({}))
vi.mock('@/lib/control/dispatch/event-dispatcher', () => ({}))
vi.mock('@/lib/control/dispatch/side-effect-dispatcher', () => ({}))

vi.mock('@/domain/invariants', () => ({}))
vi.mock('@/domain/conversion-rules', () => ({}))
vi.mock('@/lib/services/shipment-service', () => ({}))

describe('Flow handler registration smoke', () => {
  it('loads register-handlers and registers every handler module', async () => {
    const mod = await import('@/lib/control/register-handlers')

    expect(Array.isArray(mod.handlers)).toBe(true)
    expect(mod.handlers.length).toBeGreaterThan(20)
    expect(mockRegisterHandler).toHaveBeenCalledTimes(mod.handlers.length)
  }, 30000)
})
