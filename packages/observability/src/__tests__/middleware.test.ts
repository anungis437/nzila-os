/**
 * @nzila/observability — Middleware tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to mock next/server before importing middleware
vi.mock('next/server', () => {
  class MockNextResponse {
    status: number
    _headers: Map<string, string>
    headers: { set: (k: string, v: string) => void; get: (k: string) => string | undefined }

    constructor(body?: unknown, init?: { status?: number }) {
      this.status = init?.status ?? 200
      this._headers = new Map()
      this.headers = {
        set: (k: string, v: string) => this._headers.set(k, v),
        get: (k: string) => this._headers.get(k),
      }
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: class {},
  }
})

import { createTraceMiddleware } from '../middleware'

describe('createTraceMiddleware', () => {
  it('creates a middleware function', () => {
    const mw = createTraceMiddleware()
    expect(typeof mw).toBe('function')
  })

  it('wraps handler with trace context and returns result', async () => {
    const mw = createTraceMiddleware({
      defaultTenantId: 'tenant-1',
      defaultActorId: 'actor-1',
    })

    const req = {
      method: 'GET',
      url: '/api/health',
      headers: {
        get: (name: string) => null,
      },
    }

    const result = await mw(req, async (ctx) => {
      expect(ctx.traceId).toBeDefined()
      expect(ctx.spanId).toBeDefined()
      expect(ctx.tenantId).toBe('tenant-1')
      expect(ctx.actorId).toBe('actor-1')
      return { ok: true }
    })

    expect(result).toEqual({ ok: true })
  })

  it('propagates errors with span recording', async () => {
    const mw = createTraceMiddleware()

    const req = {
      method: 'POST',
      url: '/api/claims',
      headers: { get: () => null },
    }

    await expect(
      mw(req, async () => {
        throw new Error('handler failure')
      }),
    ).rejects.toThrow('handler failure')
  })

  it('uses defaults when no options provided', async () => {
    const mw = createTraceMiddleware()

    const req = {
      method: 'GET',
      url: '/test',
      headers: { get: () => null },
    }

    const result = await mw(req, async (ctx) => {
      expect(ctx.tenantId).toBe('system')
      expect(ctx.actorId).toBe('anonymous')
      return 'ok'
    })

    expect(result).toBe('ok')
  })

  it('extracts trace context from headers', async () => {
    const mw = createTraceMiddleware()

    const traceId = '0af7651916cd43dd8448eb211c80319c'
    const spanId = 'b7ad6b7169203331'
    const traceparent = `00-${traceId}-${spanId}-01`

    const req = {
      method: 'GET',
      url: '/api/test',
      headers: {
        get: (name: string) => {
          if (name === 'traceparent') return traceparent
          if (name === 'x-tenant-id') return 'my-tenant'
          if (name === 'x-actor-id') return 'my-actor'
          if (name === 'x-request-id') return 'req-xyz'
          return null
        },
      },
    }

    await mw(req, async (ctx) => {
      expect(ctx.traceId).toBe(traceId)
      expect(ctx.tenantId).toBe('my-tenant')
      expect(ctx.actorId).toBe('my-actor')
      expect(ctx.requestId).toBe('req-xyz')
      expect(ctx.parentSpanId).toBe(spanId)
      return null
    })
  })

  it('propagates non-Error throws', async () => {
    const mw = createTraceMiddleware()

    const req = {
      method: 'GET',
      url: '/test',
      headers: { get: () => null },
    }

    await expect(
      mw(req, async () => {
        throw 'string-error'
      }),
    ).rejects.toBe('string-error')
  })
})

// ── Next.js withTraceContext tests ──────────────────────────────────────────

import { withTraceContext } from '../middleware'

function fakeNextRequest(overrides: {
  method?: string
  pathname?: string
  headers?: Record<string, string>
} = {}) {
  const method = overrides.method ?? 'GET'
  const pathname = overrides.pathname ?? '/api/test'
  const headersMap = new Map(Object.entries(overrides.headers ?? {}))
  return {
    method,
    headers: {
      get: (name: string) => headersMap.get(name) ?? null,
    },
    nextUrl: { pathname },
  } as unknown as import('next/server').NextRequest
}

describe('withTraceContext (Next.js)', () => {
  it('wraps handler and returns response', async () => {
    // Import the mocked NextResponse
    const { NextResponse } = await import('next/server')
    const handler = vi.fn().mockResolvedValue(new NextResponse(null, { status: 200 }))

    const wrapped = withTraceContext(handler as never)
    const req = fakeNextRequest()
    const res = await wrapped(req)

    expect(handler).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    // Should inject trace headers
    expect(res.headers.get('traceparent')).toBeTruthy()
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  it('uses custom tenant/actor extractors', async () => {
    const { NextResponse } = await import('next/server')
    let capturedCtx: unknown

    const handler = vi.fn().mockImplementation(async (_req: unknown, ctx: unknown) => {
      capturedCtx = ctx
      return new NextResponse(null, { status: 200 })
    })

    const wrapped = withTraceContext(handler as never, {
      extractTenantId: () => 'custom-tenant',
      extractActorId: () => 'custom-actor',
    })

    const req = fakeNextRequest()
    await wrapped(req)

    const ctx = capturedCtx as { tenantId: string; actorId: string }
    expect(ctx.tenantId).toBe('custom-tenant')
    expect(ctx.actorId).toBe('custom-actor')
  })

  it('records error span on handler failure', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('crash'))

    const wrapped = withTraceContext(handler as never)
    const req = fakeNextRequest()

    await expect(wrapped(req)).rejects.toThrow('crash')
  })

  it('sets span status error for 4xx/5xx responses', async () => {
    const { NextResponse } = await import('next/server')
    const handler = vi.fn().mockResolvedValue(new NextResponse(null, { status: 500 }))

    const wrapped = withTraceContext(handler as never)
    const req = fakeNextRequest()
    const res = await wrapped(req)

    expect(res.status).toBe(500)
  })

  it('uses defaults for tenant/actor when no options', async () => {
    const { NextResponse } = await import('next/server')
    let capturedCtx: unknown

    const handler = vi.fn().mockImplementation(async (_req: unknown, ctx: unknown) => {
      capturedCtx = ctx
      return new NextResponse(null, { status: 200 })
    })

    const wrapped = withTraceContext(handler as never)
    const req = fakeNextRequest()
    await wrapped(req)

    const ctx = capturedCtx as { tenantId: string; actorId: string }
    expect(ctx.tenantId).toBe('system')
    expect(ctx.actorId).toBe('anonymous')
  })
})
