import { describe, it, expect, beforeEach } from 'vitest'
import { IntegrationRegistry } from './registry'
import type { IntegrationAdapter, SendRequest, HealthCheckResult } from './types'

function makeAdapter(
  provider: IntegrationAdapter['provider'],
  channel: IntegrationAdapter['channel'],
): IntegrationAdapter {
  return {
    provider,
    channel,
    send: async (_req: SendRequest) => ({ ok: true, providerMessageId: 'msg-1' }),
    healthCheck: async () =>
      ({
        provider,
        status: 'ok',
        latencyMs: 42,
        details: null,
        checkedAt: new Date().toISOString(),
      }) satisfies HealthCheckResult,
  }
}

describe('IntegrationRegistry', () => {
  let registry: IntegrationRegistry

  beforeEach(() => {
    registry = new IntegrationRegistry()
  })

  it('registers and retrieves an adapter', () => {
    const adapter = makeAdapter('resend', 'email')
    registry.register(adapter)
    expect(registry.get('resend', 'email')).toBe(adapter)
  })

  it('throws on duplicate registration', () => {
    registry.register(makeAdapter('resend', 'email'))
    expect(() => registry.register(makeAdapter('resend', 'email'))).toThrow(
      'Adapter already registered for resend:email',
    )
  })

  it('getOrThrow throws when adapter missing', () => {
    expect(() => registry.getOrThrow('twilio', 'sms')).toThrow(
      'No adapter registered for twilio:sms',
    )
  })

  it('has returns correct boolean', () => {
    expect(registry.has('resend', 'email')).toBe(false)
    registry.register(makeAdapter('resend', 'email'))
    expect(registry.has('resend', 'email')).toBe(true)
  })

  it('listProviders returns unique providers', () => {
    registry.register(makeAdapter('resend', 'email'))
    registry.register(makeAdapter('twilio', 'sms'))
    registry.register(makeAdapter('sendgrid', 'email'))
    const providers = registry.listProviders()
    expect(providers).toHaveLength(3)
    expect(new Set(providers)).toEqual(new Set(['resend', 'twilio', 'sendgrid']))
  })

  it('listAdapters returns all registered adapters', () => {
    registry.register(makeAdapter('resend', 'email'))
    registry.register(makeAdapter('twilio', 'sms'))
    expect(registry.listAdapters()).toHaveLength(2)
  })

  it('clear removes all adapters', () => {
    registry.register(makeAdapter('resend', 'email'))
    registry.clear()
    expect(registry.listAdapters()).toHaveLength(0)
  })
})
