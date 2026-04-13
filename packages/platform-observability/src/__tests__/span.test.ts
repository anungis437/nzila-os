import { describe, it, expect } from 'vitest'
import { Span, trace } from '../span'

describe('Span', () => {
  it('should create a span with unique ids', () => {
    const span = new Span({ operationName: 'test-op', serviceName: 'test-svc' })
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/)
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(span.parentSpanId).toBeNull()
    expect(span.operationName).toBe('test-op')
    expect(span.serviceName).toBe('test-svc')
  })

  it('should inherit traceId from options', () => {
    const trace = 'a'.repeat(32)
    const span = new Span({ operationName: 'op', serviceName: 'svc', traceId: trace })
    expect(span.traceId).toBe(trace)
  })

  it('should set parent span id', () => {
    const span = new Span({ operationName: 'op', serviceName: 'svc', parentSpanId: 'parent-123' })
    expect(span.parentSpanId).toBe('parent-123')
  })

  it('should end and produce SpanData with ok status', () => {
    const span = new Span({ operationName: 'op', serviceName: 'svc' })
    span.setAttribute('http.method', 'GET')
    const data = span.end()
    expect(data.status).toBe('ok')
    expect(data.durationMs).toBeGreaterThanOrEqual(0)
    expect(data.attributes['http.method']).toBe('GET')
  })

  it('should keep error status when end is called after fail', () => {
    const span = new Span({ operationName: 'op', serviceName: 'svc' })
    span.fail('first error')
    const ended = span.end()
    expect(ended.status).toBe('error')
  })

  it('should fail and produce SpanData with error status', () => {
    const span = new Span({ operationName: 'op', serviceName: 'svc' })
    const data = span.fail('something broke')
    expect(data.status).toBe('error')
    expect(data.attributes['error.message']).toBe('something broke')
    expect(data.events.length).toBeGreaterThanOrEqual(1)
    expect(data.events[0]!.name).toBe('exception')
  })

  it('should add events', () => {
    const span = new Span({ operationName: 'op', serviceName: 'svc' })
    span.addEvent('cache_hit', { key: 'users' })
    const data = span.end()
    expect(data.events.length).toBe(1)
    expect(data.events[0]!.name).toBe('cache_hit')
    expect(data.events[0]!.attributes.key).toBe('users')
  })

  it('should create child spans', () => {
    const parent = new Span({ operationName: 'parent', serviceName: 'svc' })
    const child = parent.child('child-op')
    expect(child.traceId).toBe(parent.traceId)
    expect(child.parentSpanId).toBe(parent.spanId)
    expect(child.serviceName).toBe('svc')
    expect(child.operationName).toBe('child-op')
  })

  it('should produce W3C traceparent', () => {
    const span = new Span({ operationName: 'op', serviceName: 'svc' })
    const tp = span.traceparent()
    expect(tp).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
  })

  it('should produce traceContext', () => {
    const span = new Span({ operationName: 'op', serviceName: 'svc' })
    const ctx = span.traceContext()
    expect(ctx.traceId).toBe(span.traceId)
    expect(ctx.spanId).toBe(span.spanId)
    expect(ctx.traceFlags).toBe(1)
  })

  it('should expose unset status before explicit end/fail', () => {
    const span = new Span({ operationName: 'op', serviceName: 'svc' })
    const data = (span as unknown as { toData: () => { status: string; endTime: number | null } }).toData()
    expect(data.status).toBe('unset')
    expect(data.endTime).not.toBeNull()
  })
})

describe('trace()', () => {
  it('should trace a successful async operation', async () => {
    const { result, span } = await trace('test-op', 'test-svc', async (s) => {
      s.setAttribute('custom', 'value')
      return 42
    })
    expect(result).toBe(42)
    expect(span.status).toBe('ok')
    expect(span.attributes.custom).toBe('value')
  })

  it('should trace a failed async operation', async () => {
    await expect(
      trace('fail-op', 'test-svc', async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
  })

  it('should trace non-Error failures', async () => {
    await expect(
      trace('fail-op-string', 'test-svc', async () => {
        throw 'string-boom'
      }),
    ).rejects.toBe('string-boom')
  })

  it('should accept parent span and trace ids', async () => {
    const traceId = 'b'.repeat(32)
    const { span } = await trace(
      'child-op',
      'svc',
      async () => 'ok',
      'parent-span-id',
      traceId,
    )
    expect(span.traceId).toBe(traceId)
    expect(span.parentSpanId).toBe('parent-span-id')
  })
})
