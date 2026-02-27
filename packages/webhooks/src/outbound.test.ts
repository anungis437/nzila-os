import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OutboundWebhookDispatcher, type OutboundWebhookPorts } from './outbound'
import type { WebhookSubscription } from './types'

const mockSub: WebhookSubscription = {
  id: 'sub-1',
  orgId: 'org-1',
  url: 'https://example.com/hook',
  events: ['order.created'],
  secret: 'test-secret-1234567890',
  active: true,
  createdBy: 'actor-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function makePorts(overrides?: Partial<OutboundWebhookPorts>): OutboundWebhookPorts {
  return {
    findSubscriptions: vi.fn().mockResolvedValue([mockSub]),
    recordAttempt: vi.fn().mockResolvedValue(undefined),
    emitAudit: vi.fn(),
    ...overrides,
  }
}

describe('OutboundWebhookDispatcher', () => {
  let ports: OutboundWebhookPorts

  beforeEach(() => {
    ports = makePorts()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('OK'),
    }))
  })

  it('delivers to matching subscriptions with HMAC signature', async () => {
    const dispatcher = new OutboundWebhookDispatcher(ports, { maxAttempts: 1, baseDelayMs: 0 })
    const result = await dispatcher.deliver('org-1', 'order.created', { id: '123' }, 'idem-1')

    expect(result.delivered).toBe(1)
    expect(result.failed).toBe(0)

    const fetchCall = vi.mocked(fetch).mock.calls[0]!
    expect(fetchCall[0]).toBe('https://example.com/hook')
    const headers = (fetchCall[1] as RequestInit).headers as Record<string, string>
    expect(headers['X-Nzila-Signature']).toMatch(/^sha256=[a-f0-9]+$/)
    expect(headers['X-Nzila-Event']).toBe('order.created')
    expect(headers['X-Nzila-Idempotency-Key']).toBe('idem-1')
  })

  it('retries on failure and records all attempts', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: vi.fn().mockResolvedValue('error') })
      .mockResolvedValueOnce({ ok: true, status: 200, text: vi.fn().mockResolvedValue('OK') }),
    )

    const dispatcher = new OutboundWebhookDispatcher(ports, { maxAttempts: 3, baseDelayMs: 10 })
    const result = await dispatcher.deliver('org-1', 'order.created', {}, 'idem-2')

    expect(result.delivered).toBe(1)
    expect(ports.recordAttempt).toHaveBeenCalledTimes(2)
  })

  it('emits failed audit after all attempts exhausted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, text: vi.fn().mockResolvedValue('down'),
    }))

    const dispatcher = new OutboundWebhookDispatcher(ports, { maxAttempts: 2, baseDelayMs: 10 })
    const result = await dispatcher.deliver('org-1', 'order.created', {}, 'idem-3')

    expect(result.failed).toBe(1)
    const auditCalls = vi.mocked(ports.emitAudit).mock.calls
    expect(auditCalls.some((c) => c[0]?.type === 'integration.webhook.failed')).toBe(true)
  })

  it('returns 0/0 when no subscriptions match', async () => {
    ports = makePorts({ findSubscriptions: vi.fn().mockResolvedValue([]) })
    const dispatcher = new OutboundWebhookDispatcher(ports)
    const result = await dispatcher.deliver('org-1', 'unknown.event', {}, 'idem-4')

    expect(result.delivered).toBe(0)
    expect(result.failed).toBe(0)
  })
})
