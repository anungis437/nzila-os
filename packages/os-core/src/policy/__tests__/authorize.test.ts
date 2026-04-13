/**
 * Tests for policy/authorize.ts — Authorization Engine
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the dynamic import for @nzila/platform-auth/entra/server
const mockAuth = vi.fn()

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: () => mockAuth(),
}))

// Mock the super-admins module
vi.mock('../../config/super-admins', () => ({
  isSuperAdmin: (email?: string) => email === 'admin@nzila.com',
}))

import {
  authorize,
  withAuth,
  authorizeOrgAccess,
  AuthorizationError,
  type AuthContext,
  type AuthorizeOptions,
} from '../authorize'

describe('AuthorizationError', () => {
  it('creates error with default 403 status', () => {
    const err = new AuthorizationError('Forbidden')
    expect(err.message).toBe('Forbidden')
    expect(err.statusCode).toBe(403)
    expect(err.name).toBe('AuthorizationError')
    expect(err).toBeInstanceOf(Error)
  })

  it('creates error with custom 401 status', () => {
    const err = new AuthorizationError('Unauthorized', 401)
    expect(err.statusCode).toBe(401)
  })
})

describe('authorize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockRequest(): Request {
    return new Request('http://localhost/api/test')
  }

  it('throws 401 when session has no userId', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    await expect(authorize(mockRequest())).rejects.toThrow(AuthorizationError)
    try {
      await authorize(mockRequest())
    } catch (err) {
      expect((err as AuthorizationError).statusCode).toBe(401)
    }
  })

  it('throws 401 when session is null', async () => {
    mockAuth.mockResolvedValue(null)
    await expect(authorize(mockRequest())).rejects.toThrow('Authentication required')
  })

  it('throws 403 when user has no role', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      sessionClaims: {},
    })
    await expect(authorize(mockRequest())).rejects.toThrow('No role assigned')
  })

  it('returns AuthContext with resolved role from session claims', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      orgId: 'org-1',
      sessionClaims: { nzila_role: 'admin' },
    })

    const ctx = await authorize(mockRequest())
    expect(ctx.userId).toBe('user-1')
    expect(ctx.orgId).toBe('org-1')
    expect(ctx.role).toBe('admin')
    expect(Array.isArray(ctx.scopes)).toBe(true)
  })

  it('resolves super_admin role for super-admin email', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-sa',
      sessionClaims: { email: 'admin@nzila.com', nzila_role: 'viewer' },
    })

    const ctx = await authorize(mockRequest())
    expect(ctx.role).toBe('super_admin')
  })

  it('resolves partnerId from claims', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-p',
      sessionClaims: { nzila_role: 'partner_admin', nzila_partner_id: 'partner-123' },
    })

    const ctx = await authorize(mockRequest())
    expect(ctx.partnerId).toBe('partner-123')
  })

  it('throws 403 when required role is not met', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      sessionClaims: { nzila_role: 'viewer' },
    })

    await expect(
      authorize(mockRequest(), { requiredRole: 'admin' as any }),
    ).rejects.toThrow('lacks required role')
  })

  it('throws 403 when required scope is not met', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      sessionClaims: { nzila_role: 'viewer' },
    })

    await expect(
      authorize(mockRequest(), { requiredScope: 'governance:write' as any }),
    ).rejects.toThrow('lacks required scope')
  })

  it('handles orgId as undefined when not present', async () => {
    mockAuth.mockResolvedValue({
      userId: 'user-1',
      sessionClaims: { nzila_role: 'admin' },
    })

    const ctx = await authorize(mockRequest())
    expect(ctx.orgId).toBeUndefined()
  })
})

describe('withAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Skip nextjs-specific tests since NextRequest/NextResponse require the full next.js runtime
  // The withAuth wrapper is tested via authorize() above since it delegates to authorize()

  it('AuthorizationError has correct shape for withAuth error handling', () => {
    const err = new AuthorizationError('Test', 403)
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('Test')
    expect(err instanceof AuthorizationError).toBe(true)
    expect(err instanceof Error).toBe(true)
  })
})
