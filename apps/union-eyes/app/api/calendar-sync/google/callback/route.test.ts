import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  const selectQueue: any[][] = []

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectQueue.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((payload: any) => {
        ;(db as any as { _lastUpdatePayload: any })._lastUpdatePayload = payload
        return { where: vi.fn(async () => undefined) }
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (payload: any) => {
        ;(db as any as { _lastInsertPayload: any })._lastInsertPayload = payload
        return undefined
      }),
    })),
    _lastInsertPayload: null as any,
    _lastUpdatePayload: null as any,
    _selectQueue: selectQueue,
  }

  return {
    db,
    exchangeCodeForTokens: vi.fn(),
  }
})

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: vi.fn((_requiredRole: string, handler: (...args: any[]) => unknown) => handler),
}))

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn((fn: () => Promise<any>) => fn()),
}))

vi.mock('@/db/db', () => ({ db: mocks.db }))

vi.mock('@/lib/external-calendar-sync/google-calendar-service', () => ({
  exchangeCodeForTokens: mocks.exchangeCodeForTokens,
}))

const { GET } = await import('@/app/api/calendar-sync/google/callback/route')

describe('GET /api/calendar-sync/google/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.db._selectQueue.length = 0
    mocks.db._lastInsertPayload = null
    mocks.db._lastUpdatePayload = null
  })

  it('creates a new connection when no existing google connection is found', async () => {
    mocks.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    })
    mocks.db._selectQueue.push([])

    const req = new NextRequest('https://example.com/api/calendar-sync/google/callback?code=abc&state=user-1')
    const res = await GET(req, { userId: 'user-1', organizationId: 'org-1' })

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/calendar?sync=connected&provider=google')
    expect(mocks.db.insert).toHaveBeenCalledTimes(1)
    expect(mocks.db._lastInsertPayload).toMatchObject({
      userId: 'user-1',
      organizationId: 'org-1',
      provider: 'google',
      providerAccountId: 'google:user-1',
    })
  })

  it('updates existing connection when a google connection already exists', async () => {
    mocks.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    })
    mocks.db._selectQueue.push([{ id: 'conn-1' }])

    const req = new NextRequest('https://example.com/api/calendar-sync/google/callback?code=abc&state=user-1')
    const res = await GET(req, { userId: 'user-1', organizationId: 'org-1' })

    expect(res.status).toBe(307)
    expect(mocks.db.update).toHaveBeenCalledTimes(1)
    expect(mocks.db._lastUpdatePayload).toMatchObject({ provider: 'google' })
  })

  it('returns service unavailable when no refresh token is returned for a new connection', async () => {
    mocks.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: '',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    })
    mocks.db._selectQueue.push([])

    const req = new NextRequest('https://example.com/api/calendar-sync/google/callback?code=abc&state=user-1')
    const res = await GET(req, { userId: 'user-1', organizationId: 'org-1' })
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.code).toBe('SERVICE_UNAVAILABLE')
  })

  it('returns validation error when code is missing', async () => {
    const req = new NextRequest('https://example.com/api/calendar-sync/google/callback?state=user-1')
    const res = await GET(req, { userId: 'user-1', organizationId: 'org-1' })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('rejects callback when oauth state does not match authenticated user', async () => {
    const req = new NextRequest('https://example.com/api/calendar-sync/google/callback?code=abc&state=other-user')
    const res = await GET(req, { userId: 'user-1', organizationId: 'org-1' })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.code).toBe('FORBIDDEN')
  })
})
