import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getTableName, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  headers: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  members: [] as Array<{ orgId: string; userId: string; role: string; status: string }>,
  rows: {} as Record<string, unknown[][]>,
  returned: {} as Record<string, unknown[]>,
  queries: [] as Array<{ table: string; filter?: SQL }>,
  writes: [] as Array<{
    table: string
    operation: string
    value: Record<string, unknown>
    filter?: SQL
  }>,
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth, currentUser: m.currentUser }))
vi.mock('next/headers', () => ({ headers: m.headers }))
vi.mock('@nzila/db', () => ({
  createScopedDb: vi.fn(),
  createAuditedScopedDb: vi.fn(),
  withAudit: vi.fn(),
}))
vi.mock('@nzila/db/platform', () => ({
  platformDb: { select: m.select, insert: m.insert, update: m.update },
}))
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  createRequestContext: vi.fn(),
  runWithContext: vi.fn(),
}))
vi.mock('@/lib/audit-db', () => ({ recordAuditEvent: m.audit }))

const org = '11111111-1111-4111-8111-111111111111',
  foreign = '22222222-2222-4222-8222-222222222222'
const yearId = '33333333-3333-4333-8333-333333333333',
  periodId = '44444444-4444-4444-8444-444444444444',
  accountId = '55555555-5555-4555-8555-555555555555',
  installmentId = '66666666-6666-4666-8666-666666666666'
const userId = 'canonical-non-uuid-finance-operator'
const year = {
  id: yearId,
  orgId: org,
  fiscalYearLabel: '2026',
  status: 'open',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  federalFilingDeadline: '2027-06-30',
  federalPaymentDeadline: '2027-02-28',
  provincialFilingDeadline: null,
  provincialPaymentDeadline: null,
}
const period = {
  id: periodId,
  orgId: org,
  accountId,
  taxType: 'HST',
  status: 'open',
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  filingDue: '2026-02-28',
  paymentDue: '2026-02-28',
}
const dialect = new PgDialect()
const request = (suffix = '', body?: object, method = 'POST') =>
  new NextRequest('https://console.test/api' + suffix, {
    method: body ? method : 'GET',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
const routes = [
  {
    name: 'profiles',
    suffix: `?orgId=${org}`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/tax/profiles/route')).GET(r),
  },
  {
    name: 'years',
    suffix: `?orgId=${org}`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/tax/years/route')).GET(r),
  },
  {
    name: 'year detail',
    suffix: '',
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/tax/years/[taxYearId]/route')).GET(r, {
        params: Promise.resolve({ taxYearId: yearId }),
      }),
  },
  {
    name: 'filings',
    suffix: `?orgId=${org}&taxYearId=${yearId}`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/tax/filings/route')).GET(r),
  },
  {
    name: 'notices',
    suffix: `?orgId=${org}&taxYearId=${yearId}`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/tax/notices/route')).GET(r),
  },
  {
    name: 'installments',
    suffix: `?orgId=${org}&taxYearId=${yearId}`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/tax/installments/route')).GET(r),
  },
  {
    name: 'accounts',
    suffix: `?orgId=${org}`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/indirect-tax/accounts/route')).GET(r),
  },
  {
    name: 'periods',
    suffix: `?orgId=${org}`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/indirect-tax/periods/route')).GET(r),
  },
  {
    name: 'period detail',
    suffix: '',
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/indirect-tax/periods/[periodId]/route')).GET(r, {
        params: Promise.resolve({ periodId }),
      }),
  },
  {
    name: 'summary',
    suffix: `?periodId=${periodId}`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/indirect-tax/summary/route')).GET(r),
  },
  {
    name: 'close list',
    suffix: `?orgId=${org}`,
    invoke: async (r: NextRequest) => (await import('../../app/api/finance/close/route')).GET(r),
  },
  {
    name: 'close detail',
    suffix: '',
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/close/[periodId]/route')).GET(r, {
        params: Promise.resolve({ periodId }),
      }),
  },
  {
    name: 'governance links',
    suffix: `?orgId=${org}`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/governance-links/route')).GET(r),
  },
  {
    name: 'year-end pack',
    suffix: `?orgId=${org}&fiscalYear=2026`,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/finance/year-end-pack/route')).GET(r),
  },
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('AI_SERVICE_KEY', '')
  m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: 'ops' } } })
  m.currentUser.mockResolvedValue(null)
  m.headers.mockResolvedValue(new Headers())
  m.members = [{ orgId: org, userId, role: 'org_admin', status: 'active' }]
  m.rows = {}
  m.returned = {}
  m.queries = []
  m.writes = []
  m.audit.mockResolvedValue(undefined)
  m.select.mockImplementation(() => ({
    from: (table: Parameters<typeof getTableName>[0]) => {
      const name = getTableName(table),
        data = m.rows[name]?.shift() ?? []
      const observation: (typeof m.queries)[number] = { table: name }
      m.queries.push(observation)
      const chain = {
        where: (filter: SQL) => {
          observation.filter = filter
          return chain
        },
        limit: () => chain,
        orderBy: () => chain,
        then: (resolve: (value: unknown[]) => unknown) => {
          const params = observation.filter ? dialect.sqlToQuery(observation.filter).params : []
          const rows =
            name === 'org_members'
              ? m.members.filter(
                  (member) =>
                    member.orgId === params[0] &&
                    member.userId === params[1] &&
                    member.status === params[2],
                )
              : data
          return Promise.resolve(rows).then(resolve)
        },
      }
      return chain
    },
  }))
  m.insert.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    values: (value: Record<string, unknown>) => {
      const name = getTableName(table)
      m.writes.push({ table: name, operation: 'insert', value })
      return { returning: async () => m.returned[name] ?? [{ id: 'created-row', ...value }] }
    },
  }))
  m.update.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    set: (value: Record<string, unknown>) => ({
      where: (filter: SQL) => {
        const name = getTableName(table)
        m.writes.push({ table: name, operation: 'update', value, filter })
        return { returning: async () => m.returned[name] ?? [{ id: 'updated-row', ...value }] }
      },
    }),
  }))
})
afterEach(() => vi.unstubAllEnvs())

