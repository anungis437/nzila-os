import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SendRequest } from '@nzila/integrations-core'

const mockCreate = vi.fn()
const mockFetch = vi.fn()

vi.mock('twilio', () => ({
  default: () => ({
    messages: { create: mockCreate },
    api: { accounts: () => ({ fetch: mockFetch }) },
  }),
}))

// import after mock is registered
const { twilioAdapter } = await import('./twilio')

function req(overrides: Partial<SendRequest> = {}): SendRequest {
  return { orgId: 'org-1', channel: 'sms', to: '+15551234567', correlationId: 'corr-1', body: 'Hello', ...overrides }
}

const creds = { accountSid: 'AC123', authToken: 'tok', fromNumber: '+15550000000' }

beforeEach(() => {
  mockCreate.mockReset()
  mockFetch.mockReset()
})

describe('twilioAdapter', () => {
  it('exposes provider and channel', () => {
    expect(twilioAdapter.provider).toBe('twilio')
    expect(twilioAdapter.channel).toBe('sms')
  })

  describe('send', () => {
    it('sends SMS and returns provider message ID', async () => {
      mockCreate.mockResolvedValueOnce({ sid: 'SM123' })
      const result = await twilioAdapter.send(req(), creds)
      expect(result.ok).toBe(true)
      expect(result.providerMessageId).toBe('SM123')
      expect(mockCreate).toHaveBeenCalledWith({
        to: '+15551234567',
        from: '+15550000000',
        body: 'Hello',
      })
    })

    it('returns error on Twilio failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Invalid phone number'))
      const result = await twilioAdapter.send(req(), creds)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Invalid phone number')
    })

    it('forwards a valid statusCallback URL', async () => {
      mockCreate.mockResolvedValueOnce({ sid: 'SM789' })
      const result = await twilioAdapter.send(
        req({ metadata: { statusCallback: 'https://app.example.test/api/webhooks/twilio' } }),
        creds,
      )
      expect(result.ok).toBe(true)
      expect(mockCreate).toHaveBeenCalledWith({
        to: '+15551234567',
        from: '+15550000000',
        body: 'Hello',
        statusCallback: 'https://app.example.test/api/webhooks/twilio',
      })
    })

    it.each([
      ['undefined/api/webhooks/twilio'],
      ['javascript:alert(1)'],
      [42],
    ])('refuses an invalid statusCallback (%s) without calling Twilio', async (statusCallback) => {
      const result = await twilioAdapter.send(req({ metadata: { statusCallback } }), creds)
      expect(result).toEqual({ ok: false, error: 'Invalid Twilio statusCallback' })
      expect(mockCreate).not.toHaveBeenCalled()
    })

    it('sends empty body when body is undefined', async () => {
      mockCreate.mockResolvedValueOnce({ sid: 'SM456' })
      await twilioAdapter.send(req({ body: undefined }), creds)
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ body: '' }))
    })
  })

  describe('healthCheck', () => {
    it('returns ok when account is reachable', async () => {
      mockFetch.mockResolvedValueOnce({})
      const result = await twilioAdapter.healthCheck(creds)
      expect(result.status).toBe('ok')
      expect(result.provider).toBe('twilio')
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
    })

    it('returns down on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('auth failed'))
      const result = await twilioAdapter.healthCheck(creds)
      expect(result.status).toBe('down')
      expect(result.details).toBe('auth failed')
    })
  })

  describe('parseCredentials (via send)', () => {
    it('throws on missing accountSid', async () => {
      await expect(twilioAdapter.send(req(), {})).rejects.toThrow('Missing Twilio accountSid')
    })

    it('throws on missing authToken', async () => {
      await expect(twilioAdapter.send(req(), { accountSid: 'AC1' })).rejects.toThrow('Missing Twilio authToken')
    })

    it('throws on missing fromNumber', async () => {
      await expect(twilioAdapter.send(req(), { accountSid: 'AC1', authToken: 'tok' })).rejects.toThrow('Missing Twilio fromNumber')
    })
  })
})
