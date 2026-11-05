// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../../../../../messages/en-CA.json'

vi.mock('@nzila/platform-auth/entra/client', () => ({ useAuth: () => ({ orgId: 'org-1' }) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import AdminDuesDashboard from '../page'
import BillingCycleManagement from '../billing-cycles/page'
import ReportsAnalyticsPage from '../reports/page'
import AdminPaymentsList from '../payments/page'
import PaymentDetailPage from '../payments/[id]/page'

const stamp = '2026-05-31T12:00:00.000Z'
const success = (data: unknown) => ({ success: true, data, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })
const cad = (amount: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)

// GET /api/admin/dues/overview: the overview inside the withApi body. A payment may have no roster name and no period.
const overview = (overrides: Record<string, unknown> = {}) =>
  success({
    financialKpis: { totalCollected: 12500.5, totalOutstanding: 3200, totalOverdue: 1800.25 },
    paymentStats: { pending: 4, paid: 31, overdue: 6, total: 41 },
    recentPayments: [
      { id: 'p1', memberName: 'Alex Tremblay', amount: 25, status: 'posted', paidDate: '2026-03-02T12:00:00.000Z', dueDate: '2026-03-01T12:00:00.000Z' },
      { id: 'p2', memberName: null, amount: 30, status: 'pending', paidDate: null, dueDate: null },
    ],
    periodStats: {
      thisMonth: { collected: 1500, outstanding: 200, transactionCount: 12 },
      lastMonth: { collected: 1000, outstanding: 300, transactionCount: 9 },
    },
    ...overrides,
  })

type Reply = { status?: number; body: unknown } | 'network'
function stubFetch(router: (url: URL, init?: RequestInit) => Reply) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const reply = router(new URL(input, 'http://localhost'), init)
    if (reply === 'network') throw new TypeError('Failed to fetch')
    const status = reply.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => reply.body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const inIntl = (ui: React.ReactNode) => render(<NextIntlClientProvider locale="en-CA" messages={enCA}>{ui}</NextIntlClientProvider>)

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('admin dues dashboard', () => {
  it('shows the figures the overview answers, a change only because both months have collections, and a payment with no member or period', async () => {
    stubFetch(() => ({ body: overview() }))
    inIntl(<AdminDuesDashboard />)

    expect(await screen.findByRole('heading', { name: 'Dues Administration' })).toBeInTheDocument()
    expect(screen.getByText(cad(12500.5))).toBeInTheDocument()
    expect(screen.getByText(cad(3200))).toBeInTheDocument()
    expect(screen.getByText(cad(1800.25))).toBeInTheDocument()
    // This month 1500 against last month 1000: both computed by the route from stored rows.
    expect(screen.getByText('+50.0% from last month')).toBeInTheDocument()

    const table = screen.getByRole('table')
    const alex = within(table).getByText('Alex Tremblay').closest('tr') as HTMLElement
    expect(within(alex).getByText(cad(25))).toBeInTheDocument()
    // A ledger "posted" payment is a paid one, as the paid count above it says.
    expect(within(alex).getByText('Paid')).toBeInTheDocument()
    const noName = within(table).getByText(cad(30)).closest('tr') as HTMLElement
    expect(within(noName).getAllByText('-').length).toBeGreaterThanOrEqual(2)
    expect(within(noName).getByText('Pending')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Generate Billing Cycle/ })).toHaveAttribute('href', '/en-CA/dashboard/admin/dues/billing-cycles')
  })

  it('shows no percentage when last month collected nothing', async () => {
    stubFetch(() => ({
      body: overview({ periodStats: { thisMonth: { collected: 1500, outstanding: 200, transactionCount: 12 }, lastMonth: { collected: 0, outstanding: 0, transactionCount: 0 } } }),
    }))
    inIntl(<AdminDuesDashboard />)
    await screen.findByRole('heading', { name: 'Dues Administration' })
    expect(screen.queryByText(/% from last month/)).not.toBeInTheDocument()
  })

  it('shows the route refusal with a retry, and no zero figures while it has nothing', async () => {
    let refused = true
    stubFetch(() => (refused ? { status: 403, body: failure('FORBIDDEN', 'Insufficient permissions') } : { body: overview() }))
    const user = userEvent.setup()
    inIntl(<AdminDuesDashboard />)

    expect(await screen.findByText('Error Loading Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Insufficient permissions')).toBeInTheDocument()
    expect(screen.queryByText(cad(0))).not.toBeInTheDocument()

    refused = false
    await user.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(await screen.findByRole('heading', { name: 'Dues Administration' })).toBeInTheDocument()
  })

  it('reports an answer that is not the overview shape instead of showing zeros', async () => {
    stubFetch(() => ({ body: success({ financialKpis: { totalCollected: 1 } }) }))
    inIntl(<AdminDuesDashboard />)
    expect(await screen.findByText('Error Loading Dashboard')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Dues Administration' })).not.toBeInTheDocument()
  })
})

describe('admin dues billing cycles', () => {
  // POST /api/admin/billing-cycles[/preview]: the cycle the service computed, inside the withApi body (preview adds preview: true and a message).
  const cycle = (overrides: Record<string, unknown> = {}) =>
    success({
      preview: true,
      success: true,
      cycleId: 'cycle-1',
      transactionsCreated: 41,
      totalAmount: 2050.5,
      frequency: 'bi_weekly',
      periodStart: '2026-06-01T12:00:00.000Z',
      periodEnd: '2026-06-14T12:00:00.000Z',
      breakdown: { duesAmount: 1800, copeAmount: 150.5, pacAmount: 0, strikeFundAmount: 100 },
      members: { processed: 44, success: 41, failed: 0, skipped: 3 },
      message: 'Preview generated successfully. No transactions were created.',
      ...overrides,
    })

  it('previews and then generates for the organization and frequency, and states the count and total the route answered', async () => {
    const fetchMock = stubFetch((url) =>
      url.pathname === '/api/admin/billing-cycles/preview' ? { body: cycle() } : { body: cycle({ preview: undefined }) },
    )
    const user = userEvent.setup()
    inIntl(<BillingCycleManagement />)

    await user.click(await screen.findByRole('button', { name: 'Generate Billing Cycle' }))
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByText('Preview Results')).toBeInTheDocument()
    expect(screen.getByText('44')).toBeInTheDocument()
    expect(screen.getByText('93%')).toBeInTheDocument()
    expect(screen.getByText('bi-weekly')).toBeInTheDocument()

    const [previewUrl, previewInit] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(previewUrl).toBe('/api/admin/billing-cycles/preview')
    expect(JSON.parse(String(previewInit.body))).toEqual({ organizationId: 'org-1', frequency: 'monthly' })

    await user.click(screen.getByRole('button', { name: 'Generate Billing Cycle' }))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(/Created 41 transactions totaling/)
    const [generateUrl, generateInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(generateUrl).toBe('/api/admin/billing-cycles')
    expect(JSON.parse(String(generateInit.body))).toEqual({ organizationId: 'org-1', frequency: 'monthly', dryRun: false })
  })

  it('shows what the route said when it refused a preview, whether a missing mandate (403) or an incomplete preview (422)', async () => {
    let reply: Reply = { status: 403, body: failure('FORBIDDEN', 'Live financial execution mandate required for target organization') }
    stubFetch(() => reply)
    const user = userEvent.setup()
    inIntl(<BillingCycleManagement />)

    await user.click(await screen.findByRole('button', { name: 'Generate Billing Cycle' }))
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByText('Live financial execution mandate required for target organization')).toBeInTheDocument()
    expect(screen.queryByText('Preview Results')).not.toBeInTheDocument()
    // Nothing can be generated from a preview that did not happen.
    expect(screen.getByRole('button', { name: 'Generate Billing Cycle' })).toBeDisabled()

    reply = { status: 422, body: { ...(cycle().data as object), success: false, message: 'Preview incomplete: some members could not be calculated; no charges were created.' } }
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByText('Preview incomplete: some members could not be calculated; no charges were created.')).toBeInTheDocument()
    expect(screen.queryByText('Preview Results')).not.toBeInTheDocument()
  })

  it('does not list example cycles: the history is stated as not available', async () => {
    stubFetch(() => ({ body: cycle() }))
    inIntl(<BillingCycleManagement />)
    expect(await screen.findByRole('heading', { name: 'Billing Cycle Management' })).toBeInTheDocument()
    const history = screen.getByText('Recent Billing Cycles').closest('div.rounded-lg') as HTMLElement
    expect(within(history).getByRole('alert')).toHaveTextContent('Not available in this release')
    expect(within(history).getByText('UE-FIN-DUES-BILLING-CYCLE-HISTORY')).toBeInTheDocument()
    expect(screen.queryByText(/Cycle #|\$\d/)).not.toBeInTheDocument()
  })
})

describe('admin dues pages with nothing behind them', () => {
  it.each([
    ['reports', () => <ReportsAnalyticsPage />, 'Financial Reports & Analytics', 'UE-FIN-DUES-REPORTS'],
    ['payments list', () => <AdminPaymentsList />, 'Payment Management', 'UE-FIN-DUES-ADMIN-PAYMENTS'],
    ['payment detail', () => <PaymentDetailPage />, 'Payment Details', 'UE-FIN-DUES-ADMIN-PAYMENTS'],
  ])('%s states that it is not available and fetches nothing', async (_name, page, heading, capability) => {
    const fetchMock = stubFetch(() => ({ body: success({}) }))
    inIntl(page())
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Not available in this release')
    expect(screen.getByText(capability)).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled())
  })
})
