import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  authMock: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.authMock,
}))

import { authenticateRequest } from './api-guards'
import { NextRequest } from 'next/server'

describe('api-guards — TrustCore auth boundaries', () => {
  beforeEach(() => {
    mocks.authMock.mockReset()
  })

  it('returns unauthorized when no user session', async () => {
    mocks.authMock.mockResolvedValue({ userId: null })

    const req = new NextRequest('http://localhost/api/test')
    const result = await authenticateRequest(req)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })

  it('returns forbidden when org context is missing', async () => {
    mocks.authMock.mockResolvedValue({ userId: 'user_1', orgId: null })

    const req = new NextRequest('http://localhost/api/test')
    const result = await authenticateRequest(req)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it('resolves from session orgId when x-org-id header is absent', async () => {
    mocks.authMock.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_session',
    })

    const req = new NextRequest('http://localhost/api/test')
    const result = await authenticateRequest(req)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.ctx.userId).toBe('user_1')
      expect(result.ctx.orgId).toBe('org_session')
    }
  })

  it('prefers x-org-id header over session orgId', async () => {
    mocks.authMock.mockResolvedValue({
      userId: 'user_1',
      orgId: 'org_session',
    })

    const req = new NextRequest('http://localhost/api/test', {
      headers: { 'x-org-id': 'org_header' },
    })
    const result = await authenticateRequest(req)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.ctx.orgId).toBe('org_header')
    }
  })
})
