import { NextResponse } from 'next/server'
import { checkRateLimit, type RateLimitConfig } from '@/lib/rate-limiter'

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

export function clientAddress(request: Request): string {
  const direct = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip')
  if (direct) return direct
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
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
  options: { bucket: PublicIntakeBucket; readBody?: boolean; maxBodyBytes?: number },
): Promise<PublicIntake> {
  const config: RateLimitConfig = { ...PUBLIC_INTAKE_BUCKETS[options.bucket], failOpen: process.env.NODE_ENV !== 'production' }
  const limit = await checkRateLimit(`ip:${clientAddress(request)}`, config)
  if (!limit.allowed) {
    return refuse(limit.error ? 503 : 429, limit.error ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED', 'Too many requests. Please try again later.', {
      'Retry-After': String(limit.resetIn),
    })
  }
  if (options.readBody === false) return { ok: true, json: undefined }

  const max = options.maxBodyBytes ?? PUBLIC_INTAKE_MAX_BODY_BYTES
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > max) return refuse(413, 'BODY_TOO_LARGE', 'The request is too large.')
  const text = await request.text()
  if (new TextEncoder().encode(text).length > max) return refuse(413, 'BODY_TOO_LARGE', 'The request is too large.')
  if (text.trim() === '') return { ok: true, json: undefined }
  try {
    return { ok: true, json: JSON.parse(text) }
  } catch {
    return refuse(400, 'INVALID_JSON', 'Invalid JSON body.')
  }
}
