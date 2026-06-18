import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAuthenticateUser,
  mockWithRequestContext,
  mockWithSpan,
  mockDbSelect,
} = vi.hoisted(() => ({
  mockAuthenticateUser: vi.fn(),
  mockWithRequestContext: vi.fn(async (_req: Request, fn: () => Promise<unknown>) => fn()),
  mockWithSpan: vi.fn(async (_name: string, _attrs: Record<string, unknown>, fn: () => Promise<unknown>) => fn()),
  mockDbSelect: vi.fn(),
}))

vi.mock('@/lib/api-guards', () => ({
  authenticateUser: mockAuthenticateUser,
  withRequestContext: mockWithRequestContext,
}))

vi.mock('@nzila/os-core/telemetry', () => ({
  withSpan: mockWithSpan,
}))

vi.mock('@nzila/db', () => ({
  db: { select: mockDbSelect },
  commerceOrders: { status: 'order_status', total: 'order_total', paymentStatus: 'order_payment_status' },
  commerceQuotes: { status: 'quote_status' },
  flowPayments: { status: 'payment_status' },
  commercePurchaseOrders: { expectedDeliveryDate: 'po_expected', status: 'po_status' },
  flowProductionJobs: { status: 'job_status' },
  flowShipments: { status: 'shipment_status' },
}))

vi.mock('drizzle-orm', () => ({
  sql: vi.fn((strings: TemplateStringsArray) => strings.join('')),
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
}))

function queueSelectResults(results: Array<Array<Record<string, number>>>) {
  const queue = [...results]
  mockDbSelect.mockImplementation(() => ({
    from: () => {
      const result = queue.shift() ?? []
      return {
        where: vi.fn(async () => result),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      }
    },
  }))
}

describe('api metrics route slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuthenticateUser.mockResolvedValue({ ok: true, userId: 'u-1' })
  })

  it('returns auth response when unauthenticated', async () => {
    mockAuthenticateUser.mockResolvedValueOnce({ ok: false, response: new Response('unauthorized', { status: 401 }) })

    const { GET } = await import('@/app/api/metrics/route')
    const response = await GET(new Request('http://localhost/api/metrics'))

    expect(response.status).toBe(401)
    await expect(response.text()).resolves.toContain('unauthorized')
  })

  it('returns DB-backed metrics and computes ratios/averages', async () => {
    queueSelectResults([
      [{ count: 50 }],
      [{ count: 20 }],
      [{ count: 5 }],
      [{ avg: 123.456 }],
      [{ count: 3 }],
      [{ count: 7 }],
      [{ count: 11 }],
      [{ count: 4 }],
      [{ count: 6 }],
      [{ count: 8 }],
      [{ count: 2 }],
      [{ count: 9 }],
      [{ count: 13 }],
    ])

    const { GET, recordRequest, recordOrder, recordQuote, recordPaymentBlock, recordVendorDelay, recordProductionCycle } = await import('@/app/api/metrics/route')

    recordRequest(100)
    recordRequest(50, true)
    recordOrder(500)
    recordQuote(true)
    recordQuote(false)
    recordPaymentBlock()
    recordVendorDelay()
    recordProductionCycle(4)

    const response = await GET(new Request('http://localhost/api/metrics'))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toMatchObject({
      service: 'flow',
      order_count: 50,
      quote_count: 20,
      quote_conversion_rate: 25,
      avg_order_value: 123.46,
      active_orders_count: 11,
      delivered_orders_count: 13,
      blocked_orders_by_payment_count: 4,
      payment_blocked_orders: 3,
      purchase_orders_pending_count: 6,
      purchase_orders_overdue_count: 7,
      vendor_delay_count: 7,
      production_jobs_in_progress_count: 8,
      production_jobs_blocked_count: 2,
      shipments_in_transit_count: 9,
      request_count: 2,
      error_rate: 50,
      latency_ms: 75,
    })
    expect(typeof body.generated_at).toBe('string')
  })

  it('falls back to in-process counters when DB access fails', async () => {
    mockDbSelect.mockImplementation(() => {
      throw new Error('db down')
    })

    const { GET, recordRequest, recordOrder, recordQuote, recordPaymentBlock, recordVendorDelay, recordProductionCycle } = await import('@/app/api/metrics/route')

    recordRequest(25)
    recordOrder(200)
    recordQuote(true)
    recordPaymentBlock()
    recordVendorDelay()
    recordProductionCycle(6)

    const response = await GET(new Request('http://localhost/api/metrics'))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toMatchObject({
      order_count: 1,
      quote_count: 1,
      quote_conversion_rate: 100,
      avg_order_value: 200,
      payment_blocked_orders: 1,
      vendor_delay_count: 1,
      production_cycle_time: 6,
      request_count: 1,
      error_rate: 0,
      latency_ms: 25,
    })
  })

  it('uses nullish DB defaults and zero-rate fallback branches', async () => {
    queueSelectResults([[], [], [], [], [], [], [], [], [], [], [], [], []])

    const { GET } = await import('@/app/api/metrics/route')
    const response = await GET(new Request('http://localhost/api/metrics'))

    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body).toMatchObject({
      order_count: 0,
      quote_count: 0,
      quote_conversion_rate: 0,
      avg_order_value: 0,
      active_orders_count: 0,
      delivered_orders_count: 0,
      blocked_orders_by_payment_count: 0,
      payment_blocked_orders: 0,
      purchase_orders_pending_count: 0,
      purchase_orders_overdue_count: 0,
      production_jobs_in_progress_count: 0,
      production_jobs_blocked_count: 0,
      production_cycle_time: 0,
      shipments_in_transit_count: 0,
      request_count: 0,
      error_rate: 0,
      latency_ms: 0,
    })
  })
})
