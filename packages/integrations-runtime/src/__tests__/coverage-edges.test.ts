import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IntegrationAdapter, SendResult } from '@nzila/integrations-core'

const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

const telemetryMocks = vi.hoisted(() => {
  const telemetry = {
    providerRequest: vi.fn(),
    providerResponse: vi.fn(),
    syncCompleted: vi.fn(),
    retryInvoked: vi.fn(),
    auditEmitted: vi.fn(),
  }

  return {
    telemetry,
    integrationTelemetry: vi.fn(() => telemetry),
  }
})

vi.mock('node:fs', () => ({
  existsSync: fsMocks.existsSync,
  readFileSync: fsMocks.readFileSync,
}))

vi.mock('@nzila/platform-observability', () => ({
  integrationTelemetry: telemetryMocks.integrationTelemetry,
}))

import { checkAllIntegrations } from '../health'
import { getProviderPolicy, loadIntegrationPolicy, resetPolicyCache } from '../policy'
import { recordIntegrationTelemetry, recordSendTelemetry } from '../telemetry-bridge'
import * as runtime from '../index'

function makeAdapter(
  status: 'ok' | 'degraded' | 'down',
  overrides?: Partial<IntegrationAdapter>,
): IntegrationAdapter {
  return {
    provider: 'resend',
    channel: 'email',
    send: vi.fn<(request: unknown, creds: Record<string, unknown>) => Promise<SendResult>>(),
    healthCheck: vi.fn().mockResolvedValue({
      provider: 'resend',
      status,
      latencyMs: 42,
      checkedAt: '2026-03-01T00:00:00.000Z',
      details: null,
    }),
    ...overrides,
  }
}

describe('checkAllIntegrations', () => {
  it('returns ok when all adapters are healthy', async () => {
    const result = await checkAllIntegrations({
      listAdapters: () => [makeAdapter('ok')],
      getCredentials: vi.fn().mockResolvedValue({ apiKey: 'test' }),
    })

    expect(result.overall).toBe('ok')
    expect(result.results).toHaveLength(1)
  })

  it('returns degraded when any adapter is degraded but none are down', async () => {
    const result = await checkAllIntegrations({
      listAdapters: () => [makeAdapter('ok'), makeAdapter('degraded', { provider: 'slack', channel: 'chatops' })],
      getCredentials: vi.fn().mockResolvedValue({}),
    })

    expect(result.overall).toBe('degraded')
  })

  it('marks adapters as down when credential loading or health checks fail', async () => {
    const result = await checkAllIntegrations({
      listAdapters: () => [
        makeAdapter('ok', {
          provider: 'hubspot',
          channel: 'crm',
          healthCheck: vi.fn().mockRejectedValue('credentials missing'),
        }),
      ],
      getCredentials: vi.fn().mockResolvedValue({}),
    })

    expect(result.overall).toBe('down')
    expect(result.results[0]).toMatchObject({
      provider: 'hubspot',
      status: 'down',
      details: 'credentials missing',
    })
  })
})

describe('policy loader', () => {
  beforeEach(() => {
    resetPolicyCache()
    vi.clearAllMocks()
    fsMocks.existsSync.mockReset()
    fsMocks.readFileSync.mockReset()
  })

  it('returns the default policy when no file exists and reuses the cache', () => {
    fsMocks.existsSync.mockReturnValue(false)

    const first = loadIntegrationPolicy('C:/repo')
    const second = loadIntegrationPolicy('C:/repo')

    expect(first).toEqual(second)
    expect(first.version).toBe('1.0')
    expect(fsMocks.existsSync).toHaveBeenCalledTimes(1)
    expect(fsMocks.readFileSync).not.toHaveBeenCalled()
  })

  it('falls back to defaults when the policy file exists but cannot be read', () => {
    fsMocks.existsSync.mockReturnValue(true)
    fsMocks.readFileSync.mockImplementation(() => {
      throw new Error('boom')
    })

    const policy = loadIntegrationPolicy('C:/repo')

    expect(policy.defaults.retry.maxAttempts).toBe(3)
    expect(fsMocks.readFileSync).toHaveBeenCalledOnce()
  })

  it('returns defaults even when a policy file is present because parsing is intentionally conservative', () => {
    fsMocks.existsSync.mockReturnValue(true)
    fsMocks.readFileSync.mockReturnValue('version: 1.0')

    const policy = loadIntegrationPolicy('C:/repo')

    expect(policy.providers).toEqual({})
    expect(fsMocks.readFileSync).toHaveBeenCalledOnce()
  })

  it('merges provider overrides with the default policy', () => {
    const policy = getProviderPolicy('resend', {
      version: '1.0',
      defaults: {
        circuitBreaker: {
          failureThreshold: 5,
          failureRateThreshold: 0.5,
          cooldownMs: 60_000,
          halfOpenMaxAttempts: 3,
          windowSizeMs: 300_000,
        },
        retry: {
          maxAttempts: 3,
          baseDelayMs: 1_000,
          maxDelayMs: 30_000,
          jitter: true,
        },
        sla: {
          availabilityTarget: 0.99,
          p95LatencyMs: 5_000,
          p99LatencyMs: 15_000,
        },
      },
      providers: {
        resend: {
          retry: { maxAttempts: 5 },
          sla: { p95LatencyMs: 2_000 },
        },
      },
    })

    expect(policy.retry).toMatchObject({ maxAttempts: 5, maxDelayMs: 30_000, jitter: true })
    expect(policy.sla).toMatchObject({ p95LatencyMs: 2_000, p99LatencyMs: 15_000 })
  })
})

