import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  buildAppUrl: vi.fn((pathname: string) => `https://app.example.invalid${pathname}`),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }))
vi.mock('@/lib/site-topology', () => ({ buildAppUrl: m.buildAppUrl }))

async function loadRoute() {
  return import('../route')
}

describe('[locale]/app route', () => {
  it('authenticates once and redirects with only allowed attribution params', async () => {
    m.auth.mockResolvedValue({ userId: 'user_test_001' })
    const { GET } = await loadRoute()
    const response = await GET(
      new NextRequest(
        'https://marketing.example.invalid/en/app?utm_source=newsletter&ref=pilot&drop=forbidden',
      ),
      { params: Promise.resolve({ locale: 'en' }) },
    )

    expect(m.auth).toHaveBeenCalledTimes(1)
    expect(m.buildAppUrl).toHaveBeenCalledWith('/en')
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://app.example.invalid/en?utm_source=newsletter&ref=pilot',
    )
  })
})
