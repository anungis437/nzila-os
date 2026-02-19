/**
 * Unit tests for sanitize and tool call entry creation.
 */
import { describe, it, expect } from 'vitest'
import { sanitize, hashSanitized, createToolCallEntry } from './sanitize'

describe('sanitize', () => {
  it('redacts known sensitive keys', () => {
    const input = {
      username: 'alice',
      password: 'hunter2',
      apiKey: 'sk-123',
      data: { token: 'tok-456' },
    }
    const result = sanitize(input) as Record<string, unknown>
    expect(result.username).toBe('alice')
    expect(result.password).toBe('[REDACTED]')
    expect(result.apiKey).toBe('[REDACTED]')
    expect((result.data as Record<string, unknown>).token).toBe('[REDACTED]')
  })

  it('preserves primitives', () => {
    expect(sanitize(42)).toBe(42)
    expect(sanitize('hello')).toBe('hello')
    expect(sanitize(true)).toBe(true)
    expect(sanitize(null)).toBe(null)
    expect(sanitize(undefined)).toBe(undefined)
  })

  it('sanitizes arrays deeply', () => {
    const input = [{ secret: 'x' }, { name: 'y' }]
    const result = sanitize(input) as Array<Record<string, unknown>>
    expect(result[0].secret).toBe('[REDACTED]')
    expect(result[1].name).toBe('y')
  })

  it('handles nested objects', () => {
    const input = { outer: { connectionString: 'Server=...' } }
    const result = sanitize(input) as Record<string, Record<string, unknown>>
    expect(result.outer.connectionString).toBe('[REDACTED]')
  })
})

describe('hashSanitized', () => {
  it('produces a hex SHA-256 string', () => {
    const hash = hashSanitized({ foo: 'bar' })
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces same hash for same input', () => {
    const a = hashSanitized({ a: 1 })
    const b = hashSanitized({ a: 1 })
    expect(a).toBe(b)
  })

  it('produces different hash for different input', () => {
    const a = hashSanitized({ a: 1 })
    const b = hashSanitized({ a: 2 })
    expect(a).not.toBe(b)
  })
})

describe('createToolCallEntry', () => {
  it('creates a properly shaped entry', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const end = new Date('2026-01-01T00:00:01Z')

    const entry = createToolCallEntry({
      toolName: 'test.tool',
      startedAt: start,
      finishedAt: end,
      inputs: { param: 'value' },
      outputs: { result: 'ok' },
      status: 'success',
    })

    expect(entry.toolName).toBe('test.tool')
    expect(entry.startedAt).toBe(start.toISOString())
    expect(entry.finishedAt).toBe(end.toISOString())
    expect(entry.inputsHash).toMatch(/^[a-f0-9]{64}$/)
    expect(entry.outputsHash).toMatch(/^[a-f0-9]{64}$/)
    expect(entry.status).toBe('success')
    expect(entry.error).toBeUndefined()
  })

  it('includes error when status is error', () => {
    const entry = createToolCallEntry({
      toolName: 'test.tool',
      startedAt: new Date(),
      finishedAt: new Date(),
      inputs: {},
      outputs: {},
      status: 'error',
      error: 'Something went wrong',
    })
    expect(entry.status).toBe('error')
    expect(entry.error).toBe('Something went wrong')
  })

  it('hashes redact sensitive data in inputs', () => {
    const entry1 = createToolCallEntry({
      toolName: 'test.tool',
      startedAt: new Date(),
      finishedAt: new Date(),
      inputs: { apiKey: 'sk-secret-1', name: 'test' },
      outputs: {},
      status: 'success',
    })
    const entry2 = createToolCallEntry({
      toolName: 'test.tool',
      startedAt: new Date(),
      finishedAt: new Date(),
      inputs: { apiKey: 'sk-secret-DIFFERENT', name: 'test' },
      outputs: {},
      status: 'success',
    })
    // apiKey is redacted before hashing, so hashes should be equal
    expect(entry1.inputsHash).toBe(entry2.inputsHash)
  })
})
