/**
 * Nzila OS — Integration Runtime: Retry engine
 *
 * Exponential backoff with jitter for failed deliveries.
 */

export interface RetryOptions {
  readonly maxAttempts: number
  readonly baseDelayMs: number
  readonly maxDelayMs: number
  readonly jitter: boolean
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitter: true,
}

export function computeDelay(attempt: number, options: RetryOptions = DEFAULT_RETRY_OPTIONS): number {
  const exponential = Math.min(
    options.baseDelayMs * Math.pow(2, attempt - 1),
    options.maxDelayMs,
  )
  if (!options.jitter) return exponential
  return Math.floor(exponential * (0.5 + Math.random() * 0.5))
}

export function shouldRetry(attempt: number, maxAttempts: number): boolean {
  return attempt < maxAttempts
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<{ ok: true; data: T; attempts: number } | { ok: false; error: string; attempts: number }> {
  let lastError = ''
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      const data = await fn()
      return { ok: true, data, attempts: attempt }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (attempt < options.maxAttempts) {
        const delay = computeDelay(attempt, options)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  return { ok: false, error: lastError, attempts: options.maxAttempts }
}
