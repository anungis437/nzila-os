/**
 * CFO — Public API Tests
 *
 * Tests for the REST API layer: endpoint matching, scope validation,
 * rate limiting, pagination, webhook signatures.
 */
import { describe, it, expect } from 'vitest'
import {
  checkRateLimit,
  validateScope,
  matchEndpoint,
  paginatedResponse,
  errorResponse,
  signWebhookPayload,
  verifyWebhookSignature,
  API_ENDPOINTS,
  type APIKeyConfig,
  type APIScope,
} from '../lib/public-api'

// ── Endpoint catalog ────────────────────────────────────────────────────────

describe('API Endpoint Catalog', () => {
  it('contains documented endpoints', () => {
    expect(API_ENDPOINTS.length).toBeGreaterThan(10)
  })

  it('every endpoint has required fields', () => {
    for (const ep of API_ENDPOINTS) {
      expect(ep.path).toMatch(/^\/v1\//)
      expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).toContain(ep.method)
      expect(ep.scope).toBeTruthy()
      expect(ep.description).toBeTruthy()
    }
  })

  it('has financial report endpoints', () => {
    const reportPaths = API_ENDPOINTS.filter((ep) => ep.path.startsWith('/v1/reports'))
    expect(reportPaths.length).toBeGreaterThanOrEqual(4)
  })
})

// ── Endpoint matching ───────────────────────────────────────────────────────

describe('matchEndpoint', () => {
  it('matches exact path', () => {
    const ep = matchEndpoint('GET', '/v1/accounts')
    expect(ep).not.toBeNull()
    expect(ep!.scope).toBe('read:accounts')
  })

  it('matches parameterized path', () => {
    const ep = matchEndpoint('GET', '/v1/invoices/inv_123')
    expect(ep).not.toBeNull()
    expect(ep!.scope).toBe('read:invoices')
  })

  it('returns null for unknown path', () => {
    expect(matchEndpoint('GET', '/v1/nonexistent')).toBeNull()
  })

  it('returns null for method mismatch', () => {
    expect(matchEndpoint('DELETE', '/v1/accounts')).toBeNull()
  })
})

// ── Scope validation ────────────────────────────────────────────────────────

describe('validateScope', () => {
  const baseKey: APIKeyConfig = {
    keyId: 'key_001',
    orgId: 'org_001',
    name: 'Test Key',
    scopes: ['read:accounts', 'read:reports'] as APIScope[],
    rateLimit: { requestsPerMinute: 60, requestsPerDay: 10_000 },
    createdAt: '2025-01-01T00:00:00Z',
    expiresAt: null,
    isActive: true,
  }

  it('allows valid scope', () => {
    const r = validateScope(baseKey, 'read:accounts')
    expect(r.valid).toBe(true)
  })

  it('rejects missing scope', () => {
    const r = validateScope(baseKey, 'write:invoices')
    expect(r.valid).toBe(false)
    expect(r.error).toContain('Missing scope')
  })

  it('rejects inactive key', () => {
    const r = validateScope({ ...baseKey, isActive: false }, 'read:accounts')
    expect(r.valid).toBe(false)
    expect(r.error).toContain('inactive')
  })

  it('rejects expired key', () => {
    const r = validateScope(
      { ...baseKey, expiresAt: '2020-01-01T00:00:00Z' },
      'read:accounts',
    )
    expect(r.valid).toBe(false)
    expect(r.error).toContain('expired')
  })
})

// ── Rate limiting ───────────────────────────────────────────────────────────

describe('checkRateLimit', () => {
  it('allows first request', () => {
    const r = checkRateLimit('test_key_rl_1')
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBeGreaterThan(0)
  })

  it('tracks requests within window', () => {
    const keyId = 'test_key_rl_2'
    checkRateLimit(keyId, { requestsPerMinute: 5 })
    checkRateLimit(keyId, { requestsPerMinute: 5 })
    const r = checkRateLimit(keyId, { requestsPerMinute: 5 })
    expect(r.allowed).toBe(true)
    expect(r.remaining).toBe(2)
  })

  it('blocks when limit exceeded', () => {
    const keyId = 'test_key_rl_3'
    for (let i = 0; i < 3; i++) {
      checkRateLimit(keyId, { requestsPerMinute: 3 })
    }
    const r = checkRateLimit(keyId, { requestsPerMinute: 3 })
    expect(r.allowed).toBe(false)
    expect(r.remaining).toBe(0)
    expect(r.retryAfterMs).toBeGreaterThan(0)
  })
})

// ── Response helpers ────────────────────────────────────────────────────────

describe('paginatedResponse', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }))

  it('returns correct page', () => {
    const r = paginatedResponse(items, 1, 10, 'req_001')
    expect(r.status).toBe(200)
    expect(r.data!.length).toBe(10)
    expect(r.meta!.total).toBe(25)
    expect(r.meta!.totalPages).toBe(3)
  })

  it('handles last partial page', () => {
    const r = paginatedResponse(items, 3, 10, 'req_002')
    expect(r.data!.length).toBe(5)
    expect(r.meta!.page).toBe(3)
  })

  it('returns empty data beyond range', () => {
    const r = paginatedResponse(items, 10, 10, 'req_003')
    expect(r.data!.length).toBe(0)
  })
})

describe('errorResponse', () => {
  it('creates error with code and message', () => {
    const r = errorResponse(403, 'FORBIDDEN', 'Access denied', 'req_004')
    expect(r.status).toBe(403)
    expect(r.error!.code).toBe('FORBIDDEN')
    expect(r.requestId).toBe('req_004')
  })
})

// ── Webhook signatures ─────────────────────────────────────────────────────

describe('Webhook signatures', () => {
  const secret = 'whsec_test_secret_key'
  const payload = '{"event":"invoice.paid","data":{"id":"inv_1"}}'

  it('signs and verifies payload', async () => {
    const sig = await signWebhookPayload(payload, secret)
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
    const valid = await verifyWebhookSignature(payload, sig, secret)
    expect(valid).toBe(true)
  })

  it('rejects tampered payload', async () => {
    const sig = await signWebhookPayload(payload, secret)
    const valid = await verifyWebhookSignature(payload + 'x', sig, secret)
    expect(valid).toBe(false)
  })

  it('rejects wrong secret', async () => {
    const sig = await signWebhookPayload(payload, secret)
    const valid = await verifyWebhookSignature(payload, sig, 'wrong_secret')
    expect(valid).toBe(false)
  })
})
