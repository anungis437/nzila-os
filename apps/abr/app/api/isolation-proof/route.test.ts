import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  withRequestContext: vi.fn(),
}))

vi.mock('@/lib/api-guards', () => ({
  authenticateUser: mocks.authenticateUser,
  withRequestContext: mocks.withRequestContext,
}))

import { GET } from './route'

describe('GET /api/isolation-proof', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withRequestContext.mockImplementation((_req: Request, handler: () => Promise<NextResponse>) => handler())
    mocks.authenticateUser.mockResolvedValue({ ok: true, userId: 'user_1' })
  })

  it('returns auth response when user is not authenticated', async () => {
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    mocks.authenticateUser.mockResolvedValue({ ok: false, response: unauthorized })

    const req = new Request('http://localhost/api/isolation-proof')
    const response = await GET(req)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('returns a signed isolation proof when authenticated', async () => {
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-01-01T00:00:00.000Z')

    const req = new Request('http://localhost/api/isolation-proof')
    const response = await GET(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.app).toBe('abr')
    expect(body.version).toBe('0.1.0')
    expect(body.timestamp).toBe('2026-01-01T00:00:00.000Z')
    expect(body.isolation).toEqual({
      authEnforcement: 'entra_jwt',
      orgContextSource: 'auth_session',
      dataLayerIsolation: 'django_backend_rbac',
      crossOrgDenied: true,
      evidencePipeline: 'os_core_evidence',
    })
    expect(body.signatureHash).toMatch(/^[a-f0-9]{64}$/)
  })
})
