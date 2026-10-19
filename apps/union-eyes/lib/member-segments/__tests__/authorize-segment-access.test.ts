/**
 * Synthetic two-organization negative tests for member-segment authorization.
 *
 * Principals, roles, and memberships are fixtures. No customer records.
 * `hasRoleInOrganization` is the legacy-role boundary (union_steward → steward);
 * this file asserts the segment gate uses that result rather than a second path.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const STEWARD_A = 'user-steward-a'
const MEMBER_A = 'user-member-a'
const STRANGER = 'user-stranger-b'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userHasOrganizationAccess: vi.fn(),
  hasRoleInOrganization: vi.fn(),
  requireEntitlement: vi.fn(),
  auditLog: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: mocks.auth,
}))

vi.mock('@/lib/organization-utils', () => ({
  userHasOrganizationAccess: mocks.userHasOrganizationAccess,
}))

vi.mock('@/lib/api-auth-guard', () => ({
  hasRoleInOrganization: mocks.hasRoleInOrganization,
}))

vi.mock('@/lib/audit-logger', () => ({
  auditLog: mocks.auditLog,
  AuditEventType: { AUTHORITY_VIOLATION: 'authority.violation' },
  AuditSeverity: { HIGH: 'error' },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: mocks.warn, error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  PLATFORM_MODULES: { EXPORT_SUITE: 'export_suite' },
  requireEntitlement: mocks.requireEntitlement,
}))

import {
  authorizeMemberSegmentAccess,
  MEMBER_SEGMENT_EXPORT_ENTITLEMENT,
  MEMBER_SEGMENT_MIN_ROLE,
} from '../authorize-segment-access'

function grantMembership(userId: string, organizationId: string, roleAllowed: boolean) {
  mocks.auth.mockResolvedValue({ userId })
  mocks.userHasOrganizationAccess.mockImplementation(async (candidate: string, org: string) => {
    return candidate === userId && org === organizationId
  })
  mocks.hasRoleInOrganization.mockImplementation(async (org: string, role: string) => {
    return roleAllowed && org === organizationId && role === MEMBER_SEGMENT_MIN_ROLE
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auditLog.mockResolvedValue(undefined)
  mocks.requireEntitlement.mockResolvedValue({ allowed: true })
})

describe('authorizeMemberSegmentAccess', () => {
  it('admits a steward to their own organization', async () => {
    grantMembership(STEWARD_A, ORG_A, true)

    const decision = await authorizeMemberSegmentAccess(ORG_A)

    expect(decision).toEqual({ ok: true, userId: STEWARD_A, organizationId: ORG_A })
    expect(mocks.userHasOrganizationAccess).toHaveBeenCalledWith(STEWARD_A, ORG_A)
    expect(mocks.hasRoleInOrganization).toHaveBeenCalledWith(ORG_A, 'steward')
  })

  it('admits a legacy-compatible steward when the shared role gate accepts the principal', async () => {
    grantMembership(STEWARD_A, ORG_A, true)

    const decision = await authorizeMemberSegmentAccess(ORG_A)

    expect(decision.ok).toBe(true)
    expect(mocks.hasRoleInOrganization).toHaveBeenCalledWith(ORG_A, MEMBER_SEGMENT_MIN_ROLE)
  })

  it('denies a read of another organization even when that organization exists for someone else', async () => {
    grantMembership(STEWARD_A, ORG_A, true)

    const decision = await authorizeMemberSegmentAccess(ORG_B)

    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.hasRoleInOrganization).not.toHaveBeenCalled()
    expect(mocks.auditLog).not.toHaveBeenCalled()
    expect(mocks.warn).toHaveBeenCalledWith(
      'member-segment cross-tenant access denied',
      expect.objectContaining({
        userId: STEWARD_A,
        requestedOrganizationId: ORG_B,
        reason: 'membership_required',
      }),
    )
  })

  it('denies an existing organization when the principal has no membership', async () => {
    mocks.auth.mockResolvedValue({ userId: STRANGER })
    mocks.userHasOrganizationAccess.mockResolvedValue(false)

    const decision = await authorizeMemberSegmentAccess(ORG_A)

    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.auditLog).not.toHaveBeenCalled()
  })

  it('denies a nonexistent organization identifier', async () => {
    mocks.auth.mockResolvedValue({ userId: STEWARD_A })
    mocks.userHasOrganizationAccess.mockResolvedValue(false)

    const decision = await authorizeMemberSegmentAccess('not-an-organization')

    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
  })

  it('denies a member of the organization whose role is below steward', async () => {
    grantMembership(MEMBER_A, ORG_A, false)

    const decision = await authorizeMemberSegmentAccess(ORG_A)

    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'authority.violation',
        userId: MEMBER_A,
        organizationId: ORG_A,
        outcome: 'failure',
        metadata: expect.objectContaining({ reason: 'insufficient_role' }),
      }),
    )
  })

  it('denies export when the organization lacks the export entitlement', async () => {
    grantMembership(STEWARD_A, ORG_A, true)
    const denial = Object.assign(new Error('Entitlement required: export_suite — inactive'), {
      code: 'ENTITLEMENT_REQUIRED',
    })
    mocks.requireEntitlement.mockRejectedValueOnce(denial)

    const decision = await authorizeMemberSegmentAccess(ORG_A, {
      entitlement: MEMBER_SEGMENT_EXPORT_ENTITLEMENT,
    })

    expect(decision).toEqual({ ok: false, message: 'Module access denied' })
    expect(mocks.requireEntitlement).toHaveBeenCalledWith(ORG_A, 'export_suite', STEWARD_A)
  })

  it('allows export when membership, role, and entitlement all hold', async () => {
    grantMembership(STEWARD_A, ORG_A, true)

    const decision = await authorizeMemberSegmentAccess(ORG_A, {
      entitlement: MEMBER_SEGMENT_EXPORT_ENTITLEMENT,
    })

    expect(decision).toEqual({ ok: true, userId: STEWARD_A, organizationId: ORG_A })
  })

  it('denies a missing or expired authentication session', async () => {
    mocks.auth.mockResolvedValue({ userId: null })

    const decision = await authorizeMemberSegmentAccess(ORG_A)

    expect(decision).toEqual({ ok: false, message: 'Unauthorized' })
    expect(mocks.userHasOrganizationAccess).not.toHaveBeenCalled()
  })

  it('denies an empty organization id', async () => {
    mocks.auth.mockResolvedValue({ userId: STEWARD_A })

    const decision = await authorizeMemberSegmentAccess('   ')

    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.userHasOrganizationAccess).not.toHaveBeenCalled()
  })

  it('still denies when the in-organization audit write fails', async () => {
    grantMembership(MEMBER_A, ORG_A, false)
    mocks.auditLog.mockRejectedValueOnce(new Error('audit store unavailable'))

    const decision = await authorizeMemberSegmentAccess(ORG_A)

    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
  })
})