describe('telemetry bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('routes each integration action to the expected telemetry methods', () => {
    const telemetry = {
      webhookReceived: vi.fn(),
      payloadValidated: vi.fn(),
      adapterExecuted: vi.fn(),
      providerRequest: vi.fn(),
      providerResponse: vi.fn(),
      mappingApplied: vi.fn(),
      syncCompleted: vi.fn(),
      retryInvoked: vi.fn(),
      auditEmitted: vi.fn(),
    }
    const createTelemetry = vi.fn((_provider: string, _channel: string) => telemetry)

    recordIntegrationTelemetry({
      provider: 'resend',
      channel: 'email',
      orgId: 'org-1',
      correlationId: 'corr-1',
      action: 'send',
      success: true,
      latencyMs: 20,
    }, { createTelemetry })
    recordIntegrationTelemetry({
      provider: 'resend',
      channel: 'email',
      orgId: 'org-1',
      correlationId: 'corr-1',
      action: 'retry',
      success: false,
      latencyMs: 20,
      error: 'timeout',
      attempt: 2,
    }, { createTelemetry })
    recordIntegrationTelemetry({
      provider: 'resend',
      channel: 'email',
      orgId: 'org-1',
      correlationId: 'corr-1',
      action: 'timeout',
      success: false,
      latencyMs: 5000,
    }, { createTelemetry })
    recordIntegrationTelemetry({
      provider: 'resend',
      channel: 'email',
      orgId: 'org-1',
      correlationId: 'corr-1',
      action: 'health_check',
      success: false,
      latencyMs: 50,
    }, { createTelemetry })
    recordIntegrationTelemetry({
      provider: 'resend',
      channel: 'email',
      orgId: 'org-1',
      correlationId: 'corr-1',
      action: 'dlq',
      success: false,
      latencyMs: 0,
    }, { createTelemetry })
    recordIntegrationTelemetry({
      provider: 'resend',
      channel: 'email',
      orgId: 'org-1',
      correlationId: 'corr-1',
      action: 'circuit_trip',
      success: false,
      latencyMs: 0,
    }, { createTelemetry })

    expect(createTelemetry).toHaveBeenCalledTimes(6)
    expect(telemetry.providerRequest).toHaveBeenCalledOnce()
    expect(telemetry.providerResponse).toHaveBeenCalledWith(200, 20)
    expect(telemetry.providerResponse).toHaveBeenCalledWith(504, 5000)
    expect(telemetry.providerResponse).toHaveBeenCalledWith(503, 50)
    expect(telemetry.retryInvoked).toHaveBeenCalledWith(2, 'timeout')
    expect(telemetry.auditEmitted).toHaveBeenCalledWith('delivery.dlq')
    expect(telemetry.auditEmitted).toHaveBeenCalledWith('circuit.tripped')
  })

  it('records send telemetry with and without rate-limit metadata', () => {
    recordSendTelemetry('resend', 'email', 'org-1', 'corr-1', {
      ok: true,
      providerMessageId: 'msg-1',
      rateLimitInfo: { isRateLimited: false, limit: 10, remaining: 9, resetAt: '2026-03-01T00:00:00.000Z' },
    }, 42, 1)
    recordSendTelemetry('resend', 'email', 'org-1', 'corr-2', {
      ok: false,
      error: 'bad request',
    }, 25)

    expect(telemetryMocks.integrationTelemetry).toHaveBeenCalledWith('resend', 'email')
    expect(telemetryMocks.telemetry.providerRequest).toHaveBeenCalledTimes(2)
    expect(telemetryMocks.telemetry.providerResponse).toHaveBeenCalledWith(200, 42)
    expect(telemetryMocks.telemetry.providerResponse).toHaveBeenCalledWith(500, 25)
  })
})

describe('integrations-runtime barrel exports', () => {
  it('exposes the public runtime API', () => {
    expect(runtime.checkAllIntegrations).toBeTypeOf('function')
    expect(runtime.recordIntegrationTelemetry).toBeTypeOf('function')
    expect(runtime.withRetry).toBeTypeOf('function')
    expect(runtime.DEFAULT_TIMEOUT_CONFIG).toBeDefined()
  })
})