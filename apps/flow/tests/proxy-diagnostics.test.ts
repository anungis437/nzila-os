import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// auth(handler) wraps the handler; the real wrapper attaches the session as request.auth.
let session: unknown = null
vi.mock('@nzila/platform-auth/entra/config', () => ({
  auth: (handler: (request: unknown) => unknown) => (request: NextRequest) =>
    handler(Object.assign(request, { auth: session })),
}))
vi.mock('@nzila/os-core/rateLimit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  rateLimitHeaders: () => ({}),
}))
vi.mock('@nzila/os-core/orgRateLimit', () => ({
  checkOrgRateLimit: () => ({ allowed: true }),
  orgRateLimitHeaders: () => ({}),
}))

async function run(path: string, authed = false) {
  session = authed ? { user: { id: 'u1' } } : null
  const { proxy } = await import('../proxy')
  const handler = proxy as unknown as (request: NextRequest) => Promise<Response>
  return handler(new NextRequest(`https://flow.test${path}`))
}

describe('flow proxy — platform diagnostics', () => {
  it.each(['/api/health', '/api/ready', '/api/version'])(
    'serves %s without authentication',
    async (path) => {
      const response = await run(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-next')).toBe('1')
    },
  )

  it.each(['/api/version/extra', '/api/versions', '/api/ready-admin', '/api/readyz'])(
    'keeps lookalike path %s private',
    async (path) => {
      const response = await run(path)
      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/sign-in')
    },
  )

  it.each(['/api/quotes', '/api/clients', '/api/ops/summary', '/api/metrics'])(
    'keeps business endpoint %s behind authentication',
    async (path) => {
      const response = await run(path)
      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/sign-in')
    },
  )

  it('lets authenticated requests reach business endpoints', async () => {
    const response = await run('/api/quotes', true)
    expect(response.status).toBe(200)
  })
})
