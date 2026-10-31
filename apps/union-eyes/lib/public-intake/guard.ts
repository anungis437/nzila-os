import { NextResponse } from 'next/server'
import { checkRateLimit, type RateLimitConfig } from '@/lib/rate-limiter'
import { requireBotChallenge } from '@/lib/public-intake/bot-challenge'

/**
 * Bounded controls for the few routes that must accept writes without a session (UE-CONV-K-008 public allowlist).
 * A public write is not authorised by identity, so it is bounded instead: a per-client rate limit that refuses when
 * the limiter is unavailable (outside development), a hard cap on the request body, and strict JSON parsing. The
 * routes themselves must also keep their downstream authority minimal: nothing created here may grant access to
 * tenant data.
 */
export const PUBLIC_INTAKE_BUCKETS = {
  /** Form-like writes: contact, workbook start, assessment start. */
  write: { limit: 20, window: 3600, identifier: 'public-intake-write' },
  /** Anything that opens a payment session. */
  checkout: { limit: 10, window: 3600, identifier: 'public-intake-checkout' },
  /** Routes whose only protection is a bearer capability; slows guessing. */
  capability: { limit: 60, window: 600, identifier: 'public-intake-capability' },
} as const satisfies Record<string, RateLimitConfig>

export type PublicIntakeBucket = keyof typeof PUBLIC_INTAKE_BUCKETS

export const PUBLIC_INTAKE_MAX_BODY_BYTES = 16 * 1024

/**
 * The client address a limiter may key on. The edge-set headers win. Otherwise the forwarded-for list is read from the right,
 * at the number of trusted proxy hops (TRUSTED_PROXY_HOPS, default 1): the first entry is whatever the client typed, so keying on
 * it let a caller pick a fresh bucket on every request.
 */
export function clientAddress(request: Request): string {
  const direct = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip')
  if (direct) return direct
  const chain = (request.headers.get('x-forwarded-for') ?? '').split(',').map((part) => part.trim()).filter(Boolean)
  if (chain.length === 0) return 'unknown'
  const parsed = Number(process.env.TRUSTED_PROXY_HOPS ?? '1')
  const hops = Number.isInteger(parsed) && parsed >= 1 ? parsed : 1
  return chain[Math.max(0, chain.length - hops)]
}

export type PublicIntake = { ok: true; json: unknown } | { ok: false; response: NextResponse }

const refuse = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  ({ ok: false, response: NextResponse.json({ error: { code, message } }, { status, headers }) }) as const

/**
 * Applies the bucket, then reads the body under the size cap. Pass `readBody: false` for routes with no body.
 * Returns the parsed JSON, or the refusal to send.
 */
export async function guardPublicIntake(
  request: Request,
  options: { bucket: PublicIntakeBucket; readBody?: boolean; maxBodyBytes?: number; challenge?: boolean },
): Promise<PublicIntake> {
  const config: RateLimitConfig = { ...PUBLIC_INTAKE_BUCKETS[options.bucket], failOpen: process.env.NODE_ENV !== 'production' }
  const limit = await checkRateLimit(`ip:${clientAddress(request)}`, config)
  if (!limit.allowed) {
    return refuse(limit.error ? 503 : 429, limit.error ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED', 'Too many requests. Please try again later.', {
      'Retry-After': String(limit.resetIn),
    })
  }
  // A challenged route reads the Turnstile token from the x-turnstile-token header or, for a JSON body, its turnstileToken field.
  const challenged = async (json: unknown): Promise<PublicIntake> => {
    if (!options.challenge) return { ok: true, json }
    const fromBody = json && typeof json === 'object' ? (json as Record<string, unknown>).turnstileToken : undefined
    const token = request.headers.get('x-turnstile-token') ?? (typeof fromBody === 'string' ? fromBody : null)
    const verdict = await requireBotChallenge(token, clientAddress(request))
    if (!verdict.ok) return refuse(verdict.status, verdict.code, verdict.message)
    if (json && typeof json === 'object' && 'turnstileToken' in (json as object)) {
      const { turnstileToken: _dropped, ...rest } = json as Record<string, unknown>
      return { ok: true, json: rest }
    }
    return { ok: true, json }
  }

  if (options.readBody === false) return challenged(undefined)

  const max = options.maxBodyBytes ?? PUBLIC_INTAKE_MAX_BODY_BYTES
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > max) return refuse(413, 'BODY_TOO_LARGE', 'The request is too large.')
  // A post-read size check is insufficient: request.text() buffers the entire
  // attacker-controlled payload before enforcing the limit. Stop reading as soon
  // as the byte cap is crossed, including for chunked requests with no length.
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let bytes = 0
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        if (bytes > max) {
          await reader.cancel().catch(() => undefined)
          return refuse(413, 'BODY_TOO_LARGE', 'The request is too large.')
        }
        chunks.push(value)
      }
    } catch {
      return refuse(400, 'INVALID_BODY', 'Unable to read request body.')
    } finally {
      reader.releaseLock()
    }
  }
  const payload = new Uint8Array(bytes)
  let offset = 0
  for (const chunk of chunks) {
    payload.set(chunk, offset)
    offset += chunk.byteLength
  }
  const text = new TextDecoder().decode(payload)
  if (text.trim() === '') return challenged(undefined)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return refuse(400, 'INVALID_JSON', 'Invalid JSON body.')
  }
  return challenged(parsed)
}
