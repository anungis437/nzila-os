/**
 * @nzila/observability — Extended context tests
 *
 * Covers requireTraceContext, extractTraceFromHeaders, buildTraceHeaders,
 * generateRequestId, buildTraceparent unsampled.
 */
import { describe, it, expect } from 'vitest'
import {
  requireTraceContext,
  generateRequestId,
  buildTraceparent,
  extractTraceFromHeaders,
  buildTraceHeaders,
  generateTraceId,
  generateSpanId,
  type TraceContext,
} from '../context'

describe('requireTraceContext', () => {
  it('throws when no context is active', () => {
    expect(() => requireTraceContext()).toThrow(
      'TraceContext not available',
    )
  })
})

describe('generateRequestId', () => {
  it('returns a UUID', () => {
    const id = generateRequestId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('returns unique values', () => {
    const a = generateRequestId()
    const b = generateRequestId()
    expect(a).not.toBe(b)
  })
})

describe('buildTraceparent', () => {
  it('builds with sampled=true (default)', () => {
    const tp = buildTraceparent('a'.repeat(32), 'b'.repeat(16))
    expect(tp).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`)
  })

  it('builds with sampled=false', () => {
    const tp = buildTraceparent('a'.repeat(32), 'b'.repeat(16), false)
    expect(tp).toBe(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-00`)
  })
})

describe('extractTraceFromHeaders', () => {
  it('extracts from traceparent header', () => {
    const traceId = '0af7651916cd43dd8448eb211c80319c'
    const spanId = 'b7ad6b7169203331'
    const headers = {
      get: (name: string) => {
        if (name === 'traceparent') return `00-${traceId}-${spanId}-01`
        if (name === 'x-tenant-id') return 'my-tenant'
        if (name === 'x-actor-id') return 'my-actor'
        if (name === 'x-request-id') return 'req-123'
        return null
      },
    }

    const ctx = extractTraceFromHeaders(headers, {
      tenantId: 'default-t',
      actorId: 'default-a',
    })

    expect(ctx.traceId).toBe(traceId)
    expect(ctx.parentSpanId).toBe(spanId)
    expect(ctx.tenantId).toBe('my-tenant')
    expect(ctx.actorId).toBe('my-actor')
    expect(ctx.requestId).toBe('req-123')
    // spanId is newly generated
    expect(ctx.spanId).toBeDefined()
    expect(ctx.spanId).not.toBe(spanId)
  })

  it('uses defaults when headers are missing', () => {
    const headers = { get: () => null }
    const ctx = extractTraceFromHeaders(headers, {
      tenantId: 'fallback-t',
      actorId: 'fallback-a',
    })

    expect(ctx.traceId).toHaveLength(32) // generated
    expect(ctx.tenantId).toBe('fallback-t')
    expect(ctx.actorId).toBe('fallback-a')
    expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(ctx.parentSpanId).toBeUndefined()
  })

  it('handles invalid traceparent gracefully', () => {
    const headers = {
      get: (name: string) => {
        if (name === 'traceparent') return 'garbage'
        return null
      },
    }

    const ctx = extractTraceFromHeaders(headers, {
      tenantId: 't',
      actorId: 'a',
    })

    // Should generate new traceId instead of failing
    expect(ctx.traceId).toHaveLength(32)
    expect(ctx.parentSpanId).toBeUndefined()
  })
})

describe('buildTraceHeaders', () => {
  it('returns traceparent and custom headers', () => {
    const ctx: TraceContext = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      tenantId: 'test-tenant',
      actorId: 'test-actor',
      requestId: 'req-abc',
    }

    const headers = buildTraceHeaders(ctx)
    expect(headers.traceparent).toContain(ctx.traceId)
    expect(headers.traceparent).toContain(ctx.spanId)
    expect(headers['x-request-id']).toBe('req-abc')
    expect(headers['x-tenant-id']).toBe('test-tenant')
    expect(headers['x-actor-id']).toBe('test-actor')
  })
})
