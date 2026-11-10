import { beforeEach, describe, expect, it, vi } from 'vitest'

// DEF-0B10-PEN-PENSION-WRITES-STORE-TYPED-MEMBER-REFERENCES-NAMES-AND-AMOUNTS-UNVERIFIED (enrolment): the person enrolled must be an
// active membership of this organization, the stored name is that membership's, and a member is enrolled in a plan once.
const m = vi.hoisted(() => ({
  // Rows answered by successive selects: the plan, the membership, an existing enrolment.
  selects: [] as unknown[][],
  inserted: null as Record<string, unknown> | null,
  audit: vi.fn(),
}))

vi.mock('@/lib/api/framework', () => ({
  withApi: (_options: unknown, handler: unknown) => handler,
  RATE_LIMITS: { FINANCIAL_WRITE: {} },
  ApiError: {
    badRequest: (message: string) => Object.assign(new Error(message), { code: 'VALIDATION_ERROR' }),
    notFound: (resource: string) => Object.assign(new Error(`${resource} not found`), { code: 'NOT_FOUND' }),
    conflict: (message: string) => Object.assign(new Error(message), { code: 'CONFLICT' }),
  },
}))
vi.mock('@/lib/api/list-page', () => ({ listPage: () => ({ limit: 1, offset: 0 }) }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }))
vi.mock('@/lib/pension/pension-authority', () => ({ isPensionAdministrator: vi.fn(), requirePensionTrusteeMandate: vi.fn(async () => ({ id: 'mandate-1' })), PENSION_ADMIN_ROLES: ['pension_administrator'] }))
vi.mock('@/db/schema', () => ({
  pensionMembers: { id: 'id', organizationId: 'organizationId', planId: 'planId', userId: 'userId', createdAt: 'createdAt' },
  pensionPlans: { id: 'id', planName: 'planName', organizationId: 'organizationId' },
  organizationMembers: { id: 'id', name: 'name', status: 'status', deletedAt: 'deletedAt', organizationId: 'organizationId' },
}))
vi.mock('drizzle-orm', async (importOriginal) => ({ ...(await importOriginal<typeof import('drizzle-orm')>()), eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), desc: vi.fn() }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => m.selects.shift() ?? [] }) }) }),
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: async () => {
            m.inserted = values
            return [{ id: 'pm1', ...values }]
          },
        }),
      }),
    }),
}))

const PLAN = '22222222-2222-4222-8222-222222222222'
const MEMBERSHIP = '11111111-1111-4111-8111-111111111111'
const post = async (body: Record<string, unknown>) => {
  const { POST } = await import('../pension/members/route')
  return (POST as unknown as (ctx: unknown) => Promise<unknown>)({ body, organizationId: 'org_1', userId: 'admin_1' })
}
const plan = [{ id: PLAN, planName: 'Stored Plan' }]
const activeMembership = [{ id: MEMBERSHIP, name: 'Recorded Name', status: 'active', deletedAt: null }]

describe('pension members POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.selects = []
    m.inserted = null
    m.audit.mockResolvedValue(undefined)
  })

  it('enrols a real active membership under its recorded name, ignoring a typed name', async () => {
    m.selects = [plan, activeMembership, []]
    await post({ planId: PLAN, userId: MEMBERSHIP, name: 'Typed Name', planName: 'Typed Plan' })
    expect(m.inserted).toMatchObject({ userId: MEMBERSHIP, name: 'Recorded Name', planName: 'Stored Plan', organizationId: 'org_1' })
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'pension.member.enroll' }))
  })

  it('requires the membership reference: a typed name alone enrols no one', async () => {
    await expect(post({ planId: PLAN, name: 'Typed Name' })).rejects.toThrow()
    expect(m.inserted).toBeNull()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('refuses an id that is not a membership of this organization and writes nothing', async () => {
    m.selects = [plan, []]
    await expect(post({ planId: PLAN, userId: MEMBERSHIP })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(m.inserted).toBeNull()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it.each([
    ['inactive', { ...activeMembership[0], status: 'inactive' }],
    ['removed', { ...activeMembership[0], deletedAt: new Date('2026-01-01') }],
  ])('refuses a %s membership', async (_label, row) => {
    m.selects = [plan, [row]]
    await expect(post({ planId: PLAN, userId: MEMBERSHIP })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(m.inserted).toBeNull()
  })

  it('refuses a plan that is not this organization\'s before reading the membership', async () => {
    m.selects = [[]]
    await expect(post({ planId: PLAN, userId: MEMBERSHIP })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(m.inserted).toBeNull()
  })

  it('refuses a second enrolment of the same member in the same plan', async () => {
    m.selects = [plan, activeMembership, [{ id: 'existing' }]]
    await expect(post({ planId: PLAN, userId: MEMBERSHIP })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(m.inserted).toBeNull()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it.each(['1000', '12.34', '-1', 'abc'])('refuses the years of service %j', async (yearsOfService) => {
    m.selects = [plan, activeMembership, []]
    await expect(post({ planId: PLAN, userId: MEMBERSHIP, yearsOfService })).rejects.toThrow()
    expect(m.inserted).toBeNull()
  })
})
