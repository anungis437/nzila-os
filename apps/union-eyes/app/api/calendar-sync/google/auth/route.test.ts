import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getAuthorizationUrl: vi.fn<(userId: string) => string>(),
}))

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: vi.fn((_requiredRole: string, handler: (...args: any[]) => unknown) => handler),
}))

vi.mock('@/lib/external-calendar-sync/google-calendar-service', () => ({
  getAuthorizationUrl: mocks.getAuthorizationUrl,
}))

const { GET } = await import('@/app/api/calendar-sync/google/auth/route')

describe('GET /api/calendar-sync/google/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to Google OAuth URL for authenticated users', async () => {
    mocks.getAuthorizationUrl.mockReturnValue('https://accounts.google.com/o/oauth2/auth?x=1')

    const req = new NextRequest('https://example.com/api/calendar-sync/google/auth')
    const res = await GET(req, { userId: 'user-1' })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('accounts.google.com')
    expect(mocks.getAuthorizationUrl).toHaveBeenCalledWith('user-1')
  })

  it('returns auth required when userId is missing from context', async () => {
    const req = new NextRequest('https://example.com/api/calendar-sync/google/auth')
    const res = await GET(req, {})
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.code).toBe('AUTH_REQUIRED')
  })

  it('returns internal error if OAuth URL generation fails', async () => {
    mocks.getAuthorizationUrl.mockImplementation(() => {
      throw new Error('oauth-failed')
    })

    const req = new NextRequest('https://example.com/api/calendar-sync/google/auth')
    const res = await GET(req, { userId: 'user-1' })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.code).toBe('INTERNAL_ERROR')
  })
})
