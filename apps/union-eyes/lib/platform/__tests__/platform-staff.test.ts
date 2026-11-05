import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message)
    }
    static forbidden = (message: string) => new TestApiError(403, message)
  }
  return {
    ApiError: TestApiError,
    isPlatformAdminUser: vi.fn(),
    persistAtomicAudit: vi.fn(),
    withRLSContext: vi.fn(),
    loggerError: vi.fn(),
  }
})

vi.mock('@/lib/api/framework', () => ({ ApiError: m.ApiError }))
vi.mock('@/lib/api-auth-guard', () => ({ isPlatformAdminUser: m.isPlatformAdminUser }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }))
vi.mock('@/lib/logger', () => ({ logger: { error: m.loggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { PLATFORM_CAPABILITIES, requirePlatformStaffAuthority } from '../platform-staff'

// DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ, DEF-0B10-OPL-14
describe('requirePlatformStaffAuthority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.withRLSContext.mockImplementation(async (_ctx: unknown, work: (tx: unknown) => Promise<unknown>) => work('tx'))
    m.persistAtomicAudit.mockResolvedValue(undefined)
  })

  it('returns the actor when the user holds platform-staff authority, and records nothing', async () => {
    m.isPlatformAdminUser.mockResolvedValue(true)

    await expect(requirePlatformStaffAuthority({ userId: 'staff_1', organizationId: 'org_1' }, 'platform.stats.read')).resolves.toEqual({
      userId: 'staff_1',
      organizationId: 'org_1',
    })

    expect(m.isPlatformAdminUser).toHaveBeenCalledWith('staff_1')
    expect(m.persistAtomicAudit).not.toHaveBeenCalled()
  })

  it('refuses a user without it, whatever role title they hold in their own organization, and records the refusal under that organization', async () => {
    m.isPlatformAdminUser.mockResolvedValue(false)

    await expect(requirePlatformStaffAuthority({ userId: 'lead_1', organizationId: 'org_1' }, 'platform.user_directory.read')).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('platform-staff authority'),
    })

    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1', userId: 'lead_1' }, expect.any(Function))
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'lead_1',
        action: 'platform.user_directory.read.denied',
        resourceType: 'platform_authority',
        details: { reason: 'no_platform_staff_authority' },
      }),
      'failure',
    )
  })

  it.each([
    [{ userId: null, organizationId: 'org_1' }],
    [{ userId: 'staff_1', organizationId: null }],
    [{ userId: undefined, organizationId: undefined }],
  ])('refuses %j before asking anything, because a platform-wide request needs a person acting in an organization', async (actor) => {
    await expect(requirePlatformStaffAuthority(actor, 'platform.member_activity.read')).rejects.toMatchObject({ status: 403 })

    expect(m.isPlatformAdminUser).not.toHaveBeenCalled()
    expect(m.persistAtomicAudit).not.toHaveBeenCalled()
  })

  it('still refuses when the refusal itself cannot be recorded, and says so in the log', async () => {
    m.isPlatformAdminUser.mockResolvedValue(false)
    m.persistAtomicAudit.mockRejectedValue(new Error('audit store down'))

    await expect(requirePlatformStaffAuthority({ userId: 'lead_1', organizationId: 'org_1' }, 'platform.stats.read')).rejects.toMatchObject({ status: 403 })

    expect(m.loggerError).toHaveBeenCalledWith('platform_authority_denial_not_recorded', { capability: 'platform.stats.read', error: 'audit store down' })
  })

  it('names exactly the platform capabilities: three reads and the pilot fixture operation', () => {
    expect([...PLATFORM_CAPABILITIES]).toEqual([
      'platform.user_directory.read',
      'platform.member_activity.read',
      'platform.stats.read',
      'platform.pilot_fixture.manage',
    ])
  })
})
