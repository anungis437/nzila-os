import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  healthGet: vi.fn(),
}))

vi.mock('../../health/route', () => ({
  GET: mocks.healthGet,
}))

const originalEnv = {
  djangoApiUrl: process.env.DJANGO_API_URL,
  nextPublicDjangoApiUrl: process.env.NEXT_PUBLIC_DJANGO_API_URL,
  nzilaMode: process.env.NZILA_MODE,
  nextPublicAppEnv: process.env.NEXT_PUBLIC_APP_ENV,
}

describe('GET /api/auth_core/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DJANGO_API_URL
    delete process.env.NEXT_PUBLIC_DJANGO_API_URL
    delete process.env.NZILA_MODE
    delete process.env.NEXT_PUBLIC_APP_ENV
    mocks.healthGet.mockResolvedValue(
      Response.json({ ok: true, status: 'healthy' }, { status: 200 }),
    )
  })

  afterEach(() => {
    process.env.DJANGO_API_URL = originalEnv.djangoApiUrl
    process.env.NEXT_PUBLIC_DJANGO_API_URL = originalEnv.nextPublicDjangoApiUrl
    process.env.NZILA_MODE = originalEnv.nzilaMode
    process.env.NEXT_PUBLIC_APP_ENV = originalEnv.nextPublicAppEnv
    vi.unstubAllGlobals()
  })

  it('fails closed in pilot mode when sidecar is unconfigured', async () => {
    process.env.NZILA_MODE = 'pilot'

    const { GET } = await import('./route')
    const response = await GET(new NextRequest('http://localhost/api/auth_core/health'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('django_sidecar_not_configured')
  })

  it('falls back to app health endpoint outside pilot mode', async () => {
    const { GET } = await import('./route')
    const response = await GET(new NextRequest('http://localhost/api/auth_core/health'))
    const body = await response.json()

    expect(mocks.healthGet).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
  })

  it('returns degraded when sidecar returns unhealthy status', async () => {
    process.env.DJANGO_API_URL = 'https://django.example'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 502 }),
    )

    const { GET } = await import('./route')
    const response = await GET(new NextRequest('http://localhost/api/auth_core/health'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.reason).toBe('django_sidecar_unhealthy')
    expect(body.upstreamStatus).toBe(502)
  })

  it('returns degraded when sidecar is unreachable', async () => {
    process.env.NEXT_PUBLIC_DJANGO_API_URL = 'https://django.example'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    const { GET } = await import('./route')
    const response = await GET(new NextRequest('http://localhost/api/auth_core/health'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.reason).toBe('django_sidecar_unreachable')
  })

  it('passes through healthy sidecar response body and status', async () => {
    process.env.DJANGO_API_URL = 'https://django.example/'
    const mockHeaders = new Map([['content-type', 'application/json']])
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '{"ok":true,"status":"healthy"}',
        headers: mockHeaders,
      }),
    )

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/auth_core/health'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true, status: 'healthy' })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe('application/json')
  })

  it('uses JSON content-type fallback when upstream omits it', async () => {
    process.env.DJANGO_API_URL = 'https://django.example/'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"ok":true}'),
        headers: { get: vi.fn().mockReturnValue(null) },
      }),
    )

    const { GET } = await import('./route')
    const response = await GET({} as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
  })
})
