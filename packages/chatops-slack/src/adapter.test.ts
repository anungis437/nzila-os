import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SendRequest } from '@nzila/integrations-core'
import { slackAdapter } from './adapter'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function req(overrides: Partial<SendRequest> = {}): SendRequest {
  return { orgId: 'org-1', channel: 'chatops', to: '', correlationId: 'corr-1', body: 'hello', ...overrides }
}

describe('slackAdapter', () => {
  it('exposes provider and channel', () => {
    expect(slackAdapter.provider).toBe('slack')
    expect(slackAdapter.channel).toBe('chatops')
  })

  describe('send — webhook mode', () => {
    const creds = { webhookUrl: 'https://hooks.slack.com/services/T/B/X' }

    it('posts to webhook and returns ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      const result = await slackAdapter.send(req(), creds)
      expect(result.ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(creds.webhookUrl, expect.objectContaining({ method: 'POST' }))
    })

    it('formats subject as bold prefix', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      await slackAdapter.send(req({ subject: 'Alert', body: 'details' }), creds)
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(callArgs[1].body as string)
      expect(body.text).toBe('*Alert*\ndetails')
    })

    it('formats subject with empty body when body is undefined', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      await slackAdapter.send(req({ subject: 'Alert', body: undefined }), creds)
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(callArgs[1].body as string)
      expect(body.text).toBe('*Alert*\n')
    })

    it('returns error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 })
      const result = await slackAdapter.send(req(), creds)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('403')
    })

    it('returns error on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network'))
      const result = await slackAdapter.send(req(), creds)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('network')
    })

    it('handles non-Error throw in webhook mode', async () => {
      mockFetch.mockRejectedValueOnce('webhook string error')
      const result = await slackAdapter.send(req(), creds)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('webhook string error')
    })

    it('sends empty text when body is undefined in webhook mode', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      await slackAdapter.send(req({ body: undefined }), creds)
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(callArgs[1].body as string)
      expect(body.text).toBe('')
    })
  })

  describe('send — bot token mode', () => {
    const creds = { webhookUrl: 'https://hooks.slack.com/services/T/B/X', botToken: 'xoxb-test' }

    it('uses Slack Web API when botToken and to are provided', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true, ts: '123.456' }) })
      const result = await slackAdapter.send(req({ to: '#general' }), creds)
      expect(result.ok).toBe(true)
      expect(result.providerMessageId).toBe('123.456')
      expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/chat.postMessage', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer xoxb-test' }),
      }))
    })

    it('falls back to webhook when bot token present but no to', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      const result = await slackAdapter.send(req({ to: '' }), creds)
      expect(result.ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(creds.webhookUrl, expect.anything())
    })

    it('sends empty text when body is undefined in bot mode', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true, ts: '111' }) })
      const result = await slackAdapter.send(req({ to: '#general', body: undefined }), creds)
      expect(result.ok).toBe(true)
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(callArgs[1].body as string)
      expect(body.text).toBe('')
    })

    it('returns error when Slack API returns not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: false, error: 'channel_not_found' }) })
      const result = await slackAdapter.send(req({ to: '#nope' }), creds)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('channel_not_found')
    })

    it('returns fallback error when Slack API omits error field', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: false }) })
      const result = await slackAdapter.send(req({ to: '#general' }), creds)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Slack API error')
    })

    it('returns error on fetch failure in bot mode', async () => {
      mockFetch.mockRejectedValueOnce(new Error('api failure'))
      const result = await slackAdapter.send(req({ to: '#general' }), creds)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('api failure')
    })

    it('handles non-Error throw in bot mode', async () => {
      mockFetch.mockRejectedValueOnce('raw string error')
      const result = await slackAdapter.send(req({ to: '#channel' }), creds)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('raw string error')
    })

    it('includes blocks when subject is provided in bot mode', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true, ts: '789.012' }) })
      const result = await slackAdapter.send(req({ to: '#alerts', subject: 'Incident', body: 'Server down' }), creds)
      expect(result.ok).toBe(true)
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(callArgs[1].body as string)
      expect(body.blocks).toBeDefined()
      expect(body.blocks[0].text.text).toBe('Incident')
    })

    it('uses empty string in blocks body when body is undefined', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true, ts: '999' }) })
      await slackAdapter.send(req({ to: '#alerts', subject: 'Alert', body: undefined }), creds)
      const callArgs = mockFetch.mock.calls[0] as [string, RequestInit]
      const body = JSON.parse(callArgs[1].body as string)
      expect(body.blocks[1].text.text).toBe('')
    })
  })

  describe('healthCheck', () => {
    it('returns ok in webhook-only mode', async () => {
      const result = await slackAdapter.healthCheck({ webhookUrl: 'https://hooks.slack.com/services/T/B/X' })
      expect(result.status).toBe('ok')
      expect(result.provider).toBe('slack')
      expect(result.details).toContain('webhook-only')
    })

    it('calls auth.test with bot token', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: true }) })
      const result = await slackAdapter.healthCheck({ webhookUrl: 'https://hooks.slack.com/services/T/B/X', botToken: 'xoxb-test' })
      expect(result.status).toBe('ok')
      expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/auth.test', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer xoxb-test' }),
      }))
    })

    it('returns down on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('timeout'))
      const result = await slackAdapter.healthCheck({ webhookUrl: 'https://hooks.slack.com/services/T/B/X', botToken: 'xoxb-test' })
      expect(result.status).toBe('down')
      expect(result.details).toBe('timeout')
    })

    it('returns down with stringified non-Error', async () => {
      mockFetch.mockRejectedValueOnce('raw health error')
      const result = await slackAdapter.healthCheck({ webhookUrl: 'https://hooks.slack.com/services/T/B/X', botToken: 'xoxb-test' })
      expect(result.status).toBe('down')
      expect(result.details).toBe('raw health error')
    })

    it('returns degraded when auth.test fails', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: false, error: 'invalid_auth' }) })
      const result = await slackAdapter.healthCheck({ webhookUrl: 'https://hooks.slack.com/services/T/B/X', botToken: 'xoxb-test' })
      expect(result.status).toBe('degraded')
      expect(result.details).toBe('invalid_auth')
    })

    it('returns fallback details when auth.test fails without error field', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ok: false }) })
      const result = await slackAdapter.healthCheck({ webhookUrl: 'https://hooks.slack.com/services/T/B/X', botToken: 'xoxb-test' })
      expect(result.status).toBe('degraded')
      expect(result.details).toBe('auth.test failed')
    })
  })

  describe('parseCredentials (via send)', () => {
    it('throws on missing webhookUrl', async () => {
      await expect(slackAdapter.send(req(), {})).rejects.toThrow('Missing Slack webhookUrl')
    })

    it('parses defaultChannel when present', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })
      // defaultChannel is parsed but not used directly in send — just verify no throw
      const result = await slackAdapter.send(req(), { webhookUrl: 'https://hooks.slack.com/services/T/B/X', defaultChannel: '#ops' })
      expect(result.ok).toBe(true)
    })
  })
})
