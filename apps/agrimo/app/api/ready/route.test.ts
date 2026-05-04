import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_AUTHORITY_HEALTH_URL = process.env.AGRIMO_DJANGO_AUTHORITY_HEALTH_URL
const ORIGINAL_BASE_URL = process.env.AGRIMO_DJANGO_BASE_URL

afterEach(() => {
  process.env.AGRIMO_DJANGO_AUTHORITY_HEALTH_URL = ORIGINAL_AUTHORITY_HEALTH_URL
  process.env.AGRIMO_DJANGO_BASE_URL = ORIGINAL_BASE_URL
  vi.restoreAllMocks()
})

describe('Agrimo ready route authority posture', () => {
  it('fails closed when authority probe is unconfigured', async () => {
    delete process.env.AGRIMO_DJANGO_AUTHORITY_HEALTH_URL
    delete process.env.AGRIMO_DJANGO_BASE_URL

    const { GET } = await import('./route')
    const response = await GET()
    const body = (await response.json()) as {
      ready: boolean
      status: string
      checks: { thirdParty: { status: string; reason?: string } }
    }

    expect(response.status).toBe(503)
    expect(body.ready).toBe(false)
    expect(body.status).toBe('not_ready')
    expect(body.checks.thirdParty.status).toBe('unavailable')
    expect(body.checks.thirdParty.reason).toBe('authority_probe_unconfigured')
  })

  it('fails closed when authority endpoint is reachable but unhealthy', async () => {
    process.env.AGRIMO_DJANGO_AUTHORITY_HEALTH_URL = 'https://authority.example/api/auth/health/'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

    const { GET } = await import('./route')
    const response = await GET()
    const body = (await response.json()) as {
      ready: boolean
      checks: { thirdParty: { reason?: string } }
    }

    expect(response.status).toBe(503)
    expect(body.ready).toBe(false)
    expect(body.checks.thirdParty.reason).toBe('authority_http_503')
  })

  it('reports ready only when authority health probe succeeds', async () => {
    process.env.AGRIMO_DJANGO_AUTHORITY_HEALTH_URL = 'https://authority.example/api/auth/health/'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    const { GET } = await import('./route')
    const response = await GET()
    const body = (await response.json()) as {
      ready: boolean
      status: string
      checks: { thirdParty: { status: string } }
    }

    expect(response.status).toBe(200)
    expect(body.ready).toBe(true)
    expect(body.status).toBe('ready')
    expect(body.checks.thirdParty.status).toBe('ok')
  })
})
