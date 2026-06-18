/**
 * @nzila/ai-core — Fallback Strategy Tests
 *
 * Integration tests for circuit breaker + fallback chains.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CircuitBreaker, executeWithFallback, withTimeout, DEFAULT_FALLBACK_STRATEGY } from '../src/fallback'

type ErrorWithCode = Error & { code?: string }

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    cb = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 50, // short timeout for testing
    })
  })

  it('starts in closed state', () => {
    expect(cb.getState('provider1')).toBe('closed')
    expect(cb.canAttempt('provider1')).toBe(true)
  })

  it('opens after failureThreshold failures', () => {
    for (let i = 0; i < 3; i++) {
      cb.recordFailure('provider1')
    }
    expect(cb.getState('provider1')).toBe('open')
    expect(cb.canAttempt('provider1')).toBe(false)
  })

  it('transitions to half-open after timeout', async () => {
    cb.recordFailure('provider1')
    cb.recordFailure('provider1')
    cb.recordFailure('provider1')
    expect(cb.getState('provider1')).toBe('open')

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(cb.canAttempt('provider1')).toBe(true)
    expect(cb.getState('provider1')).toBe('half-open')
  })

  it('closes after successThreshold successes in half-open', async () => {
    cb.recordFailure('provider1')
    cb.recordFailure('provider1')
    cb.recordFailure('provider1')

    // Wait for half-open
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(cb.getState('provider1')).toBe('half-open')

    cb.recordSuccess('provider1')
    cb.recordSuccess('provider1')
    expect(cb.getState('provider1')).toBe('closed')
  })

  it('reopens on failure while half-open', async () => {
    cb.recordFailure('provider1')
    cb.recordFailure('provider1')
    cb.recordFailure('provider1')

    // Wait for half-open
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(cb.getState('provider1')).toBe('half-open')

    cb.recordFailure('provider1')
    expect(cb.getState('provider1')).toBe('open')
  })

  it('resets provider state', () => {
    cb.recordFailure('provider1')
    cb.recordFailure('provider1')
    cb.recordFailure('provider1')
    expect(cb.getState('provider1')).toBe('open')

    cb.reset('provider1')
    expect(cb.getState('provider1')).toBe('closed')
  })
})

describe('withTimeout', () => {
  it('completes successfully before timeout', async () => {
    const result = await withTimeout(Promise.resolve('success'), 1000)
    expect(result).toBe('success')
  })

  it('throws timeout error if promise exceeds timeout', async () => {
    const slowPromise = new Promise((resolve) => setTimeout(() => resolve('slow'), 2000))
    await expect(withTimeout(slowPromise, 100)).rejects.toThrow(/Timeout/i)
  })

  it('includes label in timeout error', async () => {
    const slowPromise = new Promise((resolve) => setTimeout(() => resolve('slow'), 2000))
    await expect(withTimeout(slowPromise, 100, 'test-op')).rejects.toThrow(/test-op/)
  })
})

describe('executeWithFallback', () => {
  let cb: CircuitBreaker
  let callLog: string[]

  beforeEach(() => {
    cb = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 1,
      timeout: 100,
    })
    callLog = []
  })

  it('uses primary provider on success', async () => {
    const { result, providerUsed, fallbackAttempts } = await executeWithFallback({
      circuitBreaker: cb,
      strategy: DEFAULT_FALLBACK_STRATEGY,
      execute: async (provider) => {
        callLog.push(provider)
        if (provider === 'azure_openai') {
          return { result: 'success', providerUsed: provider }
        }
        throw new Error('Should not reach here')
      },
    })

    expect(result).toBe('success')
    expect(providerUsed).toBe('azure_openai')
    expect(fallbackAttempts).toBe(0)
    expect(callLog).toEqual(['azure_openai'])
  })

  it('falls back to secondary provider on retryable error', async () => {
    const { result, providerUsed, fallbackAttempts } = await executeWithFallback({
      circuitBreaker: cb,
      strategy: DEFAULT_FALLBACK_STRATEGY,
      execute: async (provider) => {
        callLog.push(provider)
        if (provider === 'azure_openai') {
          const err: ErrorWithCode = new Error('Quota exceeded')
          err.code = 'quota_exceeded'
          throw err
        }
        return { result: 'fallback_success', providerUsed: provider }
      },
    })

    expect(result).toBe('fallback_success')
    expect(providerUsed).toBe('openai')
    expect(fallbackAttempts).toBe(1)
    expect(callLog).toEqual(['azure_openai', 'openai'])
  })

  it('throws on non-retryable errors without fallback', async () => {
    await expect(
      executeWithFallback({
        circuitBreaker: cb,
        strategy: {
          providers: ['azure_openai', 'openai'],
          retryableErrors: ['quota_exceeded'], // only quota_exceeded is retryable
        },
        execute: async (provider) => {
          callLog.push(provider)
          const err: ErrorWithCode = new Error('Auth failed')
          err.code = 'auth_error'
          throw err
        },
      }),
    ).rejects.toThrow(/Auth failed/)

    // Should only have tried once (no fallback for non-retryable)
    expect(callLog).toEqual(['azure_openai'])
  })

  it('calls final fallback if all providers fail and final is provided', async () => {
    let finalCalled = false
    const { result } = await executeWithFallback({
      circuitBreaker: cb,
      strategy: {
        providers: ['azure_openai', 'openai'],
        retryableErrors: ['quota_exceeded'],
        final: async () => {
          finalCalled = true
          return 'final_fallback'
        },
      },
      execute: async (provider) => {
        callLog.push(provider)
        const err: ErrorWithCode = new Error('Quota exceeded')
        err.code = 'quota_exceeded'
        throw err
      },
    })

    expect(result).toBe('final_fallback')
    expect(finalCalled).toBe(true)
  })

  it('respects circuit breaker state', async () => {
    // Open circuit for azure_openai
    cb.recordFailure('azure_openai')

    const { result, providerUsed, fallbackAttempts } = await executeWithFallback({
      circuitBreaker: cb,
      strategy: DEFAULT_FALLBACK_STRATEGY,
      execute: async (provider) => {
        callLog.push(provider)
        if (provider === 'openai') {
          return { result: 'openai_success', providerUsed: provider }
        }
        throw new Error('Should not reach here')
      },
    })

    expect(result).toBe('openai_success')
    expect(providerUsed).toBe('openai')
    expect(fallbackAttempts).toBe(0)
    // azure_openai should have been skipped due to open circuit
    expect(callLog).toEqual(['openai'])
  })

  it('calls onFallback callback during fallback', async () => {
    const fallbackCallback = vi.fn()

    await executeWithFallback({
      circuitBreaker: cb,
      strategy: DEFAULT_FALLBACK_STRATEGY,
      execute: async (provider) => {
        if (provider === 'azure_openai') {
          const err: ErrorWithCode = new Error('Connection error')
          err.code = 'connection_error'
          throw err
        }
        return { result: 'fallback_success', providerUsed: provider }
      },
      onFallback: fallbackCallback,
    })

    expect(fallbackCallback).toHaveBeenCalledWith('azure_openai', 'openai', 'connection_error')
  })

  it('throws if all providers fail and no final fallback', async () => {
    await expect(
      executeWithFallback({
        circuitBreaker: cb,
        strategy: {
          providers: ['azure_openai', 'openai'],
          retryableErrors: ['quota_exceeded'],
        },
        execute: async (provider) => {
          const err: ErrorWithCode = new Error('All quotas exceeded')
          err.code = 'quota_exceeded'
          throw err
        },
      }),
    ).rejects.toThrow(/All quotas exceeded/)
  })
})
