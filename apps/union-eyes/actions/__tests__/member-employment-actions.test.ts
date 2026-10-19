import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG = '11111111-1111-4111-8111-111111111111'
const grant = { ok: true as const, userId: 'user-admin-a', organizationId: ORG, capability: 'administer' as const }

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
  q: {
    createMemberEmployment: vi.fn(),
    getMemberEmploymentById: vi.fn(),
    getActiveMemberEmployment: vi.fn(),
    getAllMemberEmployment: vi.fn(),
    getEmploymentByOrganization: vi.fn(),
    updateMemberEmployment: vi.fn(),
    deleteMemberEmployment: vi.fn(),
    getEmploymentForDuesCalculation: vi.fn(),
    createEmploymentHistory: vi.fn(),
    getEmploymentHistoryByMember: vi.fn(),
    createMemberLeave: vi.fn(),
    getActiveMemberLeaves: vi.fn(),
    getAllMemberLeaves: vi.fn(),
    updateMemberLeave: vi.fn(),
    approveMemberLeave: vi.fn(),
    createJobClassification: vi.fn(),
    getJobClassificationByCode: vi.fn(),
    getJobClassificationsByOrganization: vi.fn(),
    updateJobClassification: vi.fn(),
    calculateSeniorityYears: vi.fn(),
  },
}))

vi.mock('@/lib/member-employment/authorize-employment-access', () => ({
  authorizeEmploymentAccess: mocks.authorize,
}))
vi.mock('@/db/queries/member-employment-queries', () => ({
  ...mocks.q,
  EmploymentBoundaryError: class EmploymentBoundaryError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'EmploymentBoundaryError'
    }
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }))
vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}))

import * as actions from '../member-employment-actions'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue(grant)
  for (const fn of Object.values(mocks.q)) fn.mockResolvedValue({ id: 'row' })
  mocks.q.calculateSeniorityYears.mockResolvedValue(4)
  mocks.q.getEmploymentForDuesCalculation.mockResolvedValue({
    hourlyRate: 25,
    employmentStatus: 'active',
    payFrequency: 'hourly',
  })
})

describe('member employment actions', () => {
  it('denies unauthenticated and unauthorized calls before a query', async () => {
    mocks.authorize.mockResolvedValue({ ok: false, message: 'Unauthorized' })
    const unauthenticated = await actions.createMemberEmploymentAction({ organizationId: ORG } as never)
    expect(unauthenticated).toEqual({ isSuccess: false, message: 'Unauthorized' })

    mocks.authorize.mockResolvedValue({ ok: false, message: 'Forbidden' })
    const forbidden = await actions.getEmploymentByOrganizationAction(ORG)
    expect(forbidden).toEqual({ isSuccess: false, message: 'Forbidden' })
    expect(mocks.q.createMemberEmployment).not.toHaveBeenCalled()
    expect(mocks.q.getEmploymentByOrganization).not.toHaveBeenCalled()
  })

  it('passes the authorized principal and organization into a permitted write', async () => {
    await actions.createMemberEmploymentAction({
      organizationId: ORG,
      memberId: '33333333-3333-4333-8333-333333333333',
      hourlyRate: '99.50',
    } as never)
    expect(mocks.authorize).toHaveBeenCalledWith(ORG, 'administer')
    expect(mocks.q.createMemberEmployment).toHaveBeenCalledWith(
      { organizationId: ORG, actorUserId: 'user-admin-a' },
      expect.objectContaining({ organizationId: ORG }),
    )
  })

  it('does not log compensation when a write fails', async () => {
    mocks.q.updateMemberEmployment.mockRejectedValue(new Error('hourlyRate 99.50'))
    const result = await actions.updateMemberEmploymentAction('e1', {
      organizationId: ORG,
      hourlyRate: '99.50',
    } as never)
    expect(result.isSuccess).toBe(false)
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain('99.50')
  })

  it('returns the retention failure instead of a successful delete', async () => {
    const { EmploymentBoundaryError } = await import('@/db/queries/member-employment-queries')
    mocks.q.deleteMemberEmployment.mockRejectedValue(
      new EmploymentBoundaryError('Employment records are retained. Update employment status instead.'),
    )
    const result = await actions.deleteMemberEmploymentAction('e1', ORG)
    expect(result.isSuccess).toBe(false)
    expect(result.message).toContain('retained')
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('requires finance authorization for dues data', async () => {
    mocks.authorize.mockResolvedValue({ ...grant, capability: 'finance' })
    const ok = await actions.getEmploymentForDuesCalculationAction('m1', ORG)
    expect(ok.isSuccess).toBe(true)
    expect(mocks.authorize).toHaveBeenCalledWith(ORG, 'finance')

    mocks.authorize.mockResolvedValue({ ok: false, message: 'Module access denied' })
    const denied = await actions.getEmploymentForDuesCalculationAction('m1', ORG)
    expect(denied).toEqual({ isSuccess: false, message: 'Module access denied' })
    expect(mocks.q.getEmploymentForDuesCalculation).toHaveBeenCalledTimes(1)
  })

  it('approves leave through the server-owned approval query', async () => {
    await actions.approveMemberLeaveAction('l1', ORG)
    expect(mocks.q.approveMemberLeave).toHaveBeenCalledWith(
      { organizationId: ORG, actorUserId: 'user-admin-a' },
      'l1',
    )
    expect(mocks.q.updateMemberLeave).not.toHaveBeenCalled()
  })

  it('does not calculate another member seniority without an organization grant', async () => {
    mocks.authorize.mockResolvedValue({ ok: false, message: 'Forbidden' })
    const result = await actions.calculateSeniorityYearsAction('2020-01-01', ORG, undefined, 'm1')
    expect(result.isSuccess).toBe(false)
    expect(mocks.q.calculateSeniorityYears).not.toHaveBeenCalled()
  })
})
