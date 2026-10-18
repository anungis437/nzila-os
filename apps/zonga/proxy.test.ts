import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse, type NextRequest } from 'next/server'

// Mirrors authMiddleware: auth.protect() throws a sign-in challenge that the wrapper
// converts into a redirect. Anything else thrown by the handler propagates.
class Challenge {
  constructor(public url: string) {}
}
let authenticated = false

vi.mock('@nzila/platform-auth/entra/server', () => ({
  authMiddleware:
    (handler: (auth: { protect: () => Promise<void> }, request: NextRequest) => unknown) =>
    async (request: NextRequest) => {
      const auth = {
        protect: async () => {
          if (!authenticated) throw new Challenge(new URL('/sign-in', request.url).toString())
        },
      }
      try {
        return await handler(auth, request)
      } catch (e) {
        if (e instanceof Challenge) return NextResponse.redirect(e.url)
        throw e
      }
    },
  createRouteMatcher: (patterns: string[]) => {
    const matchers = patterns.map((p) => new RegExp(`^${p.replace(/\(\.\*\)$/, '.*')}$`))
    return (request: NextRequest) => matchers.some((m) => m.test(request.nextUrl.pathname))
  },
}))

const checkRateLimitDistributed = vi.fn()
vi.mock('@nzila/os-core/rateLimit', () => ({ rateLimitHeaders: () => ({}) }))
vi.mock('@nzila/os-core/orgRateLimit', () => ({ orgRateLimitHeaders: () => ({}) }))
vi.mock('@nzila/os-core/rateLimit/distributed', () => ({
  checkRateLimitDistributed: (...args: unknown[]) => checkRateLimitDistributed(...args),
  checkOrgRateLimitDistributed: async () => ({ allowed: true }),
}))
vi.mock('next-intl/middleware', () => ({ default: () => () => NextResponse.next() }))

async function run(path: string, method = 'GET') {
  const { NextRequest: Req } = await import('next/server')
  const { proxy } = await import('./proxy')
  const handler = proxy as unknown as (request: NextRequest) => Promise<Response>
  return handler(new Req(`https://zonga.test${path}`, { method }))
}

describe('zonga proxy — diagnostics and auth challenge', () => {
  beforeEach(() => {
    authenticated = false
    checkRateLimitDistributed.mockReset()
    checkRateLimitDistributed.mockResolvedValue({ allowed: true })
  })

  it.each(['/api/health', '/api/ready', '/api/version'])(
    'serves %s without authentication',
    async (path) => {
      const response = await run(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
    },
  )

  it.each(['/api/royalties', '/api/internal/workers/crm-retry', '/en/dashboard'])(
    'redirects unauthenticated %s to sign-in instead of reporting an outage',
    async (path) => {
      const response = await run(path)
      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/sign-in')
    },
  )

  it('does not expose webhook ingress without authentication', async () => {
    const response = await run('/api/webhooks/stripe', 'POST')
    expect(response.status).toBe(307)
  })

  it('lets authenticated requests through protected routes', async () => {
    authenticated = true
    const response = await run('/api/royalties')
    expect(response.status).toBe(200)
  })

  it('still fails closed with 503 when an upstream guard fails', async () => {
    checkRateLimitDistributed.mockRejectedValue(new Error('redis unavailable'))
    const response = await run('/api/version')
    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe('MIDDLEWARE_FAILURE')
  })

  it('still enforces rate limits before authentication', async () => {
    checkRateLimitDistributed.mockResolvedValue({ allowed: false })
    const response = await run('/api/royalties')
    expect(response.status).toBe(429)
  })
})