describe('existing Console finance operations bind actual stored parent and current membership', () => {
  it.each(routes)('$name refuses anonymous before any database read', async (route) => {
    m.auth.mockResolvedValue({ userId: null })
    expect((await route.invoke(request(route.suffix))).status).toBe(401)
    expect(m.queries).toEqual([])
    expect(m.writes).toEqual([])
    expect(m.audit).not.toHaveBeenCalled()
  })
  it.each([routes[3], routes[4], routes[5]])(
    '$name rejects ownorg paired with a foreign actual tax year before child queries',
    async (route) => {
      m.rows.tax_years = [[{ ...year, orgId: foreign }]]
      expect((await route.invoke(request(route.suffix))).status).toBe(403)
      expect(m.queries.map((q) => q.table)).toEqual(['tax_years'])
      expect(m.writes).toEqual([])
      expect(m.audit).not.toHaveBeenCalled()
    },
  )
  it.each([routes[3], routes[4], routes[5]])(
    '$name keeps same-year positive access and both year+org SQL conditions',
    async (route) => {
      m.rows.tax_years = [[year]]
      expect((await route.invoke(request(route.suffix))).status).toBe(200)
      const q = m.queries.at(-1)!
      expect(dialect.sqlToQuery(q.filter!).params).toEqual([yearId, org])
    },
  )
  it('summary and close detail deny another organization before reading private child rows', async () => {
    m.rows.indirect_tax_periods = [[{ ...period, orgId: foreign }]]
    expect((await routes[9].invoke(request(routes[9].suffix))).status).toBe(403)
    expect(m.queries.map((q) => q.table)).toEqual(['indirect_tax_periods', 'org_members'])
    m.rows.close_periods = [[{ id: periodId, orgId: foreign }]]
    m.queries = []
    expect((await routes[11].invoke(request())).status).toBe(403)
    expect(m.queries.map((q) => q.table)).toEqual(['close_periods', 'org_members'])
    expect(m.writes).toEqual([])
    expect(m.audit).not.toHaveBeenCalled()
  })
  it('summary retains same-parent positive read after real membership enforcement', async () => {
    m.rows.indirect_tax_periods = [[period]]
    m.rows.indirect_tax_summary = [[{ id: 'summary', totalSales: '100.00' }]]
    const response = await routes[9].invoke(request(routes[9].suffix))
    expect(response.status).toBe(200)
    expect((await response.json()).totalSales).toBe('100.00')
    expect(dialect.sqlToQuery(m.queries.at(-1)!.filter!).params).toEqual([periodId])
  })
  it.each(['orgId', 'accountId', 'taxType', 'createdAt', 'unknownColumn'])(
    'period PATCH rejects substituted %s before SQL',
    async (field) => {
      const { PATCH } = await import('../../app/api/finance/indirect-tax/periods/route')
      expect(
        (await PATCH(request('', { id: periodId, status: 'filed', [field]: foreign }, 'PATCH')))
          .status,
      ).toBe(400)
      expect(m.queries).toEqual([])
      expect(m.writes).toEqual([])
      expect(m.audit).not.toHaveBeenCalled()
    },
  )
  it.each(['orgId', 'taxYearId', 'updatedAt'])(
    'installment PATCH rejects substituted %s before SQL',
    async (field) => {
      const { PATCH } = await import('../../app/api/finance/tax/installments/route')
      expect(
        (await PATCH(request('', { id: installmentId, status: 'paid', [field]: foreign }, 'PATCH')))
          .status,
      ).toBe(400)
      expect(m.queries).toEqual([])
      expect(m.writes).toEqual([])
    },
  )
  it('period PATCH preserves supported status/date/evidence values and immutable parent SQL binding', async () => {
    const { PATCH } = await import('../../app/api/finance/indirect-tax/periods/route')
    m.rows.indirect_tax_periods = [[period]]
    expect(
      (
        await PATCH(
          request(
            '',
            { id: periodId, status: 'filed', filingDue: '2026-03-01', documentId: null },
            'PATCH',
          ),
        )
      ).status,
    ).toBe(200)
    expect(m.writes[0].value).toMatchObject({
      status: 'filed',
      filingDue: '2026-03-01',
      documentId: null,
      updatedAt: expect.any(Date),
    })
    expect(dialect.sqlToQuery(m.writes[0].filter!).params).toEqual([periodId, org, accountId])
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: org,
        actorClerkUserId: userId,
        beforeJson: { status: 'open' },
      }),
    )
  })
  it('installment PATCH preserves paid amount/status and the original year+org binding', async () => {
    const { PATCH } = await import('../../app/api/finance/tax/installments/route')
    m.rows.tax_installments = [
      [{ id: installmentId, orgId: org, taxYearId: yearId, status: 'due' }],
    ]
    expect(
      (
        await PATCH(
          request(
            '',
            { id: installmentId, status: 'paid', paidAmount: '25.00', dueDate: '2026-02-01' },
            'PATCH',
          ),
        )
      ).status,
    ).toBe(200)
    expect(m.writes[0].value).toMatchObject({
      status: 'paid',
      paidAmount: '25.00',
      dueDate: '2026-02-01',
    })
    expect(dialect.sqlToQuery(m.writes[0].filter!).params).toEqual([installmentId, org, yearId])
  })
  it('rejects writing a foreign installment and does not audit a raced parent mismatch as success', async () => {
    const { PATCH } = await import('../../app/api/finance/tax/installments/route')
    m.rows.tax_installments = [
      [{ id: installmentId, orgId: foreign, taxYearId: yearId, status: 'due' }],
    ]
    expect((await PATCH(request('', { id: installmentId, status: 'paid' }, 'PATCH'))).status).toBe(
      403,
    )
    expect(m.writes).toEqual([])
    expect(m.audit).not.toHaveBeenCalled()
    m.rows.tax_installments = [
      [{ id: installmentId, orgId: org, taxYearId: yearId, status: 'due' }],
    ]
    m.returned.tax_installments = []
    expect((await PATCH(request('', { id: installmentId, status: 'paid' }, 'PATCH'))).status).toBe(
      409,
    )
    expect(m.audit).not.toHaveBeenCalled()
  })
  it('create installment rejects a foreign stored year and retains same-parent supported creation', async () => {
    const { POST } = await import('../../app/api/finance/tax/installments/route')
    const input = { orgId: org, taxYearId: yearId, dueDate: '2026-02-01', requiredAmount: '25.00' }
    m.rows.tax_years = [[{ ...year, orgId: foreign }]]
    expect((await POST(request('', input))).status).toBe(403)
    expect(m.writes).toEqual([])
    expect(m.audit).not.toHaveBeenCalled()
    m.rows.tax_years = [[year]]
    expect((await POST(request('', input))).status).toBe(201)
    expect(m.writes[0].value).toEqual(input)
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: org, actorClerkUserId: userId }),
    )
  })
  it('retains the actual tax-year close gate and unresolved close-exception refusal before mutation', async () => {
    const { PATCH: tax } = await import('../../app/api/finance/tax/years/[taxYearId]/route')
    m.rows.tax_years = [[year]]
    expect(
      (
        await tax(request('', { status: 'closed' }, 'PATCH'), {
          params: Promise.resolve({ taxYearId: yearId }),
        })
      ).status,
    ).toBe(422)
    expect(m.writes).toEqual([])
    expect(m.audit).not.toHaveBeenCalled()
    const { PATCH: close } = await import('../../app/api/finance/close/route')
    m.rows.close_periods = [[{ id: periodId, orgId: org, status: 'open' }]]
    m.rows.close_exceptions = [[{ id: 'unresolved' }]]
    expect((await close(request('', { id: periodId, status: 'closed' }, 'PATCH'))).status).toBe(422)
    expect(m.writes).toEqual([])
    expect(m.audit).not.toHaveBeenCalled()
  })
  it('preserves year-end completeness computation and avoids unrelated global approval reads', async () => {
    m.rows.tax_years = [[year]]
    const response = await routes[13].invoke(request(routes[13].suffix))
    expect(response.status).toBe(200)
    expect((await response.json()).taxYear.id).toBe(yearId)
    expect(m.queries.some((q) => q.table === 'close_approvals')).toBe(false)
    for (const q of m.queries.filter((q) =>
      ['tax_filings', 'tax_notices', 'tax_installments'].includes(q.table),
    ))
      expect(dialect.sqlToQuery(q.filter!).params).toEqual([yearId, org])
  })
})
