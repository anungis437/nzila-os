import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ checkRateLimit: vi.fn() }))
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit }))

import { PUBLIC_INTAKE_MAX_BODY_BYTES, clientAddress, guardPublicIntake } from '../guard'

const post = (body: string | undefined, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/x', { method: 'POST', body, headers: { 'content-type': 'application/json', ...headers } })

describe('public intake guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.checkRateLimit.mockResolvedValue({ allowed: true, current: 1, limit: 20, remaining: 19, resetIn: 3600 })
  })

  it('returns the parsed body when the client is within its bucket', async () => {
    const result = await guardPublicIntake(post('{"a":1}'), { bucket: 'write' })
    expect(result).toEqual({ ok: true, json: { a: 1 } })
    expect(m.checkRateLimit).toHaveBeenCalledWith('ip:unknown', expect.objectContaining({ identifier: 'public-intake-write' }))
  })

  it('keys the bucket on the client address, preferring the edge-set header', async () => {
    expect(clientAddress(post('{}', { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
    expect(clientAddress(post('{}'))).toBe('unknown')
  })

  // DEF-0B8-ICRA-RATE-LIMITS-PER-PROCESS-AND-KEYED-ON-REQUEST-HEADER-ADDRESS
  // Replaced: this test expected the first (client-typed) forwarded-for entry.
  it('reads the forwarded-for list from the right, so a client-typed first entry does not choose the bucket', async () => {
    expect(clientAddress(post('{}', { 'x-forwarded-for': '9.9.9.9, 2.2.2.2' }))).toBe('2.2.2.2')
    expect(clientAddress(post('{}', { 'x-forwarded-for': '1.2.3.4' }))).toBe('1.2.3.4')
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2')
    expect(clientAddress(post('{}', { 'x-forwarded-for': '9.9.9.9, 2.2.2.2, 3.3.3.3' }))).toBe('2.2.2.2')
    vi.unstubAllEnvs()
  })

  it('answers 429 over the limit, and never reads the body', async () => {
    m.checkRateLimit.mockResolvedValue({ allowed: false, current: 21, limit: 20, remaining: 0, resetIn: 120 })
    const request = post('{"a":1}')
    const text = vi.spyOn(request, 'text')
    const result = await guardPublicIntake(request, { bucket: 'write' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(429)
      expect(result.response.headers.get('Retry-After')).toBe('120')
    }
    expect(text).not.toHaveBeenCalled()
  })

  it('answers 503 rather than allowing the request when the limiter is unavailable', async () => {
    m.checkRateLimit.mockResolvedValue({ allowed: false, current: 0, limit: 20, remaining: 0, resetIn: 3600, error: 'Rate limiting service unavailable.' })
    const result = await guardPublicIntake(post('{}'), { bucket: 'checkout' })
    expect(result.ok === false && result.response.status).toBe(503)
  })

  it('refuses a body over the cap, declared or actual', async () => {
    const big = JSON.stringify({ x: 'y'.repeat(PUBLIC_INTAKE_MAX_BODY_BYTES) })
    const declared = await guardPublicIntake(post('{}', { 'content-length': String(PUBLIC_INTAKE_MAX_BODY_BYTES + 1) }), { bucket: 'write' })
    expect(declared.ok === false && declared.response.status).toBe(413)
    const actual = await guardPublicIntake(post(big), { bucket: 'write' })
    expect(actual.ok === false && actual.response.status).toBe(413)
  })

  it('refuses malformed JSON, and treats an empty body as no payload', async () => {
    const bad = await guardPublicIntake(post('{'), { bucket: 'write' })
    expect(bad.ok === false && bad.response.status).toBe(400)
    expect(await guardPublicIntake(post(undefined), { bucket: 'write' })).toEqual({ ok: true, json: undefined })
  })

  it('applies only the limit for a route with no body', async () => {
    const request = post('ignored')
    const text = vi.spyOn(request, 'text')
    expect(await guardPublicIntake(request, { bucket: 'capability', readBody: false })).toEqual({ ok: true, json: undefined })
    expect(text).not.toHaveBeenCalled()
  })
})
