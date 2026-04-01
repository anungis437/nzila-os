import { describe, it, expect } from 'vitest'
import {
  requireOrgScope,
  requirePermission,
  requireRole,
  assertSameOrg,
  withOrgScope,
  OrgScopeRequiredError,
  OrgAccessDeniedError,
} from './guards.js'
import type { OrgContext } from './types.js'

function makeCtx(overrides?: Partial<OrgContext>): OrgContext {
  return {
    orgId: 'org-1',
    actorId: 'user-1',
    role: 'org_admin',
    permissions: ['read', 'write'],
    requestId: 'req-1',
    ...overrides,
  }
}

describe('requireOrgScope', () => {
  it('passes with valid context', () => {
    expect(() => requireOrgScope(makeCtx())).not.toThrow()
  })

  it('throws OrgScopeRequiredError when null', () => {
    expect(() => requireOrgScope(null)).toThrow(OrgScopeRequiredError)
  })

  it('throws OrgScopeRequiredError when undefined', () => {
    expect(() => requireOrgScope(undefined)).toThrow(OrgScopeRequiredError)
  })
})

describe('requirePermission', () => {
  it('passes when permission is present', () => {
    expect(() => requirePermission(makeCtx(), 'read')).not.toThrow()
  })

  it('throws OrgAccessDeniedError when permission is missing', () => {
    expect(() => requirePermission(makeCtx(), 'delete')).toThrow(OrgAccessDeniedError)
  })
})

describe('requireRole', () => {
  it('passes when actor has an allowed role', () => {
    expect(() => requireRole(makeCtx(), 'org_admin', 'org_member')).not.toThrow()
  })

  it('throws when role is not in allowed set', () => {
    expect(() => requireRole(makeCtx(), 'platform_admin')).toThrow(OrgAccessDeniedError)
  })
})

describe('assertSameOrg', () => {
  it('passes when orgIds match', () => {
    expect(() => assertSameOrg(makeCtx(), 'org-1')).not.toThrow()
  })

  it('throws on cross-org access (CROSS_ORG_DENY_001)', () => {
    expect(() => assertSameOrg(makeCtx(), 'org-other')).toThrow(OrgAccessDeniedError)
  })
})

describe('withOrgScope', () => {
  it('wraps a function with org scope enforcement', () => {
    const inner = (ctx: OrgContext, x: number) => x * 2
    const guarded = withOrgScope(inner)
    expect(guarded(makeCtx(), 5)).toBe(10)
  })

  it('throws if context is null', () => {
    const inner = (ctx: OrgContext) => ctx.orgId
    const guarded = withOrgScope(inner)
    expect(() => guarded(null as unknown as OrgContext)).toThrow(OrgScopeRequiredError)
  })
})
