import { describe, it, expect } from 'vitest'
import { ok, fail } from './mutation'

describe('ok()', () => {
  it('creates a success result', () => {
    const result = ok({ id: '1', name: 'test' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: '1', name: 'test' })
  })

  it('includes optional audit metadata', () => {
    const result = ok('done', { auditId: 'a-1', correlationId: 'c-1' })
    expect(result.auditId).toBe('a-1')
    expect(result.correlationId).toBe('c-1')
  })
})

describe('fail()', () => {
  it('creates a failure result', () => {
    const result = fail('NOT_FOUND', 'Item missing')
    expect(result.success).toBe(false)
    expect(result.error.code).toBe('NOT_FOUND')
    expect(result.error.message).toBe('Item missing')
  })

  it('includes optional correlation id', () => {
    const result = fail('CONFLICT', 'Duplicate', 'req-42')
    expect(result.correlationId).toBe('req-42')
  })
})
