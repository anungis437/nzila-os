import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createRequestContext: vi.fn(),
  runWithContext: vi.fn(),
  hasPermission: vi.fn(),
  normalizeRole: vi.fn(),
  resolveOrgContext: vi.fn(),
  verifyAbrOrgMembership: vi.fn(),
  resolveAbrRoleForRequest: vi.fn(),
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

vi.mock('@/lib/trusted-auth', () => ({
  verifyAbrOrgMembership: mocks.verifyAbrOrgMembership,
  resolveAbrRoleForRequest: mocks.resolveAbrRoleForRequest,
}))

import {
  authenticateUser,
  authenticateWithOrg,
  requireOrgAccess,
  requirePermission,
  requireVerifiedOrgAccess,
  requireVerifiedPermission,
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
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true,
      role: 'viewer',
      source: 'abr_users_lookup',
    })
    mocks.resolveAbrRoleForRequest.mockReturnValue({
      role: 'viewer',
      source: 'abr_users_lookup',
    })
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

  // ── Phase 2C.6 verified guards ────────────────────────────────────────────

  it('requireVerifiedOrgAccess returns auth failure when authenticateWithOrg fails (no user)', async () => {
    mocks.auth.mockResolvedValue({ userId: null })

    const req = new NextRequest('http://localhost/api/test')
    const result = await requireVerifiedOrgAccess(req)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })

  it('requireVerifiedOrgAccess returns 403 when membership verification fails', async () => {
    mocks.verifyAbrOrgMembership.mockResolvedValue({ ok: false, reason: 'no_membership' })

    const req = new NextRequest('http://localhost/api/test')
    const result = await requireVerifiedOrgAccess(req)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      await expect(result.response.json()).resolves.toEqual({
        error: 'Org access denied',
        code: 'ORG_MEMBERSHIP_REQUIRED',
        reason: 'no_membership',
      })
    }
    expect(mocks.verifyAbrOrgMembership).toHaveBeenCalledWith('user_1', 'org_1')
  })

  it('requireVerifiedOrgAccess returns verified context on success', async () => {
    mocks.verifyAbrOrgMembership.mockResolvedValue({
      ok: true,
      role: 'investigator',
      source: 'abr_users_lookup',
    })
    mocks.resolveAbrRoleForRequest.mockReturnValue({
      role: 'investigator',
      source: 'abr_users_lookup',
    })

    const req = new NextRequest('http://localhost/api/test')
    const result = await requireVerifiedOrgAccess(req)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.context).toEqual({
        userId: 'user_1',
        orgId: 'org_1',
        orgSource: 'header',
        role: 'investigator',
        membershipSource: 'abr_users_lookup',
      })
    }
  })

  it('requireVerifiedPermission returns 403 when role lacks permission', () => {
    mocks.hasPermission.mockReturnValue(false)

    const context = {
      userId: 'user_1',
      orgId: 'org_1',
      orgSource: 'header' as const,
      role: 'learner' as const,
      membershipSource: 'abr_users_lookup' as const,
    }
    const result = requireVerifiedPermission(context, 'incident.transition')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
    }
    expect(mocks.hasPermission).toHaveBeenCalledWith('learner', 'incident.transition')
  })

  it('requireVerifiedPermission returns ok when role has permission', () => {
    mocks.hasPermission.mockReturnValue(true)

    const context = {
      userId: 'user_1',
      orgId: 'org_1',
      orgSource: 'header' as const,
      role: 'investigator' as const,
      membershipSource: 'session_org_match' as const,
    }
    const result = requireVerifiedPermission(context, 'incident.read')

    expect(result).toEqual({ ok: true })
  })
})
