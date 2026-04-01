/**
 * @nzila/ai-core — Provider retry + circuit-breaker
 *
 * Wraps AI provider calls with:
 *  1. Exponential-backoff retry on transient failures (429, 500, 503)
 *  2. Per-provider circuit-breaker (CLOSED → OPEN → HALF-OPEN) to prevent
 *     cascading failures when a provider is degraded.
 *
 * NZ-RISK-022 — Provider outage / no fallback
 */

// ── Structured error for total provider unavailability ──────────────────────

export class AiProviderOutageError extends Error {
  readonly code = 'provider_outage'
  readonly statusCode = 503
  constructor(
    public readonly providerName: string,
    public readonly reason: string,
  ) {
    super(`AI provider '${providerName}' is unavailable: ${reason}`)
    this.name = 'AiProviderOutageError'
  }
}

// ── Circuit-breaker state ────────────────────────────────────────────────────

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerState {
  state: CircuitState
  failures: number
  lastFailureAt: number | null
  halfOpenAllowed: boolean
}

const FAILURE_THRESHOLD = 5        // failures in window before opening
const RESET_TIMEOUT_MS  = 60_000   // ms before attempting HALF-OPEN probe

const circuits = new Map<string, CircuitBreakerState>()

function getCircuit(name: string): CircuitBreakerState {
  if (!circuits.has(name)) {
    circuits.set(name, { state: 'CLOSED', failures: 0, lastFailureAt: null, halfOpenAllowed: true })
  }
  return circuits.get(name)!
}

function recordSuccess(name: string): void {
  const c = getCircuit(name)
  c.failures = 0
  c.state = 'CLOSED'
  c.halfOpenAllowed = true
}

function recordFailure(name: string): void {
  const c = getCircuit(name)
  c.failures += 1
  c.lastFailureAt = Date.now()
  if (c.failures >= FAILURE_THRESHOLD) {
    c.state = 'OPEN'
    c.halfOpenAllowed = false
  }
}

function isAllowed(name: string): boolean {
  const c = getCircuit(name)
  if (c.state === 'CLOSED') return true
  if (c.state === 'OPEN') {
    // Attempt transition to HALF-OPEN after timeout
    if (c.lastFailureAt && Date.now() - c.lastFailureAt >= RESET_TIMEOUT_MS) {
      c.state = 'HALF_OPEN'
      c.halfOpenAllowed = true
    } else {
      return false
    }
  }
  // HALF-OPEN: allow one probe
  if (c.halfOpenAllowed) {
    c.halfOpenAllowed = false // only one probe at a time
    return true
  }
  return false
}

// ── Retry helpers ────────────────────────────────────────────────────────────

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message
    // Look for HTTP status codes in the error message string (providers throw with status)
    const match = /(\d{3})/.exec(msg)
    if (match) {
      return RETRYABLE_STATUSES.has(Number(match[1]))
    }
    // Network-level transient errors
    if (/ECONNRESET|ETIMEDOUT|socket hang up|network/i.test(msg)) return true
  }
  return false
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ── Main export ──────────────────────────────────────────────────────────────

export interface RetryOptions {
  /** Logical name for the provider (used for circuit breaker keying). */
  providerName: string
  /** Maximum number of attempts (default 3). */
  maxAttempts?: number
  /** Base delay in ms for exponential backoff (default 500). */
  baseDelayMs?: number
}

/**
 * Execute an async AI provider call with retry + circuit-breaker protection.
 *
 * - Retries up to `maxAttempts` times with exponential backoff on transient errors.
 * - Tracks failures in the circuit breaker; opens the circuit after 5 consecutive failures.
 * - Throws `AiProviderOutageError` if the circuit is open (not just a transient failure).
 *
 * @example
 * const result = await withRetry(() => provider.generate(params), { providerName: 'openai' })
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const { providerName, maxAttempts = 3, baseDelayMs = 500 } = opts

  if (!isAllowed(providerName)) {
    throw new AiProviderOutageError(
      providerName,
      'Circuit breaker is OPEN — provider is temporarily unavailable. Retry in ~60 seconds.',
    )
  }

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn()
      recordSuccess(providerName)
      return result
    } catch (error) {
      lastError = error
      if (!isRetryableError(error) || attempt === maxAttempts) break
      const delay = baseDelayMs * Math.pow(2, attempt - 1) // 500, 1000, 2000 …
      await sleep(delay)
    }
  }

  recordFailure(providerName)

  // If the circuit just opened, surface as outage
  const c = getCircuit(providerName)
  if (c.state === 'OPEN') {
    throw new AiProviderOutageError(
      providerName,
      `Circuit opened after ${c.failures} failures. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    )
  }

  throw lastError
}
