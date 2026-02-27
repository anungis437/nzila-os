import { describe, it, expect } from 'vitest'
import { InMemoryIdempotencyStore, verifyInboundWebhook } from './inbound'

async function signPayload(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `sha256=${hex}`
}

describe('InMemoryIdempotencyStore', () => {
  it('tracks keys and enforces max size', async () => {
    const store = new InMemoryIdempotencyStore(3)
    await store.add('a')
    await store.add('b')
    await store.add('c')
    expect(store.size).toBe(3)
    expect(await store.has('a')).toBe(true)

    await store.add('d')
    expect(store.size).toBe(3)
    expect(await store.has('a')).toBe(false) // evicted
    expect(await store.has('d')).toBe(true)
  })
})

describe('verifyInboundWebhook', () => {
  const secret = 'test-secret-for-hmac-verification'

  it('verifies valid HMAC signature', async () => {
    const body = JSON.stringify({ event: 'test', idempotencyKey: 'key-1' })
    const signature = await signPayload(secret, body)
    const store = new InMemoryIdempotencyStore()

    const result = await verifyInboundWebhook(
      { headers: {}, body, signature },
      { secret, idempotencyStore: store },
    )

    expect(result.verified).toBe(true)
    expect(result.parsed).toEqual({ event: 'test', idempotencyKey: 'key-1' })
  })

  it('rejects invalid signature', async () => {
    const body = JSON.stringify({ event: 'test' })
    const store = new InMemoryIdempotencyStore()

    const result = await verifyInboundWebhook(
      { headers: {}, body, signature: 'sha256=invalid' },
      { secret, idempotencyStore: store },
    )

    expect(result.verified).toBe(false)
    expect(result.error).toBe('Invalid HMAC signature')
  })

  it('detects duplicate idempotency keys', async () => {
    const body = JSON.stringify({ event: 'test', idempotencyKey: 'dup-1' })
    const signature = await signPayload(secret, body)
    const store = new InMemoryIdempotencyStore()

    // First call succeeds
    const r1 = await verifyInboundWebhook(
      { headers: {}, body, signature },
      { secret, idempotencyStore: store },
    )
    expect(r1.verified).toBe(true)
    expect(r1.error).toBeUndefined()

    // Second call detects duplicate
    const r2 = await verifyInboundWebhook(
      { headers: {}, body, signature },
      { secret, idempotencyStore: store },
    )
    expect(r2.verified).toBe(true)
    expect(r2.error).toContain('Duplicate delivery')
  })
})
