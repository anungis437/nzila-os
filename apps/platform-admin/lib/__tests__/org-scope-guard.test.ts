import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  authMock: vi.fn(),
  whereChainMock: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.authMock,
}))

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: () => ({
      from: () => ({
        where: mocks.whereChainMock,
      }),
    }),
  },
}))

vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  }),
}))

import { requireOrgScope, handleOrgScopeError, OrgScopeError } from '../org-scope-guard'
import { NextRequest, NextResponse } from 'next/server'

type WithOrgScopeType = (
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (context: any) => Promise<NextResponse>
) => Promise<NextResponse>

type CanWriteType = (role: string) => boolean
type CanReadType = (role: string) => boolean
type WithOrgWriteType = (
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (context: any) => Promise<NextResponse>
) => Promise<NextResponse>

describe('org-scope-guard — org scope enforcement for platform-admin', () => {
  beforeEach(() => {
    mocks.authMock.mockReset()
    mocks.whereChainMock.mockReset()
    mocks.whereChainMock.mockReturnValue({
      limit: vi.fn().mockResolvedValue([]),
    })
  })

  describe('requireOrgScope', () => {
    it('throws UNAUTHENTICATED when no user session', async () => {
      mocks.authMock.mockResolvedValue({ userId: null })

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': 'org_123' },
      })

      await expect(requireOrgScope(req)).rejects.toThrow(OrgScopeError)
      await expect(requireOrgScope(req)).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
        status: 401,
      })
    })

    it('throws ORG_SCOPE_REQUIRED when orgId missing from headers and params', async () => {
      mocks.authMock.mockResolvedValue({ userId: 'user_1' })

      const req = new NextRequest('http://localhost/api/test')

      await expect(requireOrgScope(req)).rejects.toThrow(OrgScopeError)
      await expect(requireOrgScope(req)).rejects.toMatchObject({
        code: 'ORG_SCOPE_REQUIRED',
        status: 400,
      })
    })

    it('resolves orgId from x-org-id header', async () => {
      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
      })

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': '550e8400-e29b-41d4-a716-446655440000' },
      })

      const ctx = await requireOrgScope(req)
      expect(ctx.orgId).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('resolves orgId from query param when header missing', async () => {
      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
      })

      const req = new NextRequest('http://localhost/api/test?orgId=550e8400-e29b-41d4-a716-446655440000')

      const ctx = await requireOrgScope(req)
      expect(ctx.orgId).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('prefers x-org-id header over query param', async () => {
      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
      })

      const req = new NextRequest('http://localhost/api/test?orgId=550e8400-e29b-41d4-a716-446655440000', {
        headers: { 'x-org-id': '660e8400-e29b-41d4-a716-446655440001' },
      })

      const ctx = await requireOrgScope(req)
      expect(ctx.orgId).toBe('660e8400-e29b-41d4-a716-446655440001')
    })

    it('throws INVALID_ORG_ID for non-UUID orgId', async () => {
      mocks.authMock.mockResolvedValue({ userId: 'user_1' })

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': 'not-a-uuid' },
      })

      await expect(requireOrgScope(req)).rejects.toThrow(OrgScopeError)
      await expect(requireOrgScope(req)).rejects.toMatchObject({
        code: 'INVALID_ORG_ID',
        status: 400,
      })
    })

    it('throws ORG_FORBIDDEN when actor not member of org', async () => {
      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      })

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': '550e8400-e29b-41d4-a716-446655440000' },
      })

      await expect(requireOrgScope(req)).rejects.toThrow(OrgScopeError)
      await expect(requireOrgScope(req)).rejects.toMatchObject({
        code: 'ORG_FORBIDDEN',
        status: 403,
      })
    })

    it('returns context when actor is active member with admin role', async () => {
      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
      })

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': '550e8400-e29b-41d4-a716-446655440000' },
      })

      const ctx = await requireOrgScope(req)
      expect(ctx).toEqual({
        actorId: 'user_1',
        orgId: '550e8400-e29b-41d4-a716-446655440000',
        orgRole: 'admin',
        authenticationType: 'interactive_user',
      })
    })

    it('returns context when actor is platform-admin override (PLATFORM_ADMIN_USER_IDS)', async () => {
      vi.stubEnv('PLATFORM_ADMIN_USER_IDS', 'user_1,user_2')
      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      })

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': '550e8400-e29b-41d4-a716-446655440000' },
      })

      const ctx = await requireOrgScope(req)
      expect(ctx.orgRole).toBe('admin')
      vi.unstubAllEnvs()
    })

    it('uses requiredOrgId parameter when provided', async () => {
      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
      })

      const req = new NextRequest('http://localhost/api/test')

      const ctx = await requireOrgScope(req, '550e8400-e29b-41d4-a716-446655440000')
      expect(ctx.orgId).toBe('550e8400-e29b-41d4-a716-446655440000')
    })
  })

  describe('handleOrgScopeError', () => {
    it('converts OrgScopeError to NextResponse with error details', () => {
      const error = new OrgScopeError('Test error', 'TEST_CODE', 403)

      const response = handleOrgScopeError(error)
      expect(response.status).toBe(403)
    })

    it('handles unexpected error gracefully', () => {
      const error = new Error('Unexpected error')

      const response = handleOrgScopeError(error)
      expect(response.status).toBe(500)
    })
  })

  describe('Role authorization helpers', () => {
    // Import dynamic to test canWrite and canRead
    it('validates write authority with canWrite', async () => {
      const { canWrite }: { canWrite: CanWriteType } = await import('../org-scope-guard')
      expect(canWrite('admin')).toBe(true)
      expect(canWrite('org_admin')).toBe(true)
      expect(canWrite('org_secretary')).toBe(true)
      expect(canWrite('org_viewer')).toBe(false)
      expect(canWrite('unknown')).toBe(false)
    })

    it('validates read authority with canRead', async () => {
      const { canRead }: { canRead: CanReadType } = await import('../org-scope-guard')
      expect(canRead('admin')).toBe(true)
      expect(canRead('org_admin')).toBe(true)
      expect(canRead('org_secretary')).toBe(true)
      expect(canRead('org_viewer')).toBe(true)
      expect(canRead('unknown')).toBe(false)
    })
  })

  describe('withOrgScope wrapper', () => {
    it('returns handler result when org scope validates successfully', async () => {
      const { withOrgScope }: { withOrgScope: WithOrgScopeType } = await import(
        '../org-scope-guard'
      )

      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'admin' }]),
      })

      const handlerResponse = NextResponse.json({ success: true })
      const handler = vi.fn().mockResolvedValue(handlerResponse)

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': '550e8400-e29b-41d4-a716-446655440000' },
      })

      const response = await withOrgScope(req, handler)
      expect(response).toBe(handlerResponse)
      expect(handler).toHaveBeenCalled()
    })

    it('returns error response when org scope validation fails', async () => {
      const { withOrgScope }: { withOrgScope: WithOrgScopeType } = await import(
        '../org-scope-guard'
      )

      mocks.authMock.mockResolvedValue({ userId: null })

      const handler = vi.fn()
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': '550e8400-e29b-41d4-a716-446655440000' },
      })

      const response = await withOrgScope(req, handler)
      expect(response.status).toBe(401)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('withOrgWrite wrapper', () => {
    it('allows write when actor has write-authorized role', async () => {
      const { withOrgWrite }: { withOrgWrite: WithOrgWriteType } = await import(
        '../org-scope-guard'
      )

      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'org_admin' }]),
      })

      const handlerResponse = NextResponse.json({ success: true })
      const handler = vi.fn().mockResolvedValue(handlerResponse)

      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': '550e8400-e29b-41d4-a716-446655440000' },
      })

      const response = await withOrgWrite(req, handler)
      expect(response).toBe(handlerResponse)
      expect(handler).toHaveBeenCalled()
    })

    it('denies write when actor has read-only role', async () => {
      const { withOrgWrite }: { withOrgWrite: WithOrgWriteType } = await import(
        '../org-scope-guard'
      )

      mocks.authMock.mockResolvedValue({ userId: 'user_1' })
      mocks.whereChainMock.mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ role: 'org_viewer' }]),
      })

      const handler = vi.fn()
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-org-id': '550e8400-e29b-41d4-a716-446655440000' },
      })

      const response = await withOrgWrite(req, handler)
      expect(response.status).toBe(403)
      expect(handler).not.toHaveBeenCalled()
    })
  })
})

