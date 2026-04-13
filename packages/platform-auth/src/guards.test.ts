import { describe, it, expect } from 'vitest'
import {
  requireAuth,
  requireOrgScopeGuard,
  requireOrgMembership,
  requirePlatformRoleGuard,
  buildOrgContext,
} from './guards'
import type { AuthenticatedIdentity, OrgMembership } from './identity'

function makeIdentity(overrides?: Partial<AuthenticatedIdentity>): AuthenticatedIdentity {
  return {
    userId: 'user-1',
    email: 'user@example.com',
    activeOrgId: 'org-1',
    orgRole: 'org_admin',
    isService: false,
    ...overrides,
  }
}

function makeMembership(overrides?: Partial<OrgMembership>): OrgMembership {
  return {
    id: 'mem-1',
    orgId: 'org-1',
    userId: 'user-1',
    role: 'org_admin',
    status: 'active',
    ...overrides,
  }
}

// ── requireAuth ──────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('returns ok:true with identity when authenticated', () => {
    const identity = makeIdentity()
    const result = requireAuth(identity)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe(identity)
  })

  it('returns ok:false with 401 when null', () => {
    const result = requireAuth(null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.httpStatus).toBe(401)
      expect(result.error.code).toBe('AUTH_REQUIRED')
    }
  })

  it('returns ok:false with 401 when undefined', () => {
    const result = requireAuth(undefined)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.httpStatus).toBe(401)
  })
})

// ── requireOrgScopeGuard ─────────────────────────────────────────────────────

describe('requireOrgScopeGuard', () => {
  it('returns ok:true with orgId when activeOrgId is set', () => {
    const identity = makeIdentity({ activeOrgId: 'org-42' })
    const result = requireOrgScopeGuard(identity)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.orgId).toBe('org-42')
      expect(result.value.identity).toBe(identity)
    }
  })

  it('returns ok:false with 403 when no activeOrgId', () => {
    const identity = makeIdentity({ activeOrgId: undefined })
    const result = requireOrgScopeGuard(identity)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.httpStatus).toBe(403)
      expect(result.error.code).toBe('ORG_SCOPE_REQUIRED')
    }
  })
})

// ── requireOrgMembership ─────────────────────────────────────────────────────

describe('requireOrgMembership', () => {
  it('returns ok:true for active membership', () => {
    const identity = makeIdentity()
    const membership = makeMembership()
    const result = requireOrgMembership(identity, membership)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.membership).toBe(membership)
      expect(result.value.identity).toBe(identity)
    }
  })

  it('returns ok:false with 403 for null membership', () => {
    const identity = makeIdentity()
    const result = requireOrgMembership(identity, null)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.httpStatus).toBe(403)
      expect(result.error.code).toBe('ACCESS_DENIED')
    }
  })

  it('returns ok:false with 403 for suspended membership', () => {
    const identity = makeIdentity()
    const membership = makeMembership({ status: 'suspended' })
    const result = requireOrgMembership(identity, membership)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.httpStatus).toBe(403)
  })

  it('returns ok:false when minRole is not met', () => {
    const identity = makeIdentity()
    const membership = makeMembership({ role: 'org_viewer' })
    const result = requireOrgMembership(identity, membership, { minRole: 'org_admin' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.httpStatus).toBe(403)
      expect(result.error.code).toBe('ACCESS_DENIED')
    }
  })

  it('returns ok:true when role meets minRole', () => {
    const identity = makeIdentity()
    const membership = makeMembership({ role: 'org_admin' })
    const result = requireOrgMembership(identity, membership, { minRole: 'org_secretary' })
    expect(result.ok).toBe(true)
  })

  it('service account bypasses membership check with null membership', () => {
    const identity = makeIdentity({ isService: true, activeOrgId: 'org-svc' })
    const result = requireOrgMembership(identity, null)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.membership.role).toBe('org_admin')
      expect(result.value.membership.status).toBe('active')
    }
  })

  it('service account bypasses membership check with existing membership', () => {
    const identity = makeIdentity({ isService: true })
    const membership = makeMembership({ role: 'org_viewer' })
    const result = requireOrgMembership(identity, membership)
    expect(result.ok).toBe(true)
  })
})

// ── requirePlatformRoleGuard ─────────────────────────────────────────────────

describe('requirePlatformRoleGuard', () => {
  it('returns ok:true when role is allowed', () => {
    const result = requirePlatformRoleGuard('platform_admin', 'platform_admin', 'org_admin')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe('platform_admin')
  })

  it('returns ok:false with 403 when role is not allowed', () => {
    const result = requirePlatformRoleGuard('org_viewer', 'platform_admin')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.httpStatus).toBe(403)
      expect(result.error.code).toBe('ACCESS_DENIED')
    }
  })
})

// ── buildOrgContext ──────────────────────────────────────────────────────────

describe('buildOrgContext', () => {
  it('builds org context with provided requestId', () => {
    const identity = makeIdentity()
    const ctx = buildOrgContext(identity, 'org-1', 'org_admin', ['read', 'write'], 'req-abc')
    expect(ctx.orgId).toBe('org-1')
    expect(ctx.actorId).toBe(identity.userId)
    expect(ctx.role).toBe('org_admin')
    expect(ctx.permissions).toEqual(['read', 'write'])
    expect(ctx.requestId).toBe('req-abc')
  })

  it('generates a requestId when not provided', () => {
    const identity = makeIdentity()
    const ctx = buildOrgContext(identity, 'org-1', 'org_admin', [])
    expect(typeof ctx.requestId).toBe('string')
    expect(ctx.requestId.length).toBeGreaterThan(0)
  })
})
