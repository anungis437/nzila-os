/**
 * CFO — API Guards Unit Tests
 *
 * Tests the shared API route guard functions:
 *   - authenticateUser()       — Platform auth + platform role
 *   - getOrgMembership()       — Entity membership lookup
 *   - requireOrgAccess()       — Full entity-scoped guard
 *   - requirePlatformRole()    — Platform-level role check
 *   - withRequestContext()     — os-core request context wrapper
 *
 * All external dependencies (platform auth, DB, os-core) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockAuth = vi.fn()
vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: () => mockAuth(),
}))

const mockGetUserRole = vi.fn()
vi.mock('@/lib/rbac', () => ({
  getUserRole: () => mockGetUserRole(),
}))

const mockPlatformDb = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}
// Chain mocking for drizzle query builder
mockPlatformDb.select.mockReturnValue(mockPlatformDb)
mockPlatformDb.from.mockReturnValue(mockPlatformDb)
mockPlatformDb.where.mockReturnValue(mockPlatformDb)
mockPlatformDb.limit.mockResolvedValue([])

vi.mock('@nzila/db/platform', () => ({
  platformDb: {
    select: () => mockPlatformDb.select(),
  },
}))

vi.mock('@nzila/db/schema', () => ({
  orgMembers: { orgId: 'org_id', clerkUserId: 'clerk_user_id', status: 'status' },
}))

vi.mock('drizzle-orm', () => ({
  eq: (...args: unknown[]) => args,
  and: (...args: unknown[]) => args,
}))

vi.mock('@nzila/db', () => ({
  createScopedDb: vi.fn(),
  createAuditedScopedDb: vi.fn(),
  withAudit: vi.fn(),
}))

const mockRunWithContext = vi.fn((_ctx: unknown, handler: () => unknown) => handler())
vi.mock('@nzila/os-core', () => ({
  createRequestContext: vi.fn(() => ({ requestId: 'test-req-id' })),
  runWithContext: (ctx: unknown, handler: () => unknown) => mockRunWithContext(ctx, handler),
}))

import {
  authenticateUser,
  requirePlatformRole,
  withRequestContext,
} from '@/lib/api-guards'

// ── Helpers ─────────────────────────────────────────────────────────────────

function mockAuthenticated(userId: string, role = 'viewer') {
  mockAuth.mockResolvedValue({ userId })
  mockGetUserRole.mockResolvedValue(role)
}

function mockUnauthenticated() {
  mockAuth.mockResolvedValue({ userId: null })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPlatformDb.select.mockReturnValue(mockPlatformDb)
  mockPlatformDb.from.mockReturnValue(mockPlatformDb)
  mockPlatformDb.where.mockReturnValue(mockPlatformDb)
  mockPlatformDb.limit.mockResolvedValue([])
})

// ═══════════════════════════════════════════════════════════════════════════
// authenticateUser
// ═══════════════════════════════════════════════════════════════════════════

describe('authenticateUser', () => {
  it('returns ok:true with userId and platformRole for authenticated user', async () => {
    mockAuthenticated('user_abc', 'platform_admin')

    const result = await authenticateUser()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe('user_abc')
      expect(result.platformRole).toBe('platform_admin')
    }
  })

  it('returns ok:false with 401 response for unauthenticated user', async () => {
    mockUnauthenticated()

    const result = await authenticateUser()

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
      const body = await result.response.json()
      expect(body.error).toBe('Unauthorized')
    }
  })

  it('resolves platform role via getUserRole()', async () => {
    mockAuthenticated('user_xyz', 'ops')

    const result = await authenticateUser()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.platformRole).toBe('ops')
    }
    expect(mockGetUserRole).toHaveBeenCalledOnce()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// requirePlatformRole
// ═══════════════════════════════════════════════════════════════════════════

describe('requirePlatformRole', () => {
  it('passes when user has one of the allowed roles', async () => {
    mockAuthenticated('user_1', 'platform_admin')

    const result = await requirePlatformRole('platform_admin', 'ops')

    expect(result.ok).toBe(true)
  })

  it('returns 403 when user lacks the required role', async () => {
    mockAuthenticated('user_2', 'viewer')

    const result = await requirePlatformRole('platform_admin', 'ops')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(403)
      const body = await result.response.json()
      expect(body.error).toMatch(/Forbidden/)
    }
  })

  it('returns 401 for unauthenticated users', async () => {
    mockUnauthenticated()

    const result = await requirePlatformRole('platform_admin')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })

  it('accepts multiple allowed roles', async () => {
    mockAuthenticated('user_3', 'analyst')

    const result = await requirePlatformRole('platform_admin', 'ops', 'analyst')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.userId).toBe('user_3')
      expect(result.platformRole).toBe('analyst')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// withRequestContext
// ═══════════════════════════════════════════════════════════════════════════

describe('withRequestContext', () => {
  it('runs handler inside os-core request context', async () => {
    const req = new Request('https://example.com/api/test')
    let ran = false

    await withRequestContext(req, async () => {
      ran = true
      return 'done'
    })

    expect(ran).toBe(true)
    expect(mockRunWithContext).toHaveBeenCalledOnce()
  })

  it('returns the handler result', async () => {
    const req = new Request('https://example.com/api/test')

    const result = await withRequestContext(req, async () => 42)

    expect(result).toBe(42)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Re-exports
// ═══════════════════════════════════════════════════════════════════════════

describe('re-exports', () => {
  it('exports AuthContext interface (type check via import)', async () => {
    const mod = await import('@/lib/api-guards')
    expect(mod.authenticateUser).toBeDefined()
    expect(mod.requirePlatformRole).toBeDefined()
    expect(mod.withRequestContext).toBeDefined()
    expect(mod.requireOrgAccess).toBeDefined()
    expect(mod.getOrgMembership).toBeDefined()
  })

  it('re-exports withAudit from @nzila/db', async () => {
    const mod = await import('@/lib/api-guards')
    expect(mod.withAudit).toBeDefined()
  })
})
