import { describe, it, expect, beforeEach as _beforeEach } from 'vitest'
import {
  generateTraceId,
  generateSpanId,
  generateRequestId,
  extractCorrelationContext,
  buildCorrelationHeaders,
  createChildContext,
  withCorrelation,
  withFreshCorrelation,
} from '../correlation'

describe('correlation', () => {
  describe('generateTraceId', () => {
    it('should generate a 32-character hex string', () => {
      const id = generateTraceId()
      expect(id).toMatch(/^[0-9a-f]{32}$/)
    })

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()))
      expect(ids.size).toBe(100)
    })
  })

  describe('generateSpanId', () => {
    it('should generate a 16-character hex string', () => {
      const id = generateSpanId()
      expect(id).toMatch(/^[0-9a-f]{16}$/)
    })
  })

  describe('generateRequestId', () => {
    it('should generate a UUID-format string', () => {
      const id = generateRequestId()
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    })
  })

  describe('extractCorrelationContext', () => {
    it('should extract from standard headers', () => {
      const ctx = extractCorrelationContext({
        'x-trace-id': 'abc123',
        'x-span-id': 'def456',
        'x-request-id': 'req-789',
        'x-org-id': 'org-001',
      })
      expect(ctx.traceId).toBe('abc123')
      expect(ctx.spanId).toBe('def456')
      expect(ctx.requestId).toBe('req-789')
      expect(ctx.orgId).toBe('org-001')
    })

    it('should parse W3C traceparent header', () => {
      const ctx = extractCorrelationContext({
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      })
      expect(ctx.traceId).toBe('0af7651916cd43dd8448eb211c80319c')
      expect(ctx.spanId).toBe('b7ad6b7169203331')
    })

    it('should generate defaults when no headers present', () => {
      const ctx = extractCorrelationContext({})
      expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/)
      expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/)
      expect(ctx.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    })

    it('should prefer explicit trace-id over traceparent', () => {
      const ctx = extractCorrelationContext({
        'x-trace-id': 'explicit-trace',
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      })
      expect(ctx.traceId).toBe('explicit-trace')
    })

    it('should use first value when headers are arrays', () => {
      const ctx = extractCorrelationContext({
        'x-request-id': ['req-first', 'req-second'],
        'x-trace-id': ['trace-first', 'trace-second'],
        'x-span-id': ['span-first', 'span-second'],
      })

      expect(ctx.requestId).toBe('req-first')
      expect(ctx.traceId).toBe('trace-first')
      expect(ctx.spanId).toBe('span-first')
    })

    it('should generate span id when explicit trace id is present without span id', () => {
      const ctx = extractCorrelationContext({
        'x-trace-id': 'explicit-trace-only',
      })
      expect(ctx.traceId).toBe('explicit-trace-only')
      expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/)
    })

    it('should ignore malformed traceparent and generate trace/span ids', () => {
      const ctx = extractCorrelationContext({
        traceparent: '00-too-short-bad-01',
      })
      expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/)
      expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/)
    })
  })

  describe('buildCorrelationHeaders', () => {
    it('should produce standard headers from context', () => {
      const headers = buildCorrelationHeaders({
        traceId: 'aaaa',
        spanId: 'bbbb',
        requestId: 'cccc',
      })
      expect(headers['x-trace-id']).toBe('aaaa')
      expect(headers['x-span-id']).toBe('bbbb')
      expect(headers['x-request-id']).toBe('cccc')
    })

    it('should include W3C traceparent for valid trace context', () => {
      const traceId = 'a'.repeat(32)
      const spanId = 'b'.repeat(16)
      const headers = buildCorrelationHeaders({ traceId, spanId, requestId: 'r' })
      expect(headers.traceparent).toBe(`00-${traceId}-${spanId}-01`)
    })

    it('should include orgId header when present', () => {
      const headers = buildCorrelationHeaders({
        traceId: 'a',
        spanId: 'b',
        requestId: 'c',
        orgId: 'my-org',
      })
      expect(headers['x-org-id']).toBe('my-org')
    })

    it('should omit traceparent for non-W3C id lengths', () => {
      const headers = buildCorrelationHeaders({
        traceId: 'short',
        spanId: 'tiny',
        requestId: 'req',
      })
      expect(headers.traceparent).toBeUndefined()
    })
  })

  describe('createChildContext', () => {
    it('should preserve traceId and requestId, generate new spanId', () => {
      const parent = extractCorrelationContext({
        'x-trace-id': 'parent-trace',
        'x-request-id': 'parent-req',
        'x-span-id': 'parent-span',
        'x-org-id': 'org-x',
      })
      const child = createChildContext(parent)

      expect(child.traceId).toBe('parent-trace')
      expect(child.requestId).toBe('parent-req')
      expect(child.orgId).toBe('org-x')
      expect(child.spanId).not.toBe('parent-span')
      expect(child.spanId).toMatch(/^[0-9a-f]{16}$/)
      expect(child.parentSpanId).toBe('parent-span')
    })
  })

  describe('wrappers', () => {
    it('withCorrelation injects extracted context into handler', async () => {
      const wrapped = withCorrelation(async (ctx, req: { headers: Record<string, string> }, value: number) => {
        expect(ctx.requestId).toBe('req-1')
        expect(ctx.traceId).toBe('trace-1')
        expect(ctx.spanId).toBe('span-1')
        return value + Object.keys(req.headers).length
      })

      const result = await wrapped({ headers: { 'x-request-id': 'req-1', 'x-trace-id': 'trace-1', 'x-span-id': 'span-1' } }, 2)
      expect(result).toBe(5)
    })

    it('withFreshCorrelation creates root context for non-request handlers', async () => {
      const wrapped = withFreshCorrelation(async (ctx, suffix: string) => {
        expect(ctx.requestId).toBeTruthy()
        expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/)
        expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/)
        return `${ctx.requestId}-${suffix}`
      })

      const result = await wrapped('done')
      expect(result.endsWith('-done')).toBe(true)
    })
  })
})
