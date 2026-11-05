import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  requireMember: vi.fn(),
  rls: vi.fn(),
  tx: { select: vi.fn() },
  totals: { totalCharges: '0', totalPayments: '0', totalCredits: '0', totalAdjustments: '0', totalWriteOffs: '0', transactionCount: '0' },
  recent: [] as unknown[],
  selects: 0,
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }))
// The ledger is read through the explicit tenant transaction only: the ambient handle must never be touched.
vi.mock('@/db/db', () => ({ db: new Proxy({}, { get: () => { throw new Error('the ambient db handle must not be used') } }) }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.rls }))
vi.mock('@/lib/api-auth-guard', () => ({ requireUserForOrganization: m.requireMember }))
vi.mock('@nzila/os-core', () => ({ createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn() }) }))
vi.mock('@/db/schema/dues-finance-schema', () => ({
  memberDuesLedger: {
    id: 'id', userId: 'userId', organizationId: 'organizationId', transactionType: 'transactionType', transactionDate: 'transactionDate',
    amount: 'amount', balanceAfter: 'balanceAfter', description: 'description', status: 'status',
  },
}))

const ORG = '11111111-1111-4111-8111-111111111111'
const request = (query = `?organizationId=${ORG}`, headers: Record<string, string> = {}) =>
  new NextRequest(`https://example.test/api/portal/dues/balance${query}`, { headers })

describe('GET /api/portal/dues/balance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.selects = 0
    m.totals = { totalCharges: '0', totalPayments: '0', totalCredits: '0', totalAdjustments: '0', totalWriteOffs: '0', transactionCount: '0' }
    m.recent = []
    m.auth.mockResolvedValue({ userId: 'member-1' })
    m.requireMember.mockResolvedValue(undefined)
    m.rls.mockImplementation(async (_scope: unknown, work: (tx: unknown) => Promise<unknown>) => work(m.tx))
    m.tx.select.mockImplementation(() => {
      m.selects += 1
      const first = m.selects === 1
      const rows = first ? [m.totals] : m.recent
      const chain: Record<string, unknown> = {}
      chain.from = () => chain
      chain.where = () => (first ? Promise.resolve(rows) : chain)
      chain.orderBy = () => chain
      chain.limit = async () => rows
      return chain
    })
  })

  it('answers 401 for an anonymous caller and reads nothing', async () => {
    m.auth.mockResolvedValueOnce({ userId: null })
    const { GET } = await import('../portal/dues/balance/route')
    expect((await GET(request())).status).toBe(401)
    expect(m.rls).not.toHaveBeenCalled()
  })

  it('answers 400 for a missing or malformed organization id before any membership or database work', async () => {
    const { GET } = await import('../portal/dues/balance/route')
    expect((await GET(request(''))).status).toBe(400)
    expect((await GET(request('?organizationId=not-a-uuid'))).status).toBe(400)
    expect(m.requireMember).not.toHaveBeenCalled()
    expect(m.rls).not.toHaveBeenCalled()
  })

  it('refuses, without reading the ledger, an organization the caller is not a live member of', async () => {
    m.requireMember.mockRejectedValueOnce(new Error('not a member'))
    const { GET } = await import('../portal/dues/balance/route')
    const response = await GET(request())
    expect(response.status).toBe(403)
    expect(m.requireMember).toHaveBeenCalledWith(ORG)
    expect(m.rls).not.toHaveBeenCalled()
    expect(m.tx.select).not.toHaveBeenCalled()
  })

  it('reads the balance and the recent activity in the caller organization\'s tenant transaction (the x-organization-id header works too)', async () => {
    m.totals = { totalCharges: '120.50', totalPayments: '50.25', totalCredits: '10.00', totalAdjustments: '0', totalWriteOffs: '0', transactionCount: '4' }
    m.recent = [{ id: 'l1', type: 'payment', amount: '50.25' }]
    const { GET } = await import('../portal/dues/balance/route')
    const response = await GET(request('', { 'x-organization-id': ORG }))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(m.rls).toHaveBeenCalledTimes(1)
    expect(m.rls.mock.calls[0][0]).toEqual({ organizationId: ORG })
    expect(m.tx.select).toHaveBeenCalledTimes(2)
    expect(json.data).toMatchObject({
      currentBalance: '60.25',
      balanceStatus: 'owing',
      transactionCount: 4,
      recentTransactions: [{ id: 'l1', type: 'payment', amount: '50.25' }],
    })
  })

  it('reports a settled balance as paid_up and an overpaid one as credit (a negative balance is not "paid up")', async () => {
    const { GET } = await import('../portal/dues/balance/route')
    m.totals = { ...m.totals, totalCharges: '100.00', totalPayments: '100.00' }
    expect((await (await GET(request())).json()).data.balanceStatus).toBe('paid_up')

    m.selects = 0
    m.totals = { ...m.totals, totalCharges: '100.00', totalPayments: '130.00' }
    const credit = await (await GET(request())).json()
    expect(credit.data.balanceStatus).toBe('credit')
    expect(credit.data.currentBalance).toBe('-30.00')
  })

  it('answers 500, not an empty balance, when the ledger cannot be read', async () => {
    m.rls.mockRejectedValueOnce(new Error('connection reset'))
    const { GET } = await import('../portal/dues/balance/route')
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ success: false })
  })
})
