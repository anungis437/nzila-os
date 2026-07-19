/**
 * Tests for api-handler.ts — Standardized Next.js API Route Handler
 *
 * Since apiHandler depends heavily on Next.js runtime (NextRequest, NextResponse),
 * we mock them for unit testing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────

const mockJsonResponse = vi.fn()
const mockHeadersSet = vi.fn()

vi.mock('next/server', () => {
  class MockNextResponse {
    status: number
    _body: unknown
    headers = new Map<string, string>()

    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this._body = body
      this.status = init?.status ?? 200
      if (init?.headers) {
        Object.entries(init.headers).forEach(([k, v]) => this.headers.set(k, v))
      }
    }

    static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      mockJsonResponse(body, init)
      const resp = new MockNextResponse(body, init)
      return resp
    }
  }

  class MockNextRequest {
    method: string
    url: string
    _headers: Map<string, string>

    constructor(url: string, opts?: { method?: string; headers?: Record<string, string> }) {
      this.url = url
      this.method = opts?.method ?? 'GET'
      this._headers = new Map(Object.entries(opts?.headers ?? {}))
    }

    get headers() {
      return {
        get: (key: string) => this._headers.get(key) ?? null,
      }
    }
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  }
})

vi.mock('./telemetry/requestContext', () => ({
  createRequestContext: vi.fn(() => ({})),
  runWithContext: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
  getRequestContext: vi.fn(),
}))

vi.mock('./telemetry/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}))

import { apiHandler } from '../api-handler'
import { ApiError, ApiErrorCode } from '../api-response'
import { NextRequest } from 'next/server'
import { ZodError, z } from 'zod'

describe('apiHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function createRequest(url = 'http://localhost/api/test', opts?: { method?: string; headers?: Record<string, string> }) {
    return new NextRequest(url, opts) as unknown as import('next/server').NextRequest
  }

  it('wraps handler result in success envelope', async () => {
    const handler = apiHandler(
      { appName: 'test-app' },
      async () => ({ message: 'ok' }),
    )

    await handler(createRequest())

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { message: 'ok' },
        meta: expect.objectContaining({ requestId: expect.any(String) }),
      }),
      expect.objectContaining({ status: 200 }),
    )
  })

  it('uses x-request-id from header when provided', async () => {
    const handler = apiHandler(
      { appName: 'test-app' },
      async (_req, { requestId }) => ({ requestId }),
    )

    await handler(createRequest('http://localhost/api/test', {
      headers: { 'x-request-id': 'custom-req-id' },
    }))

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { requestId: 'custom-req-id' },
      }),
      expect.anything(),
    )
  })

  it('handles ApiError and returns error envelope', async () => {
    const handler = apiHandler(
      { appName: 'test-app' },
      async () => {
        throw new ApiError(404, ApiErrorCode.NOT_FOUND, 'Resource not found')
      },
    )

    await handler(createRequest())

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'NOT_FOUND', message: 'Resource not found' }),
      }),
      expect.objectContaining({ status: 404 }),
    )
  })

  it('handles ZodError and returns 400 validation error', async () => {
    const handler = apiHandler(
      { appName: 'test-app' },
      async () => {
        const schema = z.object({ name: z.string() })
        schema.parse({}) // will throw ZodError
      },
    )

    await handler(createRequest())

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'VALIDATION_ERROR', message: 'Request validation failed' }),
      }),
      expect.objectContaining({ status: 400 }),
    )
  })

  it('handles unknown errors and returns 500', async () => {
    const handler = apiHandler(
      { appName: 'test-app' },
      async () => {
        throw new Error('unexpected boom')
      },
    )

    await handler(createRequest())

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
      expect.objectContaining({ status: 500 }),
    )
  })

  it('resolves route params from routeCtx', async () => {
    const handler = apiHandler(
      { appName: 'test-app' },
      async (_req, { params }) => ({ params }),
    )

    await handler(createRequest(), {
      params: Promise.resolve({ id: '123' }),
    })

    expect(mockJsonResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { params: { id: '123' } },
      }),
      expect.anything(),
    )
  })

  it('provides logger in handler context', async () => {
    let receivedLogger: unknown
    const handler = apiHandler(
      { appName: 'test-app' },
      async (_req, { logger }) => {
        receivedLogger = logger
        return {}
      },
    )

    await handler(createRequest())
    expect(receivedLogger).toBeTruthy()
    expect(typeof (receivedLogger as { info?: unknown }).info).toBe('function')
  })
})
