import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getRequestContext,
  runWithContext,
  createRequestContext,
  contextToHeaders,
  type RequestContext,
} from '../requestContext'

describe('requestContext', () => {
  describe('getRequestContext / runWithContext', () => {
    it('returns undefined outside of context', () => {
      expect(getRequestContext()).toBeUndefined()
    })

    it('returns the context inside runWithContext', () => {
      const ctx: RequestContext = {
        requestId: 'req-1',
        startedAt: Date.now(),
      }
      runWithContext(ctx, () => {
        expect(getRequestContext()).toBe(ctx)
      })
    })

    it('returns the function result', () => {
      const ctx: RequestContext = { requestId: 'req-1', startedAt: Date.now() }
      const result = runWithContext(ctx, () => 42)
      expect(result).toBe(42)
    })

    it('restores undefined after runWithContext completes', () => {
      const ctx: RequestContext = { requestId: 'req-1', startedAt: Date.now() }
      runWithContext(ctx, () => {})
      expect(getRequestContext()).toBeUndefined()
    })
  })

  describe('createRequestContext', () => {
    it('extracts traceparent from headers', () => {
      const req = new Request('http://localhost', {
        headers: { traceparent: '00-abcdef1234567890abcdef1234567890-1234567890abcdef-01' },
      })
      const ctx = createRequestContext(req)
      expect(ctx.traceId).toBe('abcdef1234567890abcdef1234567890')
      expect(ctx.spanId).toBe('1234567890abcdef')
    })

    it('falls back to x-request-id header', () => {
      const req = new Request('http://localhost', {
        headers: { 'x-request-id': 'custom-id-42' },
      })
      const ctx = createRequestContext(req)
      expect(ctx.requestId).toBe('custom-id-42')
    })

    it('generates a UUID requestId when no header present', () => {
      const req = new Request('http://localhost')
      const ctx = createRequestContext(req)
      expect(ctx.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    })

    it('sets userId, orgId, appName from opts', () => {
      const req = new Request('http://localhost')
      const ctx = createRequestContext(req, {
        userId: 'u1',
        orgId: 'org1',
        appName: 'console',
      })
      expect(ctx.userId).toBe('u1')
      expect(ctx.orgId).toBe('org1')
      expect(ctx.appName).toBe('console')
    })

    it('sets startedAt to approximately now', () => {
      const before = Date.now()
      const ctx = createRequestContext(new Request('http://localhost'))
      const after = Date.now()
      expect(ctx.startedAt).toBeGreaterThanOrEqual(before)
      expect(ctx.startedAt).toBeLessThanOrEqual(after)
    })

    it('handles malformed traceparent gracefully', () => {
      const req = new Request('http://localhost', {
        headers: { traceparent: 'not-valid' },
      })
      const ctx = createRequestContext(req)
      expect(ctx.traceId).toBeUndefined()
      expect(ctx.spanId).toBeUndefined()
    })

    it('works with plain object headers using get()', () => {
      const headers = { get: (k: string) => (k === 'x-request-id' ? 'obj-id' : null) }
      const ctx = createRequestContext({ headers } as { headers: { get: (k: string) => string | null } })
      expect(ctx.requestId).toBe('obj-id')
    })
  })

  describe('contextToHeaders', () => {
    it('always includes x-request-id', () => {
      const ctx: RequestContext = { requestId: 'r1', startedAt: 0 }
      const h = contextToHeaders(ctx)
      expect(h['x-request-id']).toBe('r1')
    })

    it('includes x-trace-id when traceId present', () => {
      const ctx: RequestContext = { requestId: 'r1', traceId: 't1', startedAt: 0 }
      expect(contextToHeaders(ctx)['x-trace-id']).toBe('t1')
    })

    it('includes x-user-id and x-org-id when present', () => {
      const ctx: RequestContext = {
        requestId: 'r1',
        userId: 'u1',
        orgId: 'o1',
        startedAt: 0,
      }
      const h = contextToHeaders(ctx)
      expect(h['x-user-id']).toBe('u1')
      expect(h['x-org-id']).toBe('o1')
    })

    it('omits optional headers when not present', () => {
      const ctx: RequestContext = { requestId: 'r1', startedAt: 0 }
      const h = contextToHeaders(ctx)
      expect(h).not.toHaveProperty('x-trace-id')
      expect(h).not.toHaveProperty('x-user-id')
      expect(h).not.toHaveProperty('x-org-id')
    })
  })
})
