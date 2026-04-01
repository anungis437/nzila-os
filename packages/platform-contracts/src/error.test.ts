import { describe, it, expect } from 'vitest'
import {
  createPlatformError,
  getHttpStatus,
  platformErrorSchema,
  type PlatformErrorCode,
} from './error.js'

describe('createPlatformError', () => {
  it('creates error with correct category', () => {
    const err = createPlatformError('AUTH_REQUIRED', 'Please sign in')
    expect(err.code).toBe('AUTH_REQUIRED')
    expect(err.category).toBe('auth')
    expect(err.message).toBe('Please sign in')
    expect(err.retryable).toBe(false)
  })

  it('marks rate-limited as retryable', () => {
    const err = createPlatformError('RATE_LIMITED', 'Slow down')
    expect(err.retryable).toBe(true)
  })

  it('marks service unavailable as retryable', () => {
    const err = createPlatformError('SERVICE_UNAVAILABLE', 'Try later')
    expect(err.retryable).toBe(true)
  })

  it('includes optional fields', () => {
    const err = createPlatformError('VALIDATION_ERROR', 'Bad input', {
      correlationId: 'req-123',
      details: { hint: 'check email' },
      fieldErrors: [{ field: 'email', message: 'invalid' }],
    })
    expect(err.correlationId).toBe('req-123')
    expect(err.details).toEqual({ hint: 'check email' })
    expect(err.fieldErrors).toHaveLength(1)
  })

  it('passes zod validation', () => {
    const err = createPlatformError('NOT_FOUND', 'Resource missing')
    const result = platformErrorSchema.safeParse(err)
    expect(result.success).toBe(true)
  })
})

describe('getHttpStatus', () => {
  it.each<[PlatformErrorCode, number]>([
    ['AUTH_REQUIRED', 401],
    ['ACCESS_DENIED', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['VALIDATION_ERROR', 422],
    ['RATE_LIMITED', 429],
    ['INTERNAL_ERROR', 500],
    ['SERVICE_UNAVAILABLE', 503],
  ])('maps %s to %d', (code, expected) => {
    expect(getHttpStatus(code)).toBe(expected)
  })
})
