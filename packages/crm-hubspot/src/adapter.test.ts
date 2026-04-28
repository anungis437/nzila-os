import { describe, expect, it, vi } from 'vitest'
import { hubspotAdapter } from './adapter'
import {
  HubSpotClient,
  HubSpotContactSchema,
  HubSpotDealSchema,
  HubSpotEngagementNoteSchema,
} from './client'

describe('crm-hubspot adapter and client', () => {
  it('exposes expected adapter metadata', () => {
    expect(hubspotAdapter.provider).toBe('hubspot')
    expect(hubspotAdapter.channel).toBe('crm')
  })

  it('returns down status when apiKey is missing', async () => {
    const result = await hubspotAdapter.healthCheck({})
    expect(result.status).toBe('down')
    expect(result.details).toContain('Missing HubSpot apiKey')
  })

  it('returns explicit error for unknown CRM operation', async () => {
    const result = await hubspotAdapter.send(
      {
        to: 'ignored@nzila.app',
        body: '{}',
        metadata: { operation: 'unknown_operation' },
      },
      { apiKey: 'hs_test_key' },
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Unknown CRM operation')
  })

  it('validates core payload schemas', () => {
    expect(HubSpotContactSchema.safeParse({ email: 'ops@nzila.app' }).success).toBe(true)
    expect(HubSpotContactSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)

    expect(HubSpotDealSchema.safeParse({ name: 'Q1 renewal', stage: 'qualified' }).success).toBe(true)
    expect(HubSpotDealSchema.safeParse({ name: '', stage: '' }).success).toBe(false)

    expect(HubSpotEngagementNoteSchema.safeParse({ contactId: '123', body: 'Follow-up' }).success).toBe(true)
    expect(HubSpotEngagementNoteSchema.safeParse({ contactId: '', body: '' }).success).toBe(false)
  })

  it('health check reports ok when fetch succeeds', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      text: async () => '',
    }))

    vi.stubGlobal('fetch', fetchMock)
    try {
      const client = new HubSpotClient({ apiKey: 'hs_test_key', maxRetries: 0 })
      const result = await client.healthCheck()
      expect(result.ok).toBe(true)
      expect(typeof result.latencyMs).toBe('number')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
