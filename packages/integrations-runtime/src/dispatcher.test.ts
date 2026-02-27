import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IntegrationDispatcher, type DispatcherPorts } from './dispatcher'
import type { SendRequest, IntegrationAdapter, SendResult } from '@nzila/integrations-core'

function makePorts(overrides?: Partial<DispatcherPorts>): DispatcherPorts {
  return {
    getAdapter: vi.fn().mockReturnValue({
      provider: 'resend',
      channel: 'email',
      send: vi.fn<(req: SendRequest, creds: Record<string, unknown>) => Promise<SendResult>>()
        .mockResolvedValue({ ok: true, providerMessageId: 'pm-1' }),
      healthCheck: vi.fn(),
    } satisfies IntegrationAdapter),
    getCredentials: vi.fn().mockResolvedValue({ apiKey: 'test' }),
    resolveConfig: vi.fn().mockResolvedValue({ id: 'cfg-1', provider: 'resend' as const }),
    recordDelivery: vi.fn().mockResolvedValue({ id: 'del-1' }),
    updateDeliveryStatus: vi.fn().mockResolvedValue(undefined),
    enqueueDlq: vi.fn().mockResolvedValue(undefined),
    emitAudit: vi.fn(),
    ...overrides,
  }
}

const baseRequest: SendRequest = {
  orgId: 'org-1',
  channel: 'email',
  to: 'test@example.com',
  subject: 'Hello',
  body: 'World',
  correlationId: 'corr-1',
}

describe('IntegrationDispatcher', () => {
  let ports: DispatcherPorts

  beforeEach(() => {
    ports = makePorts()
  })

  it('dispatches successfully and audits queued + sent', async () => {
    const dispatcher = new IntegrationDispatcher(ports, {
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitter: false },
    })
    const result = await dispatcher.dispatch(baseRequest)

    expect(result.ok).toBe(true)
    expect(result.providerMessageId).toBe('pm-1')

    // Audit: queued + sent
    expect(ports.emitAudit).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(ports.emitAudit).mock.calls
    expect(calls[0]?.[0]?.type).toBe('integration.delivery.queued')
    expect(calls[1]?.[0]?.type).toBe('integration.delivery.sent')
  })

  it('retries and lands in DLQ on persistent failure', async () => {
    const failAdapter: IntegrationAdapter = {
      provider: 'resend',
      channel: 'email',
      send: vi.fn().mockRejectedValue(new Error('provider error')),
      healthCheck: vi.fn(),
    }
    ports = makePorts({
      getAdapter: vi.fn().mockReturnValue(failAdapter),
    })

    const dispatcher = new IntegrationDispatcher(ports, {
      retry: { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50, jitter: false },
    })
    const result = await dispatcher.dispatch(baseRequest)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('provider error')
    expect(ports.enqueueDlq).toHaveBeenCalledTimes(1)

    const auditCalls = vi.mocked(ports.emitAudit).mock.calls
    const types = auditCalls.map((c) => c[0]?.type)
    expect(types).toContain('integration.delivery.queued')
    expect(types).toContain('integration.delivery.failed')
    expect(types).toContain('integration.delivery.dlq')
  })
})
