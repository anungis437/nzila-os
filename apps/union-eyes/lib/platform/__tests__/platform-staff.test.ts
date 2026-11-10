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
    withSystemContext: vi.fn(),
    execute: vi.fn(),
    loggerError: vi.fn(),
  }
})

vi.mock('@/lib/api/framework', () => ({ ApiError: m.ApiError }))
vi.mock('@/lib/api-auth-guard', () => ({ isPlatformAdminUser: m.isPlatformAdminUser }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }))
vi.mock('@/lib/ai/ai-client', () => ({ UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000' }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext, withSystemContext: m.withSystemContext }))
vi.mock('@/lib/logger', () => ({ logger: { error: m.loggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { PLATFORM_CAPABILITIES, requirePlatformStaffAuthority } from '../platform-staff'

// DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ, DEF-0B10-OPL-14
describe('requirePlatformStaffAuthority', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.withRLSContext.mockImplementation(async (ctx: { organizationId?: string }, work: (tx: unknown) => Promise<unknown>) =>
      work(ctx.organizationId === '00000000-0000-0000-0000-000000000000' ? { execute: m.execute } : 'tx'))
    m.withSystemContext.mockImplementation(async (work: (tx: unknown) => Promise<unknown>) => work({ execute: m.execute }))
    m.execute.mockResolvedValue([{ id: 'mandate_1' }])
    m.persistAtomicAudit.mockResolvedValue(undefined)
  })

  it('returns the actor only when platform eligibility is backed by a live action-specific mandate', async () => {
    m.isPlatformAdminUser.mockResolvedValue(true)

    await expect(requirePlatformStaffAuthority({ userId: 'staff_1', organizationId: 'org_1' }, 'platform.stats.read')).resolves.toEqual({
      userId: 'staff_1',
      organizationId: 'org_1',
    })

    expect(m.isPlatformAdminUser).toHaveBeenCalledWith('staff_1')
    expect(m.execute).toHaveBeenCalledOnce()
    expect(m.persistAtomicAudit).not.toHaveBeenCalled()
  })

  it('refuses an eligible platform administrator when no live scoped mandate exists', async () => {
    m.isPlatformAdminUser.mockResolvedValue(true)
    m.execute.mockResolvedValue([])

    await expect(requirePlatformStaffAuthority({ userId: 'staff_1', organizationId: 'org_1' }, 'platform.stats.read')).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining('platform-staff authority'),
    })

    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ details: { reason: 'no_live_scoped_platform_staff_mandate' } }),
      'failure',
    )
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
        details: { reason: 'not_platform_staff_eligible' },
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

  it('names every cross-organization capability explicitly instead of granting a generic platform-admin power', () => {
    expect([...PLATFORM_CAPABILITIES]).toEqual([
      'platform.user_directory.read', 'platform.member_activity.read', 'platform.stats.read',
      'platform.pilot_fixture.manage', 'platform.pilot.manage', 'platform.organization_directory.read',
      'platform.database_health.read', 'platform.database.maintain', 'platform.feature_flags.manage',
      'platform.jobs.manage', 'platform.email_suppressions.manage', 'platform.user_directory.manage',
      'platform.document_backfill.manage', 'platform.ai_cache.manage', 'platform.organization.manage',
      'platform.icra_review.manage', 'platform.queue.read', 'platform.auth_diagnostics.run',
      'platform.marketing_content.publish', 'platform.cba_dataset.curate',
    ])
    expect(new Set(PLATFORM_CAPABILITIES).size).toBe(PLATFORM_CAPABILITIES.length)
  })
})
