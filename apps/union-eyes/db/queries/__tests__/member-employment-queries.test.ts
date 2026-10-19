import { beforeEach, describe, expect, it, vi } from 'vitest'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const MEMBER = '33333333-3333-4333-8333-333333333333'
const scope = {
  ok: true as const,
  userId: 'user-admin-a',
  organizationId: ORG_A,
  capability: 'administer' as const,
  discloseCompensation: false,
}
const financeScope = {
  ...scope,
  capability: 'finance' as const,
  discloseCompensation: true,
}

const mocks = vi.hoisted(() => ({
  queue: [] as unknown[],
  orgs: [] as Array<string | undefined>,
  outcomes: [] as string[],
  sets: [] as unknown[],
  deletes: 0,
  loggerError: vi.fn(),
}))

function makeChain() {
  const chain: Record<string, unknown> = {}
  for (const method of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'returning', '$dynamic']) {
    chain[method] = () => chain
  }
  chain.set = (value: unknown) => {
    mocks.sets.push(value)
    return chain
  }
  chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
    const value = mocks.queue.length ? mocks.queue.shift() : []
    if (value instanceof Error) return Promise.reject(value).then(resolve, reject)
    return Promise.resolve(value).then(resolve, reject)
  }
  return chain
}

function makeTx() {
  return {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => {
      mocks.deletes += 1
      return makeChain()
    },
  }
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/member-employment/authorize-employment-access', async () => {
  const actual = await vi.importActual<typeof import('@/lib/member-employment/authorize-employment-access')>(
    '@/lib/member-employment/authorize-employment-access',
  )
  return { ...actual, assertRegisteredEmploymentGrant: () => {} }
})
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (contextOrOp: unknown, maybeOp?: unknown) => {
    const hasContext = typeof contextOrOp !== 'function'
    const operation = (hasContext ? maybeOp : contextOrOp) as (tx: unknown) => Promise<unknown>
    const organizationId = hasContext
      ? (contextOrOp as { organizationId?: string }).organizationId
      : undefined
    mocks.orgs.push(organizationId)
    try {
      const result = await operation(makeTx())
      mocks.outcomes.push('commit')
      return result
    } catch (error) {
      mocks.outcomes.push('rollback')
      throw error
    }
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: mocks.loggerError, debug: vi.fn() },
}))

import { EmploymentBoundaryError } from '../member-employment-queries'
import * as q from '../member-employment-queries'

function push(...rows: unknown[]) {
  mocks.queue.push(...rows)
}

beforeEach(() => {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  mocks.queue = []
  mocks.orgs = []
  mocks.outcomes = []
  mocks.sets = []
  mocks.deletes = 0
  vi.clearAllMocks()
})

