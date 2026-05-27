import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resendAdapter } from './resend'

const mocks = vi.hoisted(() => ({
  emailsSend: vi.fn(),
  domainsList: vi.fn(),
}))

vi.mock('resend', () => ({
  Resend: class {
    readonly emails = { send: mocks.emailsSend }
    readonly domains = { list: mocks.domainsList }
  },
}))

const baseRequest = {
  orgId: '00000000-0000-0000-0000-000000000001',
  channel: 'email' as const,
  to: 'user@nzila.app',
  subject: 'Hello',
  body: '<p>Body</p>',
  correlationId: '00000000-0000-0000-0000-000000000002',
}

const baseCredentials = {
  apiKey: 're_test_key',
  fromAddress: 'noreply@nzila.app',
}

describe('resendAdapter', () => {
  beforeEach(() => {
    mocks.emailsSend.mockReset()
    mocks.domainsList.mockReset()
  })

  it('adds correlation headers and tags on send', async () => {
    mocks.emailsSend.mockResolvedValue({
      data: { id: 'msg_123' },
      error: null,
    })

    const result = await resendAdapter.send(baseRequest, baseCredentials)

    expect(result.ok).toBe(true)
    expect(result.providerMessageId).toBe('msg_123')
    expect(result.latencyMs).toBeTypeOf('number')

    const payload = mocks.emailsSend.mock.calls[0]?.[0] as Record<string, unknown>
    const headers = payload['headers'] as Record<string, string>
    const tags = payload['tags'] as Array<{ name: string; value: string }>

    expect(headers['X-Correlation-Id']).toBe(baseRequest.correlationId)
    expect(headers['X-Org-Id']).toBe(baseRequest.orgId)
    expect(headers['X-Channel']).toBe('email')
    expect(tags).toEqual(
      expect.arrayContaining([{ name: 'correlation_id', value: baseRequest.correlationId }]),
    )
  })

  it('supports resend metadata fields and default credentials overrides', async () => {
    mocks.emailsSend.mockResolvedValue({
      data: { id: 'msg_124' },
      error: null,
    })

    await resendAdapter.send(
      {
        ...baseRequest,
        metadata: {
          resend: {
            cc: ['cc1@nzila.app', 'cc2@nzila.app'],
            bcc: 'audit@nzila.app',
            replyTo: 'support@nzila.app',
            text: 'Plaintext body',
            scheduledAt: '2026-05-25T10:00:00.000Z',
            headers: { 'X-Custom': 'enabled' },
            tags: { workflow: 'onboarding' },
          },
        },
      },
      {
        ...baseCredentials,
        defaultTags: [{ name: 'env', value: 'test' }],
      },
    )

    const payload = mocks.emailsSend.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload['cc']).toEqual(['cc1@nzila.app', 'cc2@nzila.app'])
    expect(payload['bcc']).toEqual(['audit@nzila.app'])
    expect(payload['replyTo']).toBe('support@nzila.app')
    expect(payload['text']).toBe('Plaintext body')
    expect(payload['scheduledAt']).toBe('2026-05-25T10:00:00.000Z')

    const headers = payload['headers'] as Record<string, string>
    const tags = payload['tags'] as Array<{ name: string; value: string }>
    expect(headers['X-Custom']).toBe('enabled')
    expect(tags).toEqual(expect.arrayContaining([{ name: 'env', value: 'test' }]))
    expect(tags).toEqual(expect.arrayContaining([{ name: 'workflow', value: 'onboarding' }]))
  })

  it('retries on transient errors and eventually succeeds', async () => {
    mocks.emailsSend
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: 'rate limited',
          statusCode: 429,
          headers: {
            'retry-after': '0',
            'x-ratelimit-limit': '100',
            'x-ratelimit-remaining': '0',
          },
        },
      })
      .mockResolvedValueOnce({
        data: { id: 'msg_retry_ok' },
        error: null,
      })

    const result = await resendAdapter.send(baseRequest, {
      ...baseCredentials,
      maxRetries: 1,
    })

    expect(result.ok).toBe(true)
    expect(result.providerMessageId).toBe('msg_retry_ok')
    expect(mocks.emailsSend).toHaveBeenCalledTimes(2)
  })

  it('returns rate limit details on non-retryable failure', async () => {
    mocks.emailsSend.mockResolvedValue({
      data: null,
      error: {
        message: 'rate limited',
        statusCode: 429,
        headers: {
          'retry-after': '2',
          'x-ratelimit-limit': '50',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '1716552000',
        },
      },
    })

    const result = await resendAdapter.send(
      {
        ...baseRequest,
        metadata: { resend: { disableRetry: true } },
      },
      {
        ...baseCredentials,
        maxRetries: 3,
      },
    )

    expect(result.ok).toBe(false)
    expect(result.error).toBe('rate limited')
    expect(result.rateLimitInfo).toEqual(
      expect.objectContaining({
        isRateLimited: true,
        retryAfterMs: 2000,
        limit: 50,
        remaining: 0,
      }),
    )
  })
})
