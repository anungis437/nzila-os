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
  getUserRole: vi.fn(),
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
  getUserRole: mocks.getUserRole,
  normalizeRole: (role: string) => (role === 'super_admin' ? 'admin' : role === 'union_steward' ? 'steward' : role),
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
  actorCanManagePrivateSegments,
  authorizeMemberSegmentAccess,
  MEMBER_SEGMENT_EXPORT_ENTITLEMENT,
  MEMBER_SEGMENT_MIN_ROLE,
  resolveSegmentVisibility,
} from '../authorize-segment-access'

function grantMembership(userId: string, organizationId: string, roleAllowed: boolean) {
  mocks.auth.mockResolvedValue({ userId })
  mocks.userHasOrganizationAccess.mockImplementation(async (candidate: string, org: string) => {
    return candidate === userId && org === organizationId
  })
  mocks.hasRoleInOrganization.mockImplementation(async (org: string, role: string, actor?: string) => {
    return roleAllowed && org === organizationId && role === MEMBER_SEGMENT_MIN_ROLE && actor === userId
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
    expect(mocks.hasRoleInOrganization).toHaveBeenCalledWith(ORG_A, 'steward', STEWARD_A)
  })

  it('admits a legacy-compatible steward when the shared role gate accepts the principal', async () => {
    grantMembership(STEWARD_A, ORG_A, true)

    const decision = await authorizeMemberSegmentAccess(ORG_A)

    expect(decision.ok).toBe(true)
    expect(mocks.hasRoleInOrganization).toHaveBeenCalledWith(ORG_A, MEMBER_SEGMENT_MIN_ROLE, STEWARD_A)
  })

  it('denies when the role gate is evaluated for a different principal than the membership check', async () => {
    grantMembership(STEWARD_A, ORG_A, true)
    mocks.hasRoleInOrganization.mockImplementation(async (_org: string, _role: string, actor?: string) => {
      return actor === 'someone-else'
    })

    const decision = await authorizeMemberSegmentAccess(ORG_A)

    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.userHasOrganizationAccess).toHaveBeenCalledWith(STEWARD_A, ORG_A)
    expect(mocks.hasRoleInOrganization).toHaveBeenCalledWith(ORG_A, 'steward', STEWARD_A)
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

  it('lets an organization administrator manage another member private segments in that organization only', async () => {
    mocks.getUserRole.mockImplementation(async (userId: string, organizationId: string) => {
      if (userId === STEWARD_A && organizationId === ORG_A) return 'admin'
      return null
    })

    await expect(actorCanManagePrivateSegments(STEWARD_A, ORG_A)).resolves.toBe(true)
    await expect(actorCanManagePrivateSegments(STEWARD_A, ORG_B)).resolves.toBe(false)
    expect(mocks.getUserRole).toHaveBeenCalledWith(STEWARD_A, ORG_A)
    expect(mocks.getUserRole).toHaveBeenCalledWith(STEWARD_A, ORG_B)
  })

  it('does not infer private-segment management from rank', async () => {
    for (const role of ['steward', 'union_steward', 'chief_steward', 'president', 'app_owner', 'member']) {
      mocks.getUserRole.mockResolvedValueOnce(role)
      await expect(actorCanManagePrivateSegments(MEMBER_A, ORG_A)).resolves.toBe(false)
    }
    mocks.getUserRole.mockResolvedValueOnce('super_admin')
    await expect(actorCanManagePrivateSegments(MEMBER_A, ORG_A)).resolves.toBe(true)
  })

  it('fails closed when the bound role lookup throws', async () => {
    mocks.getUserRole.mockRejectedValueOnce(new Error('role store unavailable'))
    await expect(actorCanManagePrivateSegments(STEWARD_A, ORG_A)).resolves.toBe(false)
  })

  it('keeps another steward private segments out of the default list', async () => {
    mocks.getUserRole.mockResolvedValue('steward')

    const decision = await resolveSegmentVisibility(
      { userId: STEWARD_A, organizationId: ORG_A },
      'own-and-public',
    )

    expect(decision).toEqual({
      ok: true,
      visibility: { actorUserId: STEWARD_A, includeOthersPrivate: false },
    })
    expect(mocks.getUserRole).not.toHaveBeenCalled()
  })

  it('denies a request for other members private segments without the administrator allow-list', async () => {
    mocks.getUserRole.mockResolvedValue('steward')

    const decision = await resolveSegmentVisibility(
      { userId: STEWARD_A, organizationId: ORG_A },
      'include-others-private',
    )

    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
    expect(mocks.getUserRole).toHaveBeenCalledWith(STEWARD_A, ORG_A)
    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: STEWARD_A,
        organizationId: ORG_A,
        metadata: expect.objectContaining({ reason: 'private_segment_management_required' }),
      }),
    )
  })

  it('widens a single-segment read only for the administrator of that organization', async () => {
    mocks.getUserRole.mockImplementation(async (userId: string, organizationId: string) => {
      if (userId === STEWARD_A && organizationId === ORG_A) return 'admin'
      if (userId === MEMBER_A && organizationId === ORG_A) return 'steward'
      return null
    })

    const adminRecord = await resolveSegmentVisibility(
      { userId: STEWARD_A, organizationId: ORG_A },
      'record',
    )
    const stewardRecord = await resolveSegmentVisibility(
      { userId: MEMBER_A, organizationId: ORG_A },
      'record',
    )
    const otherOrganization = await resolveSegmentVisibility(
      { userId: STEWARD_A, organizationId: ORG_B },
      'include-others-private',
    )

    expect(adminRecord).toEqual({
      ok: true,
      visibility: { actorUserId: STEWARD_A, includeOthersPrivate: true },
    })
    expect(stewardRecord).toEqual({
      ok: true,
      visibility: { actorUserId: MEMBER_A, includeOthersPrivate: false },
    })
    expect(otherOrganization).toEqual({ ok: false, message: 'Forbidden' })
  })

  it('still denies when the in-organization audit write fails', async () => {
    grantMembership(MEMBER_A, ORG_A, false)
    mocks.auditLog.mockRejectedValueOnce(new Error('audit store unavailable'))

    const decision = await authorizeMemberSegmentAccess(ORG_A)

    expect(decision).toEqual({ ok: false, message: 'Forbidden' })
  })
})
