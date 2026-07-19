import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  getAuthContextMock: vi.fn(),
}))

vi.mock('@/lib/auth/getAuthContext', () => ({
  getAuthContext: mocks.getAuthContextMock,
}))

import { hasMinRole, requireRole, withRequiredRole } from './requireRole'
import type { AuthContext } from '@/types/core'

describe('rbac/requireRole — role hierarchy and enforcement', () => {
  beforeEach(() => {
    mocks.getAuthContextMock.mockReset()
  })

  describe('hasMinRole', () => {
    it('grants access when user role meets minimum requirement', () => {
      expect(hasMinRole('org_admin', 'staff')).toBe(true)
      expect(hasMinRole('compliance_officer', 'auditor')).toBe(true)
      expect(hasMinRole('platform_admin', 'org_admin')).toBe(true)
    })

    it('denies access when user role is below minimum', () => {
      expect(hasMinRole('staff', 'org_admin')).toBe(false)
      expect(hasMinRole('auditor', 'staff')).toBe(false)
      expect(hasMinRole('read_only', 'auditor')).toBe(false)
    })

    it('grants access when user role exactly matches minimum', () => {
      expect(hasMinRole('org_admin', 'org_admin')).toBe(true)
      expect(hasMinRole('staff', 'staff')).toBe(true)
    })
  })

  describe('requireRole', () => {
    it('resolves auth context when role is allowed', async () => {
      const mockCtx: AuthContext = {
        userId: 'user_1',
        orgId: 'org_1',
        role: 'org_admin',
      }
      mocks.getAuthContextMock.mockResolvedValue(mockCtx)

      const result = await requireRole(['org_admin'])
      expect(result).toEqual(mockCtx)
    })

    it('throws when auth context cannot be resolved', async () => {
      mocks.getAuthContextMock.mockRejectedValue(new Error('Unauthorized'))

      await expect(requireRole(['org_admin'])).rejects.toThrow('Unauthorized')
    })

    it('throws when user role is not in allowed list', async () => {
      const mockCtx: AuthContext = {
        userId: 'user_1',
        orgId: 'org_1',
        role: 'auditor',
      }
      mocks.getAuthContextMock.mockResolvedValue(mockCtx)

      await expect(requireRole(['org_admin', 'staff'])).rejects.toThrow(
        'Forbidden: role "auditor" is not in [org_admin, staff]',
      )
    })
  })

  describe('withRequiredRole', () => {
    it('returns 403 when auth context resolution fails with OrgRequired error', async () => {
      mocks.getAuthContextMock.mockRejectedValue(
        new Error('OrgRequired'),
      )

      const handler = vi.fn()
      const routeHandler = withRequiredRole(['org_admin'], handler)

      const req = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      })
      const res = await routeHandler(req)

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('Organization context required')
      expect(handler).not.toHaveBeenCalled()
    })

    it('returns 401 when auth context resolution fails with generic error', async () => {
      mocks.getAuthContextMock.mockRejectedValue(
        new Error('Database connection failed'),
      )

      const handler = vi.fn()
      const routeHandler = withRequiredRole(['org_admin'], handler)

      const req = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      })
      const res = await routeHandler(req)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Unauthorized')
      expect(handler).not.toHaveBeenCalled()
    })

    it('returns 401 when non-Error value is thrown', async () => {
      mocks.getAuthContextMock.mockRejectedValue('String error thrown')

      const handler = vi.fn()
      const routeHandler = withRequiredRole(['org_admin'], handler)

      const req = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      })
      const response = await routeHandler(req)

      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.error).toBe('Unauthorized')
      expect(handler).not.toHaveBeenCalled()
    })

    it('returns 403 when user role is insufficient', async () => {
      const mockCtx: AuthContext = {
        userId: 'user_1',
        orgId: 'org_1',
        role: 'auditor',
      }
      mocks.getAuthContextMock.mockResolvedValue(mockCtx)

      const handler = vi.fn()
      const routeHandler = withRequiredRole(['org_admin'], handler)

      const req = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      })
      const res = await routeHandler(req)

      expect(res.status).toBe(403)
      expect(handler).not.toHaveBeenCalled()
    })

    it('calls handler with resolved context and request when role is sufficient', async () => {
      const mockCtx: AuthContext = {
        userId: 'user_1',
        orgId: 'org_1',
        role: 'org_admin',
      }
      mocks.getAuthContextMock.mockResolvedValue(mockCtx)

      const handlerResponse = NextResponse.json({ success: true })
      const handler = vi.fn().mockResolvedValue(handlerResponse)
      const routeHandler = withRequiredRole(['org_admin', 'staff'], handler)

      const req = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      })
      const res = await routeHandler(req)

      expect(res).toBe(handlerResponse)
      expect(handler).toHaveBeenCalledWith(
        expect.any(NextRequest),
        mockCtx,
        undefined,
      )
    })

    it('passes route params to handler when available', async () => {
      const mockCtx: AuthContext = {
        userId: 'user_1',
        orgId: 'org_1',
        role: 'org_admin',
      }
      mocks.getAuthContextMock.mockResolvedValue(mockCtx)

      const handlerResponse = NextResponse.json({ success: true })
      const handler = vi.fn().mockResolvedValue(handlerResponse)
      const routeHandler = withRequiredRole(['org_admin'], handler)

      const req = new NextRequest('http://localhost/api/test', {
        method: 'GET',
      })
      const params = { id: 'resource_1' }
      const _res = await routeHandler(req, { params })

      expect(handler).toHaveBeenCalledWith(
        expect.any(NextRequest),
        mockCtx,
        params,
      )
    })
  })
})
