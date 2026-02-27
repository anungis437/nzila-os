/**
 * Nzila OS — Webhooks: Inbound Verification
 *
 * HMAC-SHA256 signature verification for incoming webhooks.
 * Replay protection via idempotency keys.
 */
import type { InboundWebhookPayload, InboundWebhookResult } from './types'

// ── HMAC verification ───────────────────────────────────────────────────────

async function verifyHmacSha256(
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const expectedHex = Array.from(new Uint8Array(expected))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Strip prefix if present (e.g. "sha256=...")
  const cleanSignature = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature

  // Constant-time comparison
  if (cleanSignature.length !== expectedHex.length) return false
  let mismatch = 0
  for (let i = 0; i < cleanSignature.length; i++) {
    mismatch |= cleanSignature.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  }
  return mismatch === 0
}

// ── Idempotency store port ──────────────────────────────────────────────────

export interface IdempotencyStore {
  /** Returns true if this key was already processed */
  has(key: string): Promise<boolean>
  /** Mark key as processed */
  add(key: string): Promise<void>
}

/** In-memory implementation for testing / single-instance deployments */
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly keys = new Set<string>()
  private readonly maxSize: number

  constructor(maxSize = 10_000) {
    this.maxSize = maxSize
  }

  async has(key: string): Promise<boolean> {
    return this.keys.has(key)
  }

  async add(key: string): Promise<void> {
    // Evict oldest if at capacity (simple FIFO via array rebuild)
    if (this.keys.size >= this.maxSize) {
      const first = this.keys.values().next().value
      if (first !== undefined) this.keys.delete(first)
    }
    this.keys.add(key)
  }

  get size(): number {
    return this.keys.size
  }
}

// ── Inbound verifier ────────────────────────────────────────────────────────

export interface InboundWebhookVerifierOptions {
  secret: string
  idempotencyStore: IdempotencyStore
}

export async function verifyInboundWebhook(
  input: InboundWebhookPayload,
  options: InboundWebhookVerifierOptions,
): Promise<InboundWebhookResult> {
  // 1. Verify HMAC signature
  const valid = await verifyHmacSha256(options.secret, input.body, input.signature)
  if (!valid) {
    return { verified: false, parsed: null, error: 'Invalid HMAC signature' }
  }

  // 2. Parse body
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(input.body) as Record<string, unknown>
  } catch {
    return { verified: false, parsed: null, error: 'Invalid JSON body' }
  }

  // 3. Check idempotency key
  const idempotencyKey = parsed['idempotencyKey']
  if (typeof idempotencyKey === 'string') {
    const alreadyProcessed = await options.idempotencyStore.has(idempotencyKey)
    if (alreadyProcessed) {
      return { verified: true, parsed, error: 'Duplicate delivery (idempotency key already processed)' }
    }
    await options.idempotencyStore.add(idempotencyKey)
  }

  return { verified: true, parsed }
}
