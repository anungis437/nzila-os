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

describe('mobility proxy', () => {
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

  it('allows authenticated API routes and propagates x-request-id', () => {
    const req = new NextRequest('http://localhost/api/version', {
      headers: {
        'x-request-id': 'req-123',
      },
    }) as NextRequest & { auth?: unknown }
    req.auth = { userId: 'user_1' }

    const response = invokeProxy(req)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBe('req-123')
  })

  it('applies intl middleware for non-api routes and sets x-request-id', () => {
    const req = new NextRequest('http://localhost/', {
      headers: {
        'x-request-id': 'req-home',
      },
    })

    const response = invokeProxy(req)

    expect(mocks.intlMiddleware).toHaveBeenCalledTimes(1)
    expect(response.headers.get('x-request-id')).toBe('req-home')
  })

  it('generates x-request-id for non-api routes when header is missing', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('generated-req-id')
    const req = new NextRequest('http://localhost/')

    const response = invokeProxy(req)

    expect(response.headers.get('x-request-id')).toBe('generated-req-id')
  })

  it('allows public auth routes without auth', () => {
    const req = new NextRequest('http://localhost/api/auth/session')
    const response = invokeProxy(req)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-request-id')).toBeTruthy()
  })

  it('returns 429 when rate limit is exceeded outside development', () => {
    vi.stubEnv('NODE_ENV', 'production')
    mocks.checkRateLimit.mockReturnValue({
      allowed: false,
      limit: 120,
      remaining: 0,
      reset: 123456,
    })

    const req = new NextRequest('http://localhost/api/ready')
  const response = invokeProxy(req)

    expect(response.status).toBe(429)
    expect(mocks.rateLimitHeaders).toHaveBeenCalledTimes(1)
  })

  it('uses x-forwarded-for first IP for rate limiting', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const req = new NextRequest('http://localhost/api/ready', {
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

  it('skips rate limit checks in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const req = new NextRequest('http://localhost/api/ready') as NextRequest & { auth?: unknown }
    req.auth = { userId: 'user_1' }

    invokeProxy(req)

    expect(mocks.checkRateLimit).not.toHaveBeenCalled()
  })
})