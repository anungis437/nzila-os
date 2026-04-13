import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock env ────────────────────────────────────────────────────────────────
const mockEnv = {
  INTUIT_CLIENT_ID: 'test-client-id',
  INTUIT_CLIENT_SECRET: 'test-client-secret',
  INTUIT_REDIRECT_URI: 'http://localhost:3000/callback',
  INTUIT_APP_ID: '00000000-0000-0000-0000-000000000001',
  QBO_BASE_URL: 'https://sandbox-quickbooks.api.intuit.com',
}

vi.mock('./env', () => ({
  getQboEnv: () => mockEnv,
}))

// ── Mock fetch ──────────────────────────────────────────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  isAccessTokenExpired,
  isRefreshTokenExpired,
  getValidToken,
  QBO_SCOPES,
} from './oauth'
import type { QboTokenSet } from './types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTokenSet(overrides: Partial<QboTokenSet> = {}): QboTokenSet {
  return {
    access_token: 'access-tok',
    refresh_token: 'refresh-tok',
    token_type: 'bearer',
    expires_in: 3600,
    x_refresh_token_expires_in: 8726400,
    realmId: 'realm-123',
    obtainedAt: Date.now(),
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('oauth', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockFetch.mockReset()
  })

  // ── buildAuthorizationUrl ────────────────────────────────────────────────

  describe('buildAuthorizationUrl', () => {
    it('builds URL with default scopes and state', () => {
      const url = buildAuthorizationUrl('csrf-123')

      expect(url).toContain('https://appcenter.intuit.com/connect/oauth2')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('redirect_uri=')
      expect(url).toContain('response_type=code')
      expect(url).toContain('state=csrf-123')
      expect(url).toContain(encodeURIComponent(QBO_SCOPES[0]))
    })

    it('uses custom scopes when provided', () => {
      const url = buildAuthorizationUrl('state-1', ['openid', 'profile'])
      // URLSearchParams encodes spaces as +
      expect(url).toContain('scope=openid+profile')
    })
  })

  // ── exchangeCodeForTokens ────────────────────────────────────────────────

  describe('exchangeCodeForTokens', () => {
    it('exchanges code for tokens', async () => {
      const tokenResponse = {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        token_type: 'bearer',
        expires_in: 3600,
        x_refresh_token_expires_in: 8726400,
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse,
      })

      const result = await exchangeCodeForTokens('auth-code', 'realm-999')

      expect(result.access_token).toBe('new-access')
      expect(result.realmId).toBe('realm-999')
      expect(result.obtainedAt).toBeGreaterThan(0)

      // Verify fetch was called with correct params
      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('tokens/bearer')
      expect(opts.method).toBe('POST')
      expect(opts.headers.Authorization).toMatch(/^Basic /)
      expect(opts.body).toContain('grant_type=authorization_code')
      expect(opts.body).toContain('code=auth-code')
    })

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })

      await expect(exchangeCodeForTokens('bad', 'r'))
        .rejects.toThrow('QBO token exchange failed 401: Unauthorized')
    })
  })

  // ── refreshAccessToken ───────────────────────────────────────────────────

  describe('refreshAccessToken', () => {
    it('refreshes an expired access token', async () => {
      const tokenResponse = {
        access_token: 'refreshed-access',
        refresh_token: 'new-refresh-tok',
        token_type: 'bearer',
        expires_in: 3600,
        x_refresh_token_expires_in: 8726400,
      }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse,
      })

      const existing = makeTokenSet()
      const result = await refreshAccessToken(existing)

      expect(result.access_token).toBe('refreshed-access')
      expect(result.realmId).toBe('realm-123')
      expect(result.obtainedAt).toBeGreaterThan(0)

      const body = mockFetch.mock.calls[0][1].body as string
      expect(body).toContain('grant_type=refresh_token')
      expect(body).toContain('refresh_token=refresh-tok')
    })

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      })

      await expect(refreshAccessToken(makeTokenSet()))
        .rejects.toThrow('QBO token refresh failed 400: Bad Request')
    })
  })

  // ── revokeToken ──────────────────────────────────────────────────────────

  describe('revokeToken', () => {
    it('revokes a token', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true })

      await expect(revokeToken('some-token')).resolves.toBeUndefined()

      const [url, opts] = mockFetch.mock.calls[0]
      expect(url).toContain('tokens/revoke')
      expect(opts.body).toContain('token=some-token')
    })

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      })

      await expect(revokeToken('tok'))
        .rejects.toThrow('QBO token revocation failed 500: Server Error')
    })
  })

  // ── isAccessTokenExpired ─────────────────────────────────────────────────

  describe('isAccessTokenExpired', () => {
    it('returns false when token is fresh', () => {
      const ts = makeTokenSet({ obtainedAt: Date.now() })
      expect(isAccessTokenExpired(ts)).toBe(false)
    })

    it('returns true when token is past expiry minus buffer', () => {
      // obtained 1 hour ago, expires_in = 3600s → already expired
      const ts = makeTokenSet({ obtainedAt: Date.now() - 3600 * 1000 })
      expect(isAccessTokenExpired(ts)).toBe(true)
    })
  })

  // ── isRefreshTokenExpired ────────────────────────────────────────────────

  describe('isRefreshTokenExpired', () => {
    it('returns false when refresh token is fresh', () => {
      const ts = makeTokenSet({ obtainedAt: Date.now() })
      expect(isRefreshTokenExpired(ts)).toBe(false)
    })

    it('returns true when refresh token is past expiry minus buffer', () => {
      // obtained 102 days ago, x_refresh_token_expires_in = 8726400s (~101 days)
      const ts = makeTokenSet({ obtainedAt: Date.now() - 102 * 24 * 60 * 60 * 1000 })
      expect(isRefreshTokenExpired(ts)).toBe(true)
    })
  })

  // ── getValidToken ────────────────────────────────────────────────────────

  describe('getValidToken', () => {
    it('returns existing token set if access token is still valid', async () => {
      const ts = makeTokenSet({ obtainedAt: Date.now() })
      const persist = vi.fn()

      const result = await getValidToken(ts, persist)
      expect(result).toBe(ts)
      expect(persist).not.toHaveBeenCalled()
    })

    it('refreshes and persists when access token is expired', async () => {
      const ts = makeTokenSet({ obtainedAt: Date.now() - 3600 * 1000 })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed',
          refresh_token: 'new-refresh',
          token_type: 'bearer',
          expires_in: 3600,
          x_refresh_token_expires_in: 8726400,
        }),
      })

      const persist = vi.fn()
      const result = await getValidToken(ts, persist)

      expect(result.access_token).toBe('refreshed')
      expect(persist).toHaveBeenCalledWith(result)
    })

    it('throws when refresh token is expired', async () => {
      const ts = makeTokenSet({ obtainedAt: Date.now() - 102 * 24 * 60 * 60 * 1000 })
      const persist = vi.fn()

      await expect(getValidToken(ts, persist))
        .rejects.toThrow('QBO refresh token expired')
    })
  })
})