describe('member employment query boundary', () => {
  it('creates inside the authorized organization and commits the audit with the row', async () => {
    push([{ id: MEMBER, userId: 'member-user' }])
    push([{ id: 'e1', memberId: MEMBER, organizationId: ORG_A }])
    push([])
    const row = await q.createMemberEmployment(financeScope, {
      organizationId: ORG_A,
      memberId: MEMBER,
      jobTitle: 'Welder',
      hourlyRate: '99.50',
    } as never)
    expect(row).toMatchObject({ id: 'e1' })
    expect(mocks.orgs).toEqual([ORG_A])
    expect(mocks.outcomes).toEqual(['commit'])
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain('99.50')
  })

  it('rolls back when the legacy audit insert fails', async () => {
    push([{ id: MEMBER, userId: 'member-user' }])
    push([{ id: 'e1', memberId: MEMBER }])
    push(new Error('legacy_audit_down'))
    await expect(q.createMemberEmployment(scope, {
      organizationId: ORG_A,
      memberId: MEMBER,
    } as never)).rejects.toThrow('Failed to access member employment')
    expect(mocks.outcomes).toEqual(['rollback'])
    expect(JSON.stringify(mocks.loggerError.mock.calls)).not.toContain('legacy_audit_down')
  })

  it('denies a forged employer and a forged job code', async () => {
    push([{ id: MEMBER, userId: 'member-user' }])
    push([])
    await expect(q.createMemberEmployment(scope, {
      organizationId: ORG_A,
      memberId: MEMBER,
      employerId: '55555555-5555-4555-8555-555555555555',
    } as never)).rejects.toThrow('Forbidden')

    push([{ id: MEMBER, userId: 'member-user' }])
    push([])
    await expect(q.createMemberEmployment(scope, {
      organizationId: ORG_A,
      memberId: MEMBER,
      jobCode: 'NOT-IN-ORG',
    } as never)).rejects.toThrow('Forbidden')
    expect(mocks.outcomes).toEqual(['rollback', 'rollback'])
  })

  it('does not open a transaction for a forged organization id', async () => {
    await expect(q.createMemberEmployment(scope, {
      organizationId: ORG_B,
      memberId: MEMBER,
    } as never)).rejects.toThrow('Forbidden')
    expect(mocks.orgs).toEqual([])
  })

  it('returns null for a missing employment id in the authorized organization', async () => {
    push([])
    expect(await q.getMemberEmploymentById(scope, 'missing')).toBeNull()
    expect(mocks.orgs).toEqual([ORG_A])
  })

  it('returns no rows when the member is outside the organization', async () => {
    push([])
    expect(await q.getAllMemberEmployment(scope, MEMBER)).toEqual([])
    expect(mocks.outcomes).toEqual(['commit'])
  })

  it('fails an update that matches no row', async () => {
    push([])
    await expect(q.updateMemberEmployment(scope, 'e1', { jobTitle: 'Lead' })).rejects.toBeInstanceOf(EmploymentBoundaryError)
    expect(mocks.outcomes).toEqual(['rollback'])
  })

  it('fails when a concurrent update affects no row', async () => {
    push([{ id: 'e1', memberId: MEMBER, organizationId: ORG_A }])
    push([])
    await expect(q.updateMemberEmployment(scope, 'e1', { jobTitle: 'Lead' })).rejects.toThrow('Employment record not found')
    expect(mocks.outcomes).toEqual(['rollback'])
  })

  it('denies member reassignment', async () => {
    push([{ id: 'e1', memberId: MEMBER, organizationId: ORG_A }])
    await expect(q.updateMemberEmployment(scope, 'e1', { memberId: '44444444-4444-4444-8444-444444444444' })).rejects.toThrow('Forbidden')
    expect(mocks.outcomes).toEqual(['rollback'])
  })

  it('refuses hard deletion and does not issue a delete', async () => {
    await expect(q.deleteMemberEmployment(scope, 'e1')).rejects.toThrow('Employment records are retained')
    expect(mocks.deletes).toBe(0)
    expect(mocks.orgs).toEqual([])
  })

  it('maps dues compensation and withholds it when the member is outside the organization', async () => {
    push([{ id: MEMBER, userId: 'member-user' }])
    push([{
      id: 'e1',
      grossWages: '1000.50',
      baseSalary: '52000.00',
      hourlyRate: '25.00',
      regularHoursPerPeriod: '80.00',
      employmentStatus: 'active',
      payFrequency: 'bi_weekly',
    }])
    push([])
    await expect(q.getEmploymentForDuesCalculation(financeScope, MEMBER)).resolves.toEqual({
      grossWages: 1000.5,
      baseSalary: 52000,
      hourlyRate: 25,
      hoursWorked: 80,
      employmentStatus: 'active',
      payFrequency: 'bi_weekly',
    })

    push([])
    expect(await q.getEmploymentForDuesCalculation(financeScope, MEMBER)).toBeNull()
    await expect(q.getEmploymentForDuesCalculation(scope, MEMBER)).rejects.toThrow('Forbidden')
  })

  it('rejects leave approval fields and attributes an authorized approval to the actor', async () => {
    await expect(q.createMemberLeave(scope, {
      organizationId: ORG_A,
      memberId: MEMBER,
      isApproved: true,
      approvedBy: 'forged',
    } as never)).rejects.toThrow('Approval fields are assigned by the approval action')
    expect(mocks.orgs).toEqual([])

    push([{ id: 'l1', memberId: MEMBER, organizationId: ORG_A, duesWaiverApproved: true, isApproved: true, approvedBy: 'other' }])
    push([{ id: 'l1', duesWaiverApproved: true, isApproved: true, approvedBy: 'other' }])
    push([])
    await q.updateMemberLeave(scope, 'l1', {
      organizationId: ORG_A,
      reason: 'date change',
      duesWaiverApproved: false,
      isApproved: false,
    } as never)
    expect(mocks.sets.at(-1)).toMatchObject({
      duesWaiverApproved: true,
      isApproved: true,
      approvedBy: 'other',
      reason: 'date change',
    })

    push([{ id: 'l1', memberId: MEMBER, organizationId: ORG_A }])
    push([])
    await expect(q.approveMemberLeave(scope, 'l1')).rejects.toThrow('Forbidden')

    push([{ id: 'l1', memberId: MEMBER, organizationId: ORG_A }])
    push([{ id: MEMBER, userId: null }])
    await expect(q.approveMemberLeave(scope, 'l1')).rejects.toThrow('resolved subject identity')

    push([{ id: 'l1', memberId: MEMBER, organizationId: ORG_A }])
    push([{ id: MEMBER, userId: '   ' }])
    await expect(q.approveMemberLeave(scope, 'l1')).rejects.toThrow('resolved subject identity')

    push([{ id: 'l1', memberId: MEMBER, organizationId: ORG_A }])
    push([{ id: MEMBER, userId: 'user-admin-a' }])
    await expect(q.approveMemberLeave(scope, 'l1')).rejects.toThrow('Leave approval requires a different member')

    push([{ id: 'l1', memberId: MEMBER, organizationId: ORG_A }])
    push([{ id: MEMBER, userId: 'member-user' }])
    push([{ id: 'l1', isApproved: true, approvedBy: 'user-admin-a' }])
    push([])
    const leave = await q.approveMemberLeave(scope, 'l1')
    expect(leave.approvedBy).toBe('user-admin-a')
    expect(mocks.sets.at(-1)).toMatchObject({
      isApproved: true,
      approvedBy: 'user-admin-a',
    })
    expect(JSON.stringify(mocks.sets)).not.toContain('medical')
  })

  it('denies a classification move to another organization', async () => {
    await expect(q.updateJobClassification(scope, 'jc1', { organizationId: ORG_B })).rejects.toThrow('Forbidden')
    expect(mocks.orgs).toEqual([])
  })

  it('calculates seniority from organization leaves only after the member is in scope', async () => {
    const seniority = new Date('2020-01-01')
    const now = new Date('2025-01-01')
    expect(await q.calculateSeniorityYears(scope, seniority, now)).toBeCloseTo(5, 0)
    expect(mocks.orgs).toEqual([])

    push([])
    await expect(q.calculateSeniorityYears(scope, seniority, now, MEMBER)).rejects.toThrow('Forbidden')

    push([{ id: MEMBER, userId: 'member-user' }])
    push([
      { affectsSeniority: true, seniorityAdjustmentDays: 365 },
      { affectsSeniority: false, seniorityAdjustmentDays: 100 },
    ])
    const years = await q.calculateSeniorityYears(scope, seniority, now, MEMBER)
    expect(years).toBeCloseTo(4, 0)
    expect(mocks.orgs).toEqual([ORG_A, ORG_A])
  })

  it('withholds individual compensation from an employment administrator', async () => {
    await expect(q.createMemberEmployment(scope, {
      organizationId: ORG_A,
      memberId: MEMBER,
      hourlyRate: '99.50',
    } as never)).rejects.toThrow('Forbidden')

    push([{
      id: 'e1',
      organizationId: ORG_A,
      hourlyRate: '25.00',
      baseSalary: '52000.00',
      grossWages: '1000.50',
      jobTitle: 'Welder',
      customFields: { badge_number: 'B-1', hourly_rate: '25.00' },
    }])
    const row = await q.getMemberEmploymentById(scope, 'e1')
    expect(row).toMatchObject({ jobTitle: 'Welder', hourlyRate: null, baseSalary: null, grossWages: null })
    expect(JSON.stringify(row)).not.toContain('25.00')
    expect(JSON.stringify(row)).not.toContain('52000')
    expect(JSON.stringify(row)).toContain('B-1')

    push([{
      id: 'e1',
      hourlyRate: '25.00',
      baseSalary: '52000.00',
      grossWages: '1000.50',
      jobTitle: 'Welder',
    }])
    const disclosed = await q.getMemberEmploymentById(financeScope, 'e1')
    expect(disclosed).toMatchObject({ hourlyRate: '25.00', baseSalary: '52000.00', grossWages: '1000.50' })
  })

  it('withholds historical wage snapshots without a finance grant', async () => {
    await expect(q.createEmploymentHistory(scope, {
      organizationId: ORG_A,
      memberId: MEMBER,
      changeType: 'wage_change',
      previousValues: { hourlyRate: '20.00' },
      newValues: { hourly_rate: '25.00' },
    } as never)).rejects.toThrow('Forbidden')

    push([{ id: MEMBER, userId: 'member-user' }])
    push([{
      id: 'h1',
      changeType: 'wage_change',
      previousValues: { jobTitle: 'Helper', hourlyRate: '20.00' },
      newValues: { jobTitle: 'Welder', gross_wages: '1000.50' },
    }])
    const [history] = await q.getEmploymentHistoryByMember(scope, MEMBER)
    expect(history.previousValues).toEqual({ jobTitle: 'Helper' })
    expect(history.newValues).toEqual({ jobTitle: 'Welder' })
    expect(JSON.stringify(history)).not.toContain('20.00')
    expect(JSON.stringify(history)).not.toContain('1000.50')
  })
})
