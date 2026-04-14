/**
 * Extended tests for idempotency.ts — cover uncovered lines 219-435
 * (checkIdempotency, isStrictEnvironment, getGlobalIdempotencyCache,
 *  requireIdempotencyKey, recordIdempotentResponse, edge helpers, cleanup)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkIdempotency,
  isStrictEnvironment,
  hashPayload,
  buildCacheKey,
  InMemoryIdempotencyCache,
  IDEMPOTENCY_HEADER,
  MUTATION_METHODS,
  requireIdempotencyKey,
  recordIdempotentResponse,
  resolveIdempotentReplay,
  IDEMPOTENCY_EXEMPT_PATTERNS,
  isMutationApiRoute,
  isIdempotencyExempt,
  type IdempotencyCache,
} from '../idempotency'

describe('checkIdempotency', () => {
  let cache: InMemoryIdempotencyCache

  beforeEach(() => {
    cache = new InMemoryIdempotencyCache()
  })

  it('proceeds for GET requests (not a mutation method)', async () => {
    const result = await checkIdempotency({
      method: 'GET',
      pathname: '/api/orgs',
      idempotencyKey: undefined,
      orgId: 'org-1',
      body: '',
      cache,
      strict: true,
    })
    expect(result.proceed).toBe(true)
  })

  it('proceeds for non-/api routes', async () => {
    const result = await checkIdempotency({
      method: 'POST',
      pathname: '/health',
      idempotencyKey: undefined,
      orgId: 'org-1',
      body: '{}',
      cache,
      strict: true,
    })
    expect(result.proceed).toBe(true)
  })

  it('returns 400 when missing idempotency key in strict mode', async () => {
    const result = await checkIdempotency({
      method: 'POST',
      pathname: '/api/invoices',
      idempotencyKey: undefined,
      orgId: 'org-1',
      body: '{}',
      cache,
      strict: true,
    })
    expect(result.proceed).toBe(false)
    expect(result.error?.status).toBe(400)
    expect(result.error?.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  it('proceeds with warning when missing key in non-strict mode', async () => {
    const result = await checkIdempotency({
      method: 'POST',
      pathname: '/api/invoices',
      idempotencyKey: undefined,
      orgId: 'org-1',
      body: '{}',
      cache,
      strict: false,
    })
    expect(result.proceed).toBe(true)
  })

  it('proceeds on first use of a new idempotency key', async () => {
    const result = await checkIdempotency({
      method: 'POST',
      pathname: '/api/invoices',
      idempotencyKey: 'key-123',
      orgId: 'org-1',
      body: '{"amount":100}',
      cache,
      strict: true,
    })
    expect(result.proceed).toBe(true)
    expect(result.cacheKey).toBeTruthy()
    expect(result.payloadHash).toBeTruthy()
  })

  it('returns cached response on replay with same payload', async () => {
    const body = '{"amount":100}'
    const cacheKey = buildCacheKey('org-1', '/api/invoices', 'key-123')
    const payloadHash = hashPayload(body)

    await cache.set(cacheKey, {
      payloadHash,
      status: 200,
      body: '{"ok":true}',
      headers: { 'x-request-id': 'req-1' },
      createdAt: Date.now(),
    })

    const result = await checkIdempotency({
      method: 'POST',
      pathname: '/api/invoices',
      idempotencyKey: 'key-123',
      orgId: 'org-1',
      body,
      cache,
      strict: true,
    })

    expect(result.proceed).toBe(false)
    expect(result.cachedResponse?.status).toBe(200)
    expect(result.cachedResponse?.body).toBe('{"ok":true}')
    expect(result.cachedResponse?.headers['x-idempotency-replayed']).toBe('true')
  })

  it('returns 409 conflict on payload mismatch', async () => {
    const cacheKey = buildCacheKey('org-1', '/api/invoices', 'key-123')

    await cache.set(cacheKey, {
      payloadHash: hashPayload('{"amount":100}'),
      status: 200,
      body: '{"ok":true}',
      headers: {},
      createdAt: Date.now(),
    })

    const result = await checkIdempotency({
      method: 'POST',
      pathname: '/api/invoices',
      idempotencyKey: 'key-123',
      orgId: 'org-1',
      body: '{"amount":200}', // Different payload
      cache,
      strict: true,
    })

    expect(result.proceed).toBe(false)
    expect(result.error?.status).toBe(409)
    expect(result.error?.body.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH')
  })

  it('accepts all mutation methods: PUT, PATCH, DELETE', async () => {
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      const result = await checkIdempotency({
        method,
        pathname: '/api/invoices',
        idempotencyKey: 'key-new',
        orgId: 'org-1',
        body: '{}',
        cache: new InMemoryIdempotencyCache(),
        strict: true,
      })
      expect(result.proceed).toBe(true)
    }
  })
})

describe('isStrictEnvironment', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns true for NZILA_ENV=pilot', () => {
    process.env.NZILA_ENV = 'pilot'
    expect(isStrictEnvironment()).toBe(true)
  })

  it('returns true for NZILA_ENV=prod', () => {
    process.env.NZILA_ENV = 'prod'
    expect(isStrictEnvironment()).toBe(true)
  })

  it('returns true for NZILA_ENV=Prod (case insensitive)', () => {
    process.env.NZILA_ENV = 'Prod'
    expect(isStrictEnvironment()).toBe(true)
  })

  it('returns false for NZILA_ENV=development', () => {
    process.env.NZILA_ENV = 'development'
    expect(isStrictEnvironment()).toBe(false)
  })

  it('falls back to NODE_ENV when NZILA_ENV is not set', () => {
    delete process.env.NZILA_ENV
    ;(process.env as any).NODE_ENV = 'production'
    expect(isStrictEnvironment()).toBe(true)
  })

  it('returns false when NODE_ENV=test and no NZILA_ENV', () => {
    delete process.env.NZILA_ENV
    ;(process.env as any).NODE_ENV = 'test'
    expect(isStrictEnvironment()).toBe(false)
  })
})

describe('requireIdempotencyKey', () => {
  it('delegates to checkIdempotency with header extraction', async () => {
    const cache = new InMemoryIdempotencyCache()

    const result = await requireIdempotencyKey(
      { orgId: 'org-1' },
      {
        method: 'POST',
        pathname: '/api/test',
        headers: { [IDEMPOTENCY_HEADER]: 'my-key' },
        body: '{}',
      },
      cache,
    )

    expect(result.proceed).toBe(true)
    expect(result.cacheKey).toBeTruthy()
  })

  it('works with Idempotency-Key header case', async () => {
    const cache = new InMemoryIdempotencyCache()

    const result = await requireIdempotencyKey(
      { orgId: 'org-1' },
      {
        method: 'POST',
        pathname: '/api/test',
        headers: { 'Idempotency-Key': 'my-key' },
        body: '{}',
      },
      cache,
    )

    expect(result.proceed).toBe(true)
  })
})

describe('recordIdempotentResponse', () => {
  it('stores response in the cache', async () => {
    const cache = new InMemoryIdempotencyCache()
    const cacheKey = 'idempotency:org-1:/api/test:key-1'

    await recordIdempotentResponse(
      cacheKey,
      hashPayload('{}'),
      200,
      '{"ok":true}',
      { 'x-request-id': 'req-1' },
      cache,
    )

    const stored = await cache.get(cacheKey)
    expect(stored).toBeTruthy()
    expect(stored!.status).toBe(200)
    expect(stored!.body).toBe('{"ok":true}')
  })
})

describe('resolveIdempotentReplay', () => {
  it('is an alias for requireIdempotencyKey', async () => {
    const cache = new InMemoryIdempotencyCache()
    const result = await resolveIdempotentReplay(
      { orgId: 'org-1' },
      {
        method: 'GET',
        pathname: '/api/test',
        headers: {},
        body: '',
      },
      cache,
    )
    // GET is not a mutation, so should proceed
    expect(result.proceed).toBe(true)
  })
})

describe('edge helpers', () => {
  it('isMutationApiRoute identifies POST /api as mutation', () => {
    expect(isMutationApiRoute('POST', '/api/invoices')).toBe(true)
    expect(isMutationApiRoute('PUT', '/api/orgs/1')).toBe(true)
    expect(isMutationApiRoute('PATCH', '/api/users/1')).toBe(true)
    expect(isMutationApiRoute('DELETE', '/api/items/1')).toBe(true)
  })

  it('isMutationApiRoute rejects GET and non-/api paths', () => {
    expect(isMutationApiRoute('GET', '/api/invoices')).toBe(false)
    expect(isMutationApiRoute('POST', '/health')).toBe(false)
    expect(isMutationApiRoute('POST', '/webhook')).toBe(false)
  })

  it('isIdempotencyExempt matches webhooks, health, cron paths', () => {
    expect(isIdempotencyExempt('/api/webhooks/stripe')).toBe(true)
    expect(isIdempotencyExempt('/api/health')).toBe(true)
    expect(isIdempotencyExempt('/api/cron/cleanup')).toBe(true)
  })

  it('isIdempotencyExempt rejects normal api routes', () => {
    expect(isIdempotencyExempt('/api/invoices')).toBe(false)
    expect(isIdempotencyExempt('/api/orgs')).toBe(false)
  })
})

describe('InMemoryIdempotencyCache (extended)', () => {
  it('expires entries older than TTL', async () => {
    const cache = new InMemoryIdempotencyCache()
    await cache.set('key-old', {
      payloadHash: 'hash',
      status: 200,
      body: '{}',
      headers: {},
      createdAt: Date.now() - 200 * 60 * 60 * 1000, // 200 hours ago (> 48h TTL)
    })

    const result = await cache.get('key-old')
    expect(result).toBeNull()
  })

  it('evicts oldest entry when at max capacity', async () => {
    const cache = new InMemoryIdempotencyCache(2) // max 2

    await cache.set('key-1', { payloadHash: 'h1', status: 200, body: '', headers: {}, createdAt: Date.now() })
    await cache.set('key-2', { payloadHash: 'h2', status: 200, body: '', headers: {}, createdAt: Date.now() })
    expect(cache.size).toBe(2)

    await cache.set('key-3', { payloadHash: 'h3', status: 200, body: '', headers: {}, createdAt: Date.now() })
    // key-1 should have been evicted
    const first = await cache.get('key-1')
    expect(first).toBeNull()
    expect(cache.size).toBe(2)
  })
})
