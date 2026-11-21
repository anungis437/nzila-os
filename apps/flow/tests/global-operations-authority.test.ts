import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ auth: vi.fn(), select: vi.fn() }))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }))
vi.mock('@nzila/os-core/telemetry', () => ({
  createRequestContext: () => ({}),
  runWithContext: (_ctx: unknown, fn: () => unknown) => fn(),
  withSpan: (_name: string, _attrs: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@nzila/db', () => ({
  db: { select: m.select },
  commerceOrders: { status: 'status', total: 'total', paymentStatus: 'paymentStatus' },
  commerceQuotes: { status: 'status' },
  flowPayments: { status: 'status' },
  commercePurchaseOrders: { status: 'status', expectedDeliveryDate: 'delivery' },
  flowProductionJobs: { status: 'status' },
  flowShipments: { status: 'status' },
}))
vi.mock('drizzle-orm', () => ({ sql: () => ({}), eq: () => ({}) }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ userId: 'operator', sessionClaims: { roles: ['ops'] } })
  m.select.mockImplementation(() => ({
    from: () => {
      const result = [{ count: 7, avg: 17.5 }]
      return {
        where: () => Promise.resolve(result),
        then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      }
    },
  }))
})

describe.each(['metrics', 'ops/summary'])('global Flow %s authority', (path) => {
  async function get() {
    const route =
      path === 'metrics'
        ? await import('@/app/api/metrics/route')
        : await import('@/app/api/ops/summary/route')
    return route.GET(new Request(`https://flow.test/api/${path}`))
  }
  it('denies an unauthenticated request before database access', async () => {
    m.auth.mockResolvedValue({ userId: null })
    expect((await get()).status).toBe(401)
    expect(m.select).not.toHaveBeenCalled()
  })
  it.each(
    [undefined, [], ['org_admin'], ['org:owner'], ['flow.admin'], 'ops', ['ops', null]].map(
      (roles) => ({ roles }),
    ),
  )('denies ordinary or malformed assignments $roles before database access', async ({ roles }) => {
    m.auth.mockResolvedValue({
      userId: 'ordinary',
      orgRole: 'platform_admin',
      has: () => true,
      sessionClaims: { roles, publicMetadata: { nzilaRole: 'ops' } },
    })
    expect((await get()).status).toBe(403)
    expect(m.select).not.toHaveBeenCalled()
  })
  it.each(['ops', 'platform_admin', 'studio_admin', 'platform.admin', 'system.admin'])(
    'admits the verified platform assignment %s and reads global totals',
    async (role) => {
      m.auth.mockResolvedValue({
        userId: 'operator',
        sessionClaims: { roles: ['org_viewer', role] },
      })
      const response = await get()
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(path === 'metrics' ? body.order_count : body.active_orders).toBe(7)
      expect(m.select).toHaveBeenCalledTimes(path === 'metrics' ? 13 : 4)
    },
  )
  it('preserves successful reads and later fallback values after a query failure', async () => {
    const service = await import('@/lib/services/operational-metrics-service')
    service.recordQuote(true)
    service.setBlockedOrders(3)
    service.setProductionBacklog(4)
    service.setVendorDelayFlags(5)
    m.select
      .mockImplementationOnce(() => ({
        from: () => {
          const result = [{ count: 22 }]
          return {
            where: () => Promise.resolve(result),
            then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
          }
        },
      }))
      .mockImplementationOnce(() => {
        throw new Error('later read unavailable')
      })
    const body = await (await get()).json()
    if (path === 'metrics')
      expect(body).toMatchObject({
        order_count: 22,
        quote_count: 1,
        quote_conversion_rate: 100,
        active_orders_count: 0,
      })
    else
      expect(body).toMatchObject({
        active_orders: 22,
        blocked_orders: 3,
        production_backlog: 4,
        vendor_delay_flags: 5,
      })
    expect(m.select).toHaveBeenCalledTimes(2)
  })
})
