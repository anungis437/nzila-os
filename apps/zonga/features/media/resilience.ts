/**
 * Zonga — Media Service Resilience
 *
 * Pre-configured circuit breakers for external AWS dependencies.
 * Uses the platform-level CircuitBreaker from @nzila/os-core.
 *
 * Each AWS service gets its own breaker so a CloudFront blip
 * doesn't block MediaConvert submissions (and vice-versa).
 */

import { CircuitBreaker, retry, withTimeout } from '@nzila/os-core/resilience'
import { logger } from '@/lib/logger'

function onStateChange(from: string, to: string, name: string) {
  logger.warn(`Circuit breaker [${name}] ${from} → ${to}`)
}

// ── CloudFront (signed URL generation) ──────────────────────────────────────
export const cloudFrontBreaker = new CircuitBreaker({
  name: 'zonga:cloudfront',
  failureThreshold: 3,
  resetTimeoutMs: 15_000,
  successThreshold: 1,
  onStateChange,
})

// ── MediaConvert (transcode job submission + polling) ───────────────────────
export const mediaConvertBreaker = new CircuitBreaker({
  name: 'zonga:mediaconvert',
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
  onStateChange,
})

// ── IVS (live stream provisioning) ─────────────────────────────────────────
export const ivsBreaker = new CircuitBreaker({
  name: 'zonga:ivs',
  failureThreshold: 3,
  resetTimeoutMs: 30_000,
  successThreshold: 2,
  onStateChange,
})

/**
 * Execute an AWS call with circuit breaker + timeout + retry.
 *
 * Good defaults for most AWS SDK calls: 10s timeout, 2 retries,
 * exponential backoff with jitter.
 */
export async function resilientAwsCall<T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>,
  opts?: { timeoutMs?: number; maxAttempts?: number },
): Promise<T> {
  const { timeoutMs = 10_000, maxAttempts = 2 } = opts ?? {}

  return breaker.execute(() =>
    retry(
      () => withTimeout(fn, { timeoutMs, name: 'aws-call' }),
      { maxAttempts, initialDelayMs: 500, retryIf: isTransient },
    ),
  )
}

/** Only retry on transient / network errors, not on 4xx business errors. */
function isTransient(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('socket hang up')) return true
    // AWS SDK v3 throttle
    if ('$metadata' in (err as unknown as Record<string, unknown>)) {
      const status = (err as unknown as Record<string, unknown>)['$metadata'] as Record<string, unknown> | undefined
      return status?.httpStatusCode === 429 || status?.httpStatusCode === 503
    }
  }
  return false
}
