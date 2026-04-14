/**
 * @nzila/ai-core — Circuit Breaker & Fallback Strategy
 *
 * Implements circuit breaker pattern (open/half-open/closed) with fallback providers.
 * Prevents cascading failures by fast-failing and allowing provider recovery.
 */

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  failureThreshold: number // failures before opening (default: 5)
  successThreshold: number // successes while half-open to close (default: 2)
  timeout: number // ms to wait before half-open (default: 30s)
}

export interface CircuitBreakerMetrics {
  failures: number
  successes: number
  lastFailureTime?: number
  lastSuccessTime?: number
  state: CircuitState
}

/**
 * Circuit breaker: tracks provider health and fast-fails when degraded.
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig
  private metrics: Map<string, CircuitBreakerMetrics> = new Map()

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 2,
      timeout: config.timeout ?? 30_000, // 30 seconds
    }
  }

  /**
   * Check if provider is available (not open).
   * If half-open and timeout expired, try recovery.
   */
  canAttempt(providerKey: string): boolean {
    let metrics = this.metrics.get(providerKey)
    if (!metrics) {
      metrics = { failures: 0, successes: 0, state: 'closed' }
      this.metrics.set(providerKey, metrics)
      return true
    }

    if (metrics.state === 'closed') {
      return true
    }

    if (metrics.state === 'open') {
      const timeSinceFailure = Date.now() - (metrics.lastFailureTime ?? 0)
      if (timeSinceFailure > this.config.timeout) {
        // Try half-open recovery
        metrics.state = 'half-open'
        metrics.successes = 0
        return true
      }
      return false
    }

    // half-open: allow attempt
    return true
  }

  /**
   * Record success: move toward closed if half-open.
   */
  recordSuccess(providerKey: string): void {
    let metrics = this.metrics.get(providerKey)
    if (!metrics) {
      metrics = { failures: 0, successes: 0, state: 'closed' }
      this.metrics.set(providerKey, metrics)
    }

    metrics.failures = 0
    metrics.successes += 1
    metrics.lastSuccessTime = Date.now()

    if (metrics.state === 'half-open' && metrics.successes >= this.config.successThreshold) {
      metrics.state = 'closed'
      metrics.successes = 0
    }
  }

  /**
   * Record failure: move toward open if threshold exceeded.
   */
  recordFailure(providerKey: string): void {
    let metrics = this.metrics.get(providerKey)
    if (!metrics) {
      metrics = { failures: 0, successes: 0, state: 'closed' }
      this.metrics.set(providerKey, metrics)
    }

    metrics.failures += 1
    metrics.lastFailureTime = Date.now()

    if (metrics.state === 'half-open') {
      // Failure while half-open: reopen
      metrics.state = 'open'
      metrics.successes = 0
    } else if (metrics.state === 'closed' && metrics.failures >= this.config.failureThreshold) {
      metrics.state = 'open'
    }
  }

  getState(providerKey: string): CircuitState {
    return this.metrics.get(providerKey)?.state ?? 'closed'
  }

  getMetrics(providerKey: string): CircuitBreakerMetrics {
    return (
      this.metrics.get(providerKey) ?? {
        failures: 0,
        successes: 0,
        state: 'closed',
      }
    )
  }

  reset(providerKey: string): void {
    this.metrics.delete(providerKey)
  }
}

/**
 * Fallback strategy: ordered list of provider keys to try if primary fails.
 *
 * Example: ['azure_openai', 'openai'] means try Azure first, fall back to OpenAI.
 */
export interface FallbackStrategy {
  providers: string[] // ordered list
  retryableErrors: string[] // error codes to retry (default: network, timeout, quota)
  final?: () => Promise<string> // fallback if all providers fail (e.g., cached result, rules-based answer)
}

export const DEFAULT_FALLBACK_STRATEGY: FallbackStrategy = {
  providers: ['azure_openai', 'openai'],
  retryableErrors: ['provider_error', 'timeout', 'quota_exceeded', 'rate_limited', 'connection_error'],
}

/**
 * Execute with fallback: try primary provider, fall back to others on retryable errors.
 */
export async function executeWithFallback<T>(opts: {
  circuitBreaker: CircuitBreaker
  strategy: FallbackStrategy
  execute: (providerKey: string) => Promise<{ result: T; providerUsed: string }>
  onFallback?: (from: string, to: string, reason: string) => void
}): Promise<{ result: T; providerUsed: string; fallbackAttempts: number }> {
  let lastError: Error | null = null
  let fallbackAttempts = 0

  for (let i = 0; i < opts.strategy.providers.length; i++) {
    const providerKey = opts.strategy.providers[i]

    // Check circuit breaker
    if (!opts.circuitBreaker.canAttempt(providerKey)) {
      lastError = new Error(`Circuit breaker open for ${providerKey}`)
      continue
    }

    try {
      const { result, providerUsed } = await opts.execute(providerKey)
      opts.circuitBreaker.recordSuccess(providerKey)
      return { result, providerUsed, fallbackAttempts }
    } catch (err) {
      const errorCode = (err as any)?.code ?? 'unknown_error'
      const isRetryable = opts.strategy.retryableErrors.includes(errorCode)

      opts.circuitBreaker.recordFailure(providerKey)
      lastError = err as Error

      // If retryable and there are more providers, attempt fallback
      if (isRetryable && i < opts.strategy.providers.length - 1) {
        const nextProvider = opts.strategy.providers[i + 1]
        opts.onFallback?.(providerKey, nextProvider, errorCode)
        fallbackAttempts += 1
        continue
      }

      // Non-retryable error or last provider: rethrow
      throw err
    }
  }

  // All providers exhausted: try final fallback if provided
  if (opts.strategy.final) {
    try {
      const finalResult = await opts.strategy.final()
      return { result: finalResult as T, providerUsed: 'fallback_final', fallbackAttempts }
    } catch (err) {
      // Final fallback failed
    }
  }

  throw lastError ?? new Error('All providers failed and no fallback available')
}

/**
 * Timeout guard: wrap an async operation with a maximum execution time.
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label?: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms${label ? ` (${label})` : ''}`)), timeoutMs),
    ),
  ])
}
