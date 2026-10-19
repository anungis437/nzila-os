import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const ADMIN = 'user-admin-a'
const MEMBER = 'user-member-a'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userHasOrganizationAccess: vi.fn(),
  getUserRole: vi.fn(),
  hasRole: vi.fn(),
  requireEntitlement: vi.fn(),
  auditLog: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/organization-utils', () => ({
  userHasOrganizationAccess: mocks.userHasOrganizationAccess,
}))
vi.mock('@/lib/api-auth-guard', () => ({
  getUserRole: mocks.getUserRole,
  hasRole: mocks.hasRole,
  normalizeRole: (role: string) => (role === 'super_admin' ? 'admin' : role),
}))
vi.mock('@/lib/audit-logger', () => ({
  auditLog: mocks.auditLog,
  AuditEventType: { AUTHORITY_VIOLATION: 'authority.violation' },
  AuditSeverity: { HIGH: 'error' },
}))
vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  PLATFORM_MODULES: { FINANCIAL_INTELLIGENCE_SUITE: 'financial_intelligence_suite' },
  requireEntitlement: mocks.requireEntitlement,
}))

import {
  authorizeEmploymentAccess,
  EMPLOYMENT_DUES_ENTITLEMENT,
  leaveApprovalAttempted,
  leaveSelfApprovalDenied,
  MEMBER_EMPLOYMENT_SELF_SERVICE,
  rolePermitsEmploymentAdmin,
  rolePermitsEmploymentFinance,
} from '../authorize-employment-access'

function asMember(userId: string, organizationId: string, role: string) {
  mocks.auth.mockResolvedValue({ userId })
  mocks.userHasOrganizationAccess.mockImplementation(async (candidate: string, org: string) => {
    return candidate === userId && org === organizationId
  })
  mocks.getUserRole.mockImplementation(async (candidate: string, org: string) => {
    if (candidate !== userId || org !== organizationId) return null
    return role
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.hasRole.mockRejectedValue(new Error('hasRole must not be used'))
  mocks.auditLog.mockResolvedValue(undefined)
  mocks.requireEntitlement.mockResolvedValue({ allowed: true })
})

describe('employment role policy', () => {
  it('keeps member self-service denied', () => {
    expect(MEMBER_EMPLOYMENT_SELF_SERVICE).toBe('denied')
  })

  it('admits organizational employment administrators, including legacy super_admin', () => {
    expect(rolePermitsEmploymentAdmin('admin')).toBe(true)
    expect(rolePermitsEmploymentAdmin('super_admin')).toBe(true)
    expect(rolePermitsEmploymentAdmin('president')).toBe(true)
    expect(rolePermitsEmploymentAdmin('secretary_treasurer')).toBe(true)
    expect(rolePermitsEmploymentAdmin('steward')).toBe(false)
    expect(rolePermitsEmploymentAdmin('member')).toBe(false)
    expect(rolePermitsEmploymentAdmin('system_admin')).toBe(false)
    expect(rolePermitsEmploymentAdmin(null)).toBe(false)
  })

  it('limits compensation authority to finance roles', () => {
    expect(rolePermitsEmploymentFinance('secretary_treasurer')).toBe(true)
    expect(rolePermitsEmploymentFinance('president')).toBe(true)
    expect(rolePermitsEmploymentFinance('admin')).toBe(false)
    expect(rolePermitsEmploymentFinance('steward')).toBe(false)
  })

  it('detects approval attempts and self-approval', () => {
    expect(leaveApprovalAttempted({ isApproved: false })).toBe(false)
    expect(leaveApprovalAttempted({ isApproved: true })).toBe(true)
    expect(leaveApprovalAttempted({ approvedBy: 'someone' })).toBe(true)
    expect(leaveSelfApprovalDenied(ADMIN, ADMIN)).toBe(true)
    expect(leaveSelfApprovalDenied(ADMIN, MEMBER)).toBe(false)
  })
})

describe('authorizeEmploymentAccess', () => {
  it('denies an unauthenticated caller', async () => {
    mocks.auth.mockResolvedValue({ userId: null })
    const decision = await authorizeEmploymentAccess(ORG_A, 'administer')
    expect(decision).toEqual({ ok: false, message: 'Unauthorized' })
    expect(mocks.getUserRole).not.toHaveBeenCalled()
    expect(mocks.hasRole).not.toHaveBeenCalled()
  })

  it('denies a missing or blank organization id', async () => {
    mocks.auth.mockResolvedValue({ userId: ADMIN })
    expect(await authorizeEmploymentAccess('', 'administer')).toEqual({ ok: false, message: 'Forbidden' })
    expect(await authorizeEmploymentAccess('   ', 'administer')).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.userHasOrganizationAccess).not.toHaveBeenCalled()
  })

  it('denies a member of another organization', async () => {
    asMember(ADMIN, ORG_A, 'admin')
    const decision = await authorizeEmploymentAccess(ORG_B, 'administer')
    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.getUserRole).not.toHaveBeenCalled()
  })

  it('denies a member role and a steward', async () => {
    asMember(MEMBER, ORG_A, 'member')
    expect(await authorizeEmploymentAccess(ORG_A, 'administer')).toEqual({ ok: false, message: 'Forbidden' })
    asMember(MEMBER, ORG_A, 'steward')
    expect(await authorizeEmploymentAccess(ORG_A, 'administer')).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.hasRole).not.toHaveBeenCalled()
  })

  it('denies platform system_admin even when the membership row says so', async () => {
    asMember(ADMIN, ORG_A, 'system_admin')
    expect(await authorizeEmploymentAccess(ORG_A, 'administer')).toEqual({ ok: false, message: 'Forbidden' })
  })

  it('admits an organization admin and binds the role lookup to that principal', async () => {
    asMember(ADMIN, ORG_A, 'admin')
    const decision = await authorizeEmploymentAccess(ORG_A, 'administer')
    expect(decision).toEqual({
      ok: true,
      userId: ADMIN,
      organizationId: ORG_A,
      capability: 'administer',
    })
    expect(mocks.getUserRole).toHaveBeenCalledWith(ADMIN, ORG_A)
    expect(mocks.hasRole).not.toHaveBeenCalled()
  })

  it('fails closed when the role lookup throws', async () => {
    asMember(ADMIN, ORG_A, 'admin')
    mocks.getUserRole.mockRejectedValue(new Error('down'))
    expect(await authorizeEmploymentAccess(ORG_A, 'administer')).toEqual({ ok: false, message: 'Forbidden' })
  })

  it('requires the finance role and the dues entitlement for compensation', async () => {
    asMember(ADMIN, ORG_A, 'secretary_treasurer')
    const decision = await authorizeEmploymentAccess(ORG_A, 'finance')
    expect(decision.ok).toBe(true)
    expect(mocks.requireEntitlement).toHaveBeenCalledWith(ORG_A, EMPLOYMENT_DUES_ENTITLEMENT, ADMIN)

    asMember(ADMIN, ORG_A, 'admin')
    expect(await authorizeEmploymentAccess(ORG_A, 'finance')).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.requireEntitlement).toHaveBeenCalledTimes(1)
  })

  it('denies finance when the entitlement is missing', async () => {
    asMember(ADMIN, ORG_A, 'president')
    const error = Object.assign(new Error('Entitlement required'), { code: 'ENTITLEMENT_REQUIRED' })
    mocks.requireEntitlement.mockRejectedValue(error)
    expect(await authorizeEmploymentAccess(ORG_A, 'finance')).toEqual({
      ok: false,
      message: 'Module access denied',
    })
  })
})
