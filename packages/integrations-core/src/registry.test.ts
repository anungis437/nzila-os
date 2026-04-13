import { describe, it, expect, beforeEach } from 'vitest'
import { IntegrationRegistry } from './registry'
import { IntegrationEventTypes } from './events'
import {
  CreateIntegrationConfigSchema,
  UpdateIntegrationConfigSchema,
  SendMessageSchema,
  CreateWebhookSubscriptionSchema,
} from './schemas'
import * as barrel from './index'
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

describe('IntegrationEventTypes', () => {
  it('maps each key to the same literal value', () => {
    for (const [key, value] of Object.entries(IntegrationEventTypes)) {
      expect(value).toBe(key)
    }
  })

  it('contains unique event names', () => {
    const values = Object.values(IntegrationEventTypes)
    expect(new Set(values).size).toBe(values.length)
  })
})

describe('schemas', () => {
  it('CreateIntegrationConfigSchema applies metadata default', () => {
    const parsed = CreateIntegrationConfigSchema.parse({
      orgId: '00000000-0000-0000-0000-000000000001',
      type: 'email',
      provider: 'resend',
      credentialsRef: 'vault://creds/email',
    })

    expect(parsed.metadata).toEqual({})
  })

  it('CreateIntegrationConfigSchema rejects invalid uuid', () => {
    expect(() =>
      CreateIntegrationConfigSchema.parse({
        orgId: 'not-a-uuid',
        type: 'email',
        provider: 'resend',
        credentialsRef: 'vault://creds/email',
      }),
    ).toThrow()
  })

  it('UpdateIntegrationConfigSchema accepts partial updates and rejects empty credentialsRef', () => {
    expect(UpdateIntegrationConfigSchema.parse({ status: 'active' })).toEqual({ status: 'active' })
    expect(() => UpdateIntegrationConfigSchema.parse({ credentialsRef: '' })).toThrow()
  })

  it('SendMessageSchema validates required fields and optional payload', () => {
    const ok = SendMessageSchema.parse({
      orgId: '00000000-0000-0000-0000-000000000001',
      channel: 'email',
      to: 'user@example.com',
      correlationId: '00000000-0000-0000-0000-000000000002',
      variables: { total: 100 },
    })

    expect(ok.variables).toEqual({ total: 100 })
    expect(() =>
      SendMessageSchema.parse({
        orgId: '00000000-0000-0000-0000-000000000001',
        channel: 'email',
        to: '',
        correlationId: '00000000-0000-0000-0000-000000000002',
      }),
    ).toThrow()
  })

  it('CreateWebhookSubscriptionSchema validates url, events min, and secret length', () => {
    const parsed = CreateWebhookSubscriptionSchema.parse({
      orgId: '00000000-0000-0000-0000-000000000001',
      url: 'https://example.com/webhook',
      events: ['integration.delivery.sent'],
      secret: '1234567890abcdef',
    })

    expect(parsed.events).toHaveLength(1)

    expect(() =>
      CreateWebhookSubscriptionSchema.parse({
        orgId: '00000000-0000-0000-0000-000000000001',
        url: 'notaurl',
        events: [],
        secret: 'short',
      }),
    ).toThrow()
  })
})

describe('barrel exports', () => {
  it('exposes runtime symbols from index', () => {
    expect(barrel.IntegrationRegistry).toBeTypeOf('function')
    expect(barrel.IntegrationEventTypes['integration.delivery.sent']).toBe('integration.delivery.sent')
    expect(barrel.CreateIntegrationConfigSchema).toBeTruthy()
  })
})
