import { describe, expect, it } from 'vitest'
import { traceContextSchema, healthCheckResultSchema } from './types'

describe('Zod 4 observability boundary', () => {
  it('accepts valid trace and health statuses', () => {
    expect(traceContextSchema.safeParse({ traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), parentSpanId: null, traceFlags: 1 }).success).toBe(true)
    expect(healthCheckResultSchema.safeParse({ name: 'api', status: 'healthy', latencyMs: 1 }).success).toBe(true)
  })
  it('rejects invalid trace flags and health statuses', () => {
    expect(traceContextSchema.safeParse({ traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), parentSpanId: null, traceFlags: 256 }).success).toBe(false)
    expect(healthCheckResultSchema.safeParse({ name: 'api', status: 'unknown', latencyMs: 1 }).success).toBe(false)
  })
})
