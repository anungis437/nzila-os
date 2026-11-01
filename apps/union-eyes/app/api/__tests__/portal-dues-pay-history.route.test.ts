import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: { select: vi.fn(), execute: vi.fn() },
  requireMember: vi.fn(),
  rls: vi.fn(),
  withApi: vi.fn((_cfg: unknown, handler: unknown) => handler),
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }))
vi.mock('@/db/db', () => ({ db: m.db }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.rls,
}))
vi.mock('@/lib/api-auth-guard', () => ({ requireUserForOrganization: m.requireMember }))
vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: vi.fn(), conflict: vi.fn(), externalService: vi.fn() },
  RATE_LIMITS: { FINANCIAL_WRITE: {} },
}))
vi.mock('@/lib/stripe', () => ({ stripe: {} }))
vi.mock('@/lib/dues/dues-payment-service', () => ({
  DUES_PAYMENT_KIND: 'member_dues',
  DuesInitiationError: class DuesInitiationError extends Error {},
  initiateDuesPayment: vi.fn(),
}))
vi.mock('@nzila/os-core', () => ({ createLogger: () => ({ error: vi.fn() }) }))
vi.mock('@/db/schema/dues-finance-schema', () => ({
  memberDuesLedger: {
    id: 'id', userId: 'userId', organizationId: 'organizationId',
    transactionType: 'transactionType', transactionDate: 'transactionDate',
    amount: 'amount', balanceAfter: 'balanceAfter', description: 'description',
    paymentMethod: 'paymentMethod', receiptNumber: 'receiptNumber', status: 'status',
  },
}))
vi.mock('drizzle-orm', async (original) => {
  const actual = await original<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: vi.fn(() => 'eq'),
    and: vi.fn(() => 'and'),
    desc: vi.fn(() => 'desc'),
  }
})

describe('member dues payment history and unsettled attempts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.auth.mockResolvedValue({ userId: 'member-1' })
    m.requireMember.mockResolvedValue(undefined)
    m.rls.mockImplementation(async (_scope: unknown, cb: (tx: unknown) => Promise<unknown>) => cb(m.db))
    m.db.select.mockReturnValue({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => ({ offset: async () => [{ id: 'posted-1', status: 'posted', amount: '25.00' }] }),
          }),
        }),
      }),
    })
    m.db.execute.mockResolvedValue([{ id: 'attempt-1', status: 'pending', amount: '25.00', createdAt: '2026-10-31' }])
  })

  it('returns pending attempts separately from posted ledger payments', async () => {
    const { GET } = await import('../portal/dues/pay/route')
    const response = await GET(new NextRequest('https://example.test/api/portal/dues/pay?organizationId=11111111-1111-4111-8111-111111111111'))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.payments).toEqual([{ id: 'posted-1', status: 'posted', amount: '25.00' }])
    expect(json.data.attempts).toEqual([{ id: 'attempt-1', status: 'pending', amount: '25.00', createdAt: '2026-10-31' }])
    expect(m.rls).toHaveBeenCalledWith({ organizationId: '11111111-1111-4111-8111-111111111111' }, expect.any(Function))
    expect(m.requireMember).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    expect(m.db.select).toHaveBeenCalledTimes(1)
    expect(m.db.execute).toHaveBeenCalledTimes(1)
  })

  it('refuses another organization without querying any payment table', async () => {
    m.requireMember.mockRejectedValue(new Error('not a member'))
    const { GET } = await import('../portal/dues/pay/route')
    const response = await GET(new NextRequest('https://example.test/api/portal/dues/pay?organizationId=22222222-2222-4222-8222-222222222222'))
    expect(response.status).toBe(403)
    expect(m.db.select).not.toHaveBeenCalled()
    expect(m.db.execute).not.toHaveBeenCalled()
  })

  it('keeps the unsettled-attempt query organization/member scoped and excludes processor identifiers', () => {
    const source = readFileSync(join(__dirname, '..', 'portal', 'dues', 'pay', 'route.ts'), 'utf8')
    expect(source).toContain('withRLSContext({ organizationId: orgId }, async (tx) => {')
    expect(source).toContain('await tx.execute(sql`SELECT')
    expect(source).toContain('WHERE organization_id = ${orgId}::uuid AND member_id = ${userId}')
    expect(source).toContain("AND metadata->>'kind' = ${DUES_PAYMENT_KIND}")
    expect(source).toContain("AND status IN ('pending', 'failed', 'cancelled')")
    expect(source).toContain('LIMIT ${page.limit} OFFSET ${page.offset}')
    const query = source.slice(source.indexOf('SELECT id::text AS id, amount::text AS amount'), source.indexOf('ORDER BY created_at DESC, id DESC'))
    expect(query).not.toContain('processor_payment_id')
    expect(query).not.toContain('payment_reference')
  })
})
