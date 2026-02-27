import { describe, it, expect } from 'vitest'
import { computeDelay, shouldRetry, withRetry, DEFAULT_RETRY_OPTIONS } from './retry'

describe('Retry engine', () => {
  it('computeDelay returns exponential backoff', () => {
    const opts = { ...DEFAULT_RETRY_OPTIONS, jitter: false }
    expect(computeDelay(1, opts)).toBe(1_000)
    expect(computeDelay(2, opts)).toBe(2_000)
    expect(computeDelay(3, opts)).toBe(4_000)
  })

  it('computeDelay caps at maxDelayMs', () => {
    const opts = { ...DEFAULT_RETRY_OPTIONS, jitter: false, maxDelayMs: 3_000 }
    expect(computeDelay(10, opts)).toBe(3_000)
  })

  it('shouldRetry returns true when under limit', () => {
    expect(shouldRetry(1, 3)).toBe(true)
    expect(shouldRetry(2, 3)).toBe(true)
    expect(shouldRetry(3, 3)).toBe(false)
  })

  it('withRetry returns data on first success', async () => {
    const result = await withRetry(
      async () => 'ok',
      { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0, jitter: false },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toBe('ok')
      expect(result.attempts).toBe(1)
    }
  })

  it('withRetry retries then succeeds', async () => {
    let calls = 0
    const result = await withRetry(
      async () => {
        calls++
        if (calls < 3) throw new Error('fail')
        return 'done'
      },
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 50, jitter: false },
    )
    expect(result.ok).toBe(true)
    expect(result.attempts).toBe(3)
  })

  it('withRetry exhausts attempts and returns error', async () => {
    const result = await withRetry(
      async () => { throw new Error('always fails') },
      { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50, jitter: false },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('always fails')
      expect(result.attempts).toBe(2)
    }
  })
})
