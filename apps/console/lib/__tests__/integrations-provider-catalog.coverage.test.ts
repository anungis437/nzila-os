import { afterEach, describe, expect, it, vi } from 'vitest'

const { adapterHealthCheck } = vi.hoisted(() => ({
  adapterHealthCheck: vi.fn(),
}))

vi.mock('@nzila/comms-email', () => ({
  resendAdapter: { healthCheck: adapterHealthCheck },
  sendgridAdapter: { healthCheck: adapterHealthCheck },
  mailgunAdapter: { healthCheck: adapterHealthCheck },
}))
vi.mock('@nzila/comms-sms', () => ({ twilioAdapter: { healthCheck: adapterHealthCheck } }))
vi.mock('@nzila/comms-push', () => ({ firebaseAdapter: { healthCheck: adapterHealthCheck } }))
vi.mock('@nzila/chatops-slack', () => ({ slackAdapter: { healthCheck: adapterHealthCheck } }))
vi.mock('@nzila/chatops-teams', () => ({ teamsAdapter: { healthCheck: adapterHealthCheck } }))
vi.mock('@nzila/crm-hubspot', () => ({ hubspotAdapter: { healthCheck: adapterHealthCheck } }))

import {
  listProviderDefinitions,
  parseProviderKey,
  providerCatalog,
  providerKeys,
  requiredSecretsForProvider,
} from '../integrations-provider-catalog'

describe('integrations-provider-catalog coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    adapterHealthCheck.mockReset()
  })

  it('exposes every provider key in definitions', () => {
    const defs = listProviderDefinitions()
    expect(defs).toHaveLength(providerKeys.length)
    expect(defs.map((d) => d.key)).toEqual(providerKeys)
  })

  it('parses valid provider keys and throws for invalid ones', () => {
    expect(parseProviderKey('resend')).toBe('resend')
    expect(() => parseProviderKey('invalid-provider')).toThrow()
  })

  it('returns required secrets for providers', () => {
    expect(requiredSecretsForProvider('webhooks')).toContain('signingSecret')
    expect(requiredSecretsForProvider('m365')).toEqual(['tenantId', 'clientId', 'clientSecret'])
  })

  it('returns validation error for missing required adapter secrets', async () => {
    const result = await providerCatalog.sendgrid.testConnection({})
    expect(result.ok).toBe(false)
    expect(result.error).toContain('apiKey')
  })

  it('maps adapter health-check success and failure states', async () => {
    adapterHealthCheck.mockResolvedValueOnce({ status: 'ok', details: null })
    await expect(providerCatalog.resend.testConnection({ apiKey: 'x', fromAddress: 'a@b.com' })).resolves.toEqual({ ok: true })

    adapterHealthCheck.mockResolvedValueOnce({ status: 'degraded', details: 'slow provider' })
    await expect(providerCatalog.mailgun.testConnection({ apiKey: 'x', domain: 'd', fromAddress: 'a@b.com' })).resolves.toEqual({
      ok: false,
      error: 'slow provider',
    })
  })

  it('validates webhooks secret strength', async () => {
    await expect(providerCatalog.webhooks.testConnection({ signingSecret: 'short' })).resolves.toEqual({
      ok: false,
      error: 'signingSecret must be at least 16 characters',
    })
    await expect(providerCatalog.webhooks.testConnection({ signingSecret: '1234567890abcdef' })).resolves.toEqual({ ok: true })
  })

  it('tests Microsoft 365 token exchange', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await expect(
      providerCatalog.m365.testConnection({ tenantId: 't', clientId: 'c', clientSecret: 's' }),
    ).resolves.toEqual({ ok: true })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'denied' }))

    const failed = await providerCatalog.m365.testConnection({ tenantId: 't', clientId: 'c', clientSecret: 's' })
    expect(failed.ok).toBe(false)
    expect(failed.error).toContain('M365 token exchange failed')

    const missing = await providerCatalog.m365.testConnection({ tenantId: 't' } as Record<string, string>)
    expect(missing.ok).toBe(false)
    expect(missing.error).toContain('Missing required secrets')
  })

  it('tests Google Workspace token refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    await expect(
      providerCatalog['google-workspace'].testConnection({
        clientId: 'id',
        clientSecret: 'secret',
        refreshToken: 'refresh',
      }),
    ).resolves.toEqual({ ok: true })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad token' }))

    const failed = await providerCatalog['google-workspace'].testConnection({
      clientId: 'id',
      clientSecret: 'secret',
      refreshToken: 'refresh',
    })
    expect(failed.ok).toBe(false)
    expect(failed.error).toContain('Google token refresh failed')

    const missing = await providerCatalog['google-workspace'].testConnection({ clientId: 'id' } as Record<string, string>)
    expect(missing.ok).toBe(false)
    expect(missing.error).toContain('Missing required secrets')
  })

  it('returns default adapter failure message when details are absent', async () => {
    adapterHealthCheck.mockResolvedValueOnce({ status: 'down', details: null })
    const failed = await providerCatalog.slack.testConnection({ webhookUrl: 'https://hooks.slack.com/services/x' })
    expect(failed.ok).toBe(false)
    expect(failed.error).toContain('slack health check failed')
  })

  it('validates missing webhooks secrets', async () => {
    const failed = await providerCatalog.webhooks.testConnection({} as Record<string, string>)
    expect(failed.ok).toBe(false)
    expect(failed.error).toContain('Missing required secrets')
  })
})
