import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  rateLimitHeaders: vi.fn(),
  intlMiddleware: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/config', () => ({
  auth: (handler: (request: unknown) => NextResponse) => handler,
}))

vi.mock('@nzila/os-core/rateLimit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitHeaders: mocks.rateLimitHeaders,
}))

vi.mock('next-intl/middleware', () => ({
  default: () => mocks.intlMiddleware,
}))

import { proxy } from './proxy'

type ProxyHandler = (request: NextRequest & { auth?: unknown }) => NextResponse
const invokeProxy = proxy as unknown as ProxyHandler

describe('cora proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
    mocks.checkRateLimit.mockReturnValue({ allowed: true })
    mocks.rateLimitHeaders.mockReturnValue({
      'x-ratelimit-limit': '120',
      'x-ratelimit-remaining': '0',
    })
    mocks.intlMiddleware.mockReturnValue(NextResponse.next())
  })

  it('redirects unauthenticated private routes to sign-in', () => {
    const req = new NextRequest('http://localhost/dashboard')
    const response = invokeProxy(req)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/sign-in')
  })

  it('allows authenticated api routes and propagates request id', () => {
    const req = new NextRequest('http://localhost/api/data', {
      headers: {
        'x-request-id': 'req-123',
      },
    }) as NextRequest & { auth?: unknown }
    req.auth = { userId: 'user_1' }

    const response = invokeProxy(req)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-123')
  })

  it('handles non-api route through intl middleware', () => {
    const req = new NextRequest('http://localhost/', {
      headers: {
        'x-request-id': 'req-home',
      },
    })
    const response = invokeProxy(req)

    expect(mocks.intlMiddleware).toHaveBeenCalledTimes(1)
    expect(response.headers.get('x-request-id')).toBe('req-home')
  })

  it('generates request id for non-api route when header is missing', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-req-id')
    const req = new NextRequest('http://localhost/')
    const response = invokeProxy(req)

    expect(response.headers.get('x-request-id')).toBe('generated-req-id')
  })

  it('returns 429 when rate limit is exceeded', () => {
    vi.stubEnv('NODE_ENV', 'production')
    mocks.checkRateLimit.mockReturnValue({
      allowed: false,
      limit: 120,
      remaining: 0,
      reset: 123456,
    })

    const req = new NextRequest('http://localhost/api/health')
    const response = invokeProxy(req)

    expect(response.status).toBe(429)
    expect(mocks.rateLimitHeaders).toHaveBeenCalledTimes(1)
  })

  it('uses x-forwarded-for first ip for rate limiting', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const req = new NextRequest('http://localhost/api/health', {
      headers: {
        'x-forwarded-for': '198.51.100.10, 203.0.113.4',
      },
    }) as NextRequest & { auth?: unknown }
    req.auth = { userId: 'user_1' }

    invokeProxy(req)

    expect(mocks.checkRateLimit).toHaveBeenCalledWith('198.51.100.10', {
      max: 120,
      windowMs: 60000,
    })
  })

  it('skips rate limiting in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const req = new NextRequest('http://localhost/api/health') as NextRequest & {
      auth?: unknown
    }
    req.auth = { userId: 'user_1' }

    invokeProxy(req)

    expect(mocks.checkRateLimit).not.toHaveBeenCalled()
  })
})
