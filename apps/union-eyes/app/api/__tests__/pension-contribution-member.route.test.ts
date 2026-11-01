import { beforeEach, describe, expect, it, vi } from 'vitest'

// DEF-0B10-PEN-PENSION-WRITES-STORE-TYPED-MEMBER-REFERENCES-NAMES-AND-AMOUNTS (contributions): the member must be a pension member of
// the organization, the name is the stored one, and the amount is a positive two-decimal amount.
const m = vi.hoisted(() => ({
  memberRows: [] as unknown[],
  inserted: null as Record<string, unknown> | null,
  audit: vi.fn(),
}))

vi.mock('@/lib/api/framework', () => ({
  withApi: (_options: unknown, handler: unknown) => handler,
  ApiError: {
    badRequest: (message: string) => Object.assign(new Error(message), { code: 'VALIDATION_ERROR' }),
    notFound: (resource: string) => Object.assign(new Error(`${resource} not found`), { code: 'NOT_FOUND' }),
  },
}))
vi.mock('@/lib/api/list-page', () => ({ listPage: () => ({ limit: 1, offset: 0 }) }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }))
vi.mock('@/lib/pension/pension-authority', () => ({ isPensionAdministrator: vi.fn(), ownPensionIdentities: vi.fn(), PENSION_ADMIN_ROLES: ['pension_administrator'] }))
vi.mock('@/db/schema', () => ({ pensionContributions: { id: 'id' }, pensionMembers: { id: 'id', name: 'name', organizationId: 'organizationId' } }))
vi.mock('drizzle-orm', async (importOriginal) => ({ ...(await importOriginal<typeof import('drizzle-orm')>()), eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), desc: vi.fn(), inArray: vi.fn() }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => m.memberRows }) }) }),
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: async () => {
            m.inserted = values
            return [{ id: 'c1', ...values }]
          },
        }),
      }),
    }),
}))

const MEMBER = '11111111-1111-4111-8111-111111111111'
const post = async (body: Record<string, unknown>) => {
  const { POST } = await import('../pension/contributions/route')
  return (POST as unknown as (ctx: unknown) => Promise<unknown>)({ body, organizationId: 'org_1', userId: 'admin_1' })
}

describe('pension contributions POST', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.memberRows = [{ id: MEMBER, name: 'Stored Name' }]
    m.inserted = null
    m.audit.mockResolvedValue(undefined)
  })

  it('records the contribution under the stored member name, ignoring a typed one', async () => {
    await post({ memberId: MEMBER, memberName: 'Typed Name', period: '2026-10', amount: '125.50' })
    expect(m.inserted).toMatchObject({ memberId: MEMBER, memberName: 'Stored Name', organizationId: 'org_1', amount: '125.50' })
    expect(m.audit).toHaveBeenCalled()
  })

  it('refuses a member that is not a pension member of the organization and writes nothing', async () => {
    m.memberRows = []
    await expect(post({ memberId: MEMBER, period: '2026-10', amount: '10.00' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(m.inserted).toBeNull()
    expect(m.audit).not.toHaveBeenCalled()
  })

  it.each(['0', '0.00', '-5', '12.345', 'abc', '', '12345678901'])('refuses the amount %j', async (amount) => {
    await expect(post({ memberId: MEMBER, period: '2026-10', amount })).rejects.toThrow()
    expect(m.inserted).toBeNull()
  })
})
