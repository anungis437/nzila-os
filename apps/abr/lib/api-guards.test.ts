import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createRequestContext: vi.fn(),
  runWithContext: vi.fn(),
  hasPermission: vi.fn(),
  normalizeRole: vi.fn(),
  resolveOrgContext: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
}))

vi.mock('@nzila/os-core/telemetry', () => ({
  createRequestContext: mocks.createRequestContext,
  runWithContext: mocks.runWithContext,
}))

vi.mock('@/lib/rbac', () => ({
  hasPermission: mocks.hasPermission,
  normalizeRole: mocks.normalizeRole,
}))

vi.mock('@/lib/org-context', () => ({
  resolveOrgContext: mocks.resolveOrgContext,
}))

import {
  authenticateUser,
  authenticateWithOrg,
  requireOrgAccess,
  requirePermission,
  withRequestContext,
} from './api-guards'

describe('abr api-guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ userId: 'user_1' })
    mocks.createRequestContext.mockReturnValue({ requestId: 'req-1' })
    mocks.runWithContext.mockImplementation((_ctx, handler) => handler())
    mocks.normalizeRole.mockReturnValue('viewer')
    mocks.hasPermission.mockReturnValue(false)
    mocks.resolveOrgContext.mockReturnValue({ orgId: 'org_1', source: 'header' })
  })

  it('authenticateUser returns ok when user exists', async () => {
    const result = await authenticateUser()
    expect(result).toEqual({ ok: true, userId: 'user_1' })
  })

  it('authenticateUser returns 401 when user is missing', async () => {
    mocks.auth.mockResolvedValue({ userId: null })

    const result = await authenticateUser()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      await expect(result.response.json()).resolves.toEqual({ error: 'Unauthorized' })
    }
  })

  it('authenticateWithOrg returns auth response when auth fails', async () => {
    mocks.auth.mockResolvedValue({ userId: null })

    const req = new NextRequest('http://localhost/api/test')
    const result = await authenticateWithOrg(req)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })

  it('authenticateWithOrg returns 400 when org context is missing', async () => {
    mocks.resolveOrgContext.mockReturnValue(null)

    const req = new NextRequest('http://localhost/api/test')
    const result = await authenticateWithOrg(req)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(400)
      await expect(result.response.json()).resolves.toEqual({
        error: 'Missing organization context',
        code: 'ORG_CONTEXT_REQUIRED',
      })
    }
  })

  it('authenticateWithOrg returns user + org info on success', async () => {
    mocks.resolveOrgContext.mockReturnValue({ orgId: 'org_1', source: 'demo-default' })

    const req = new NextRequest('http://localhost/api/test')
    const result = await authenticateWithOrg(req)

    expect(result).toEqual({
      ok: true,
      userId: 'user_1',
      orgId: 'org_1',
      orgSource: 'demo-default',
    })
  })

  it('requireOrgAccess delegates to authenticateWithOrg', async () => {
    const req = new NextRequest('http://localhost/api/test')
    const result = await requireOrgAccess(req)

    expect(result.ok).toBe(true)
  })

  it('requirePermission returns forbidden when permission is missing', async () => {
    mocks.normalizeRole.mockReturnValue('viewer')
    mocks.hasPermission.mockReturnValue(false)

    const req = new NextRequest('http://localhost/api/test')
    const result = requirePermission(req, 'incident.read')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
  })

  it('requirePermission returns role when permission is present', async () => {
    mocks.normalizeRole.mockReturnValue('admin')
    mocks.hasPermission.mockReturnValue(true)

    const req = new NextRequest('http://localhost/api/test')
    const result = requirePermission(req, 'incident.read')

    expect(result).toEqual({ ok: true, role: 'admin' })
  })

  it('withRequestContext runs handler with os-core context', async () => {
    const req = new NextRequest('http://localhost/api/test')
    const handler = vi.fn().mockResolvedValue({ ok: true })

    const result = await withRequestContext(req, handler)

    expect(mocks.createRequestContext).toHaveBeenCalledWith(req, { appName: 'abr' })
    expect(mocks.runWithContext).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
  })
})
