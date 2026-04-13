/**
 * Webhook Verification — Unit Tests
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyWebhookSignature, computeHmacSha256 } from '../webhook-verify'

const SECRET = 'test-secret-key-123'
const BODY = '{"event":"test","data":{"id":"123"}}'

function computeSignature(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

describe('verifyWebhookSignature', () => {
  it('accepts valid raw HMAC signature', () => {
    const sig = computeSignature(BODY, SECRET)
    const result = verifyWebhookSignature({
      body: BODY,
      signature: sig,
      secret: SECRET,
      provider: 'test',
    })

    expect(result.valid).toBe(true)
    expect(result.provider).toBe('test')
  })

  it('accepts valid sha256= prefixed signature', () => {
    const sig = `sha256=${computeSignature(BODY, SECRET)}`
    const result = verifyWebhookSignature({
      body: BODY,
      signature: sig,
      secret: SECRET,
      provider: 'github',
    })

    expect(result.valid).toBe(true)
  })

  it('accepts valid v1= prefixed signature', () => {
    const sig = `v1=${computeSignature(BODY, SECRET)}`
    const result = verifyWebhookSignature({
      body: BODY,
      signature: sig,
      secret: SECRET,
      provider: 'slack',
    })

    expect(result.valid).toBe(true)
  })

  it('accepts valid sha1= prefixed signature', () => {
    const sig = `sha1=${computeSignature(BODY, SECRET)}`
    const result = verifyWebhookSignature({
      body: BODY,
      signature: sig,
      secret: SECRET,
      provider: 'legacy',
    })

    expect(result.valid).toBe(true)
  })

  it('rejects invalid signature', () => {
    const result = verifyWebhookSignature({
      body: BODY,
      signature: 'deadbeefcafebabe0000000000000000000000000000000000000000000000000',
      secret: SECRET,
      provider: 'test',
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('rejects tampered body', () => {
    const sig = computeSignature(BODY, SECRET)
    const result = verifyWebhookSignature({
      body: BODY + ' tampered',
      signature: sig,
      secret: SECRET,
      provider: 'test',
    })

    expect(result.valid).toBe(false)
  })

  it('rejects stale timestamp', () => {
    const sig = computeSignature(BODY, SECRET)
    const staleTimestamp = new Date(Date.now() - 600_000).toISOString() // 10 min ago

    const result = verifyWebhookSignature({
      body: BODY,
      signature: sig,
      secret: SECRET,
      provider: 'test',
      timestamp: staleTimestamp,
      maxAgeSeconds: 300,
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Timestamp too old')
  })

  it('accepts fresh timestamp', () => {
    const sig = computeSignature(BODY, SECRET)
    const freshTimestamp = new Date().toISOString()

    const result = verifyWebhookSignature({
      body: BODY,
      signature: sig,
      secret: SECRET,
      provider: 'test',
      timestamp: freshTimestamp,
    })

    expect(result.valid).toBe(true)
  })

  it('handles Buffer body', () => {
    const sig = computeSignature(BODY, SECRET)
    const result = verifyWebhookSignature({
      body: Buffer.from(BODY),
      signature: sig,
      secret: SECRET,
      provider: 'test',
    })

    expect(result.valid).toBe(true)
  })

  it('returns verification error when signature payload is malformed', () => {
    const result = verifyWebhookSignature({
      body: BODY,
      signature: null as unknown as string,
      secret: SECRET,
      provider: 'test',
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Verification error')
  })

  it('rejects signature length mismatch', () => {
    const result = verifyWebhookSignature({
      body: BODY,
      signature: 'abcd',
      secret: SECRET,
      provider: 'test',
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('Signature length mismatch')
  })

  it('handles non-Error throwables during verification', () => {
    const result = verifyWebhookSignature({
      body: {
        toString: () => {
          throw 'body stringify failed'
        },
      } as unknown as Buffer,
      signature: computeSignature(BODY, SECRET),
      secret: SECRET,
      provider: 'test',
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('body stringify failed')
  })
})

describe('computeHmacSha256', () => {
  it('produces correct HMAC', () => {
    const expected = createHmac('sha256', SECRET).update(BODY).digest('hex')
    expect(computeHmacSha256(SECRET, BODY)).toBe(expected)
  })
})
