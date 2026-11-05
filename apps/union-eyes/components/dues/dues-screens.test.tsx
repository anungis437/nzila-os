// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import frCA from '../../messages/fr-CA.json'
import DeductionHistory from './deduction-history'
import PaymentHistory from './payment-history'
import DuesPaymentPortal from './dues-payment-portal'
import ReportDeductionIssue from './report-deduction-issue'

// Radix Select needs pointer events jsdom does not have; the form's own submit path is what is under test, so the select is a native one.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) => (
    <select aria-label="Issue type" value={value} onChange={(event) => onValueChange(event.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// withApi wraps what a handler returns as { success, data, timestamp }; a handler that returns { data: rows } therefore arrives at data.data.
const envelope = (payload: unknown) => ({ success: true, data: payload, timestamp: '2026-03-16T12:00:00.000Z' })
const failure = (message: string) => ({ code: 'INTERNAL_ERROR', message, timestamp: '2026-03-16T12:00:00.000Z', traceId: 'abc' })

type Routes = Record<string, { ok?: boolean; status?: number; body: unknown } | (() => never)>

function answerRoutes(routes: Routes) {
  const fetchMock = vi.fn(async (url: string) => {
    const route = routes[url.split('?')[0]]
    if (!route) throw new Error(`unexpected request ${url}`)
    if (typeof route === 'function') return route()
    return { ok: route.ok ?? true, status: route.status ?? 200, json: async () => route.body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderInIntl(node: React.ReactNode, locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      {node}
    </NextIntlClientProvider>,
  )
}

// GET /api/dues/deductions: the columns the route selects; numeric columns arrive as the decimal text PostgreSQL gives them.
const deduction = {
  id: 'deduction-1',
  payPeriodStart: '2026-03-01T00:00:00.000Z',
  payPeriodEnd: '2026-03-14T00:00:00.000Z',
  grossPay: '2400.00',
  netPay: '1910.55',
  unionDuesAmount: '45.50',
  source: 'remittance',
  verified: true,
  verifiedAt: '2026-03-20T00:00:00.000Z',
  createdAt: '2026-03-16T12:00:00.000Z',
}

// GET /api/dues/payment-history: the route's own mapping of member_dues_ledger rows.
const payment = {
  id: '5f0c7d3e-2b1a-4c55-9d1e-0a1b2c3d4e5f',
  date: '2026-05-01T00:00:00.000Z',
  amount: 25,
  lateFeeAmount: 0,
  totalAmount: 25,
  status: 'completed',
  paymentMethod: 'direct_debit',
  periodStart: null,
  periodEnd: null,
  receiptUrl: '/api/dues/receipt/5f0c7d3e-2b1a-4c55-9d1e-0a1b2c3d4e5f',
}

describe('DeductionHistory', () => {
  it('shows the deductions the route sends inside the framework envelope', async () => {
    const fetchMock = answerRoutes({ '/api/dues/deductions': { body: envelope({ data: [deduction] }) } })
    renderInIntl(<DeductionHistory userId="member-1" />)
    expect(await screen.findByText('$45.50')).toBeInTheDocument()
    expect(screen.getByText('$2,400.00')).toBeInTheDocument()
    expect(screen.getByText(enCA.dashboard.dues.deductions.verified)).toBeInTheDocument()
    expect(screen.getByText(enCA.dashboard.dues.deductions.sources.remittance)).toBeInTheDocument()
    // The request names nobody: the server knows who is asking.
    expect(fetchMock).toHaveBeenCalledWith('/api/dues/deductions')
  })

  it('shows a dash, not a made-up figure, when the source stated no gross pay', async () => {
    answerRoutes({ '/api/dues/deductions': { body: envelope({ data: [{ ...deduction, grossPay: null }] }) } })
    renderInIntl(<DeductionHistory userId="member-1" />)
    expect(await screen.findByText('$45.50')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows the empty state only when the route answered with no deduction', async () => {
    answerRoutes({ '/api/dues/deductions': { body: envelope({ data: [] }) } })
    renderInIntl(<DeductionHistory userId="member-1" />)
    expect(await screen.findByText(enCA.dashboard.dues.deductions.empty)).toBeInTheDocument()
  })

  it('shows the server\'s message, not the empty state, when the request fails, and retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => failure('The deductions could not be read') })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => envelope({ data: [deduction] }) })
    vi.stubGlobal('fetch', fetchMock)
    renderInIntl(<DeductionHistory userId="member-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The deductions could not be read')
    expect(screen.queryByText(enCA.dashboard.dues.deductions.empty)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: enCA.common.retry }))
    expect(await screen.findByText('$45.50')).toBeInTheDocument()
  })

  it('shows an error, not the empty state, when the body is not the route envelope', async () => {
    answerRoutes({ '/api/dues/deductions': { body: { data: [deduction] } } })
    renderInIntl(<DeductionHistory userId="member-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response')
    expect(screen.queryByText(enCA.dashboard.dues.deductions.empty)).not.toBeInTheDocument()
  })

  it('renders in French from the French catalogue', async () => {
    answerRoutes({ '/api/dues/deductions': { body: envelope({ data: [deduction] }) } })
    renderInIntl(<DeductionHistory userId="member-1" />, 'fr-CA')
    expect(await screen.findByText(frCA.dashboard.dues.deductions.sources.remittance)).toBeInTheDocument()
  })
})

describe('PaymentHistory', () => {
  it('lists the payments the route sends inside the framework envelope (it used to read data as an array and so always showed none)', async () => {
    const fetchMock = answerRoutes({ '/api/dues/payment-history': { body: envelope({ data: [payment] }) } })
    renderInIntl(<PaymentHistory userId="member-1" />)
    expect(await screen.findByText('direct_debit')).toBeInTheDocument()
    expect(screen.getAllByText('$25.00')).toHaveLength(2)
    expect(screen.getByText(enCA.dashboard.dues.history.status.completed)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/dues/payment-history')
  })

  it('shows a dash for the period and the method a ledger entry does not state', async () => {
    answerRoutes({ '/api/dues/payment-history': { body: envelope({ data: [{ ...payment, paymentMethod: null }] }) } })
    renderInIntl(<PaymentHistory userId="member-1" />)
    expect(await screen.findAllByText('—')).toHaveLength(2)
  })

  it('links a completed payment to its receipt page, which exists, instead of saving the receipt JSON as a PDF', async () => {
    answerRoutes({ '/api/dues/payment-history': { body: envelope({ data: [payment] }) } })
    renderInIntl(<PaymentHistory userId="member-1" />)
    const link = await screen.findByRole('link', { name: enCA.dashboard.dues.history.columns.receipt })
    expect(link).toHaveAttribute('href', `/en-CA/dashboard/dues/receipts/${payment.id}`)
  })

  it('shows the empty state only when the route answered with no payment', async () => {
    answerRoutes({ '/api/dues/payment-history': { body: envelope({ data: [] }) } })
    renderInIntl(<PaymentHistory userId="member-1" />)
    expect(await screen.findByText(enCA.dashboard.dues.history.empty)).toBeInTheDocument()
  })

  it('shows the server\'s message, not the empty state, when the request fails', async () => {
    answerRoutes({ '/api/dues/payment-history': { ok: false, status: 500, body: failure('The ledger could not be read') } })
    renderInIntl(<PaymentHistory userId="member-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The ledger could not be read')
    expect(screen.queryByText(enCA.dashboard.dues.history.empty)).not.toBeInTheDocument()
  })

  it('shows an error when the body is not the route envelope', async () => {
    answerRoutes({ '/api/dues/payment-history': { body: { data: [payment] } } })
    renderInIntl(<PaymentHistory userId="member-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response')
  })
})

describe('DuesPaymentPortal', () => {
  // GET /api/dues/balance: the route's DuesBalanceContext inside the framework envelope.
  const balance = {
    source: 'native',
    available: true,
    currentBalance: 45.5,
    balanceStatus: 'owing',
    isInArrears: true,
    arrearsAmount: 45.5,
    lastPayment: { amount: 25, date: '2026-05-01T00:00:00.000Z' },
    asOf: '2026-05-02T10:00:00.000Z',
  }

  it('shows the balance the route calculated, asking without naming anybody', async () => {
    const fetchMock = answerRoutes({
      '/api/dues/balance': { body: envelope(balance) },
      '/api/dues/deductions': { body: envelope({ data: [] }) },
    })
    renderInIntl(<DuesPaymentPortal userId="member-1" />)
    expect(await screen.findByText(enCA.dashboard.dues.tabs.deductions)).toBeInTheDocument()
    expect(screen.getAllByText('$45.50').length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/dues/balance')
  })

  it('says there is no dues data on file only when the route says so', async () => {
    answerRoutes({
      '/api/dues/balance': {
        body: envelope({ source: 'unavailable', available: false, currentBalance: null, balanceStatus: null, isInArrears: null, arrearsAmount: null, lastPayment: null }),
      },
    })
    renderInIntl(<DuesPaymentPortal userId="member-1" />)
    expect(await screen.findByText(enCA.dashboard.dues.noDataTitle)).toBeInTheDocument()
  })

  it('shows the server\'s message with a retry when the balance cannot be loaded, and does not claim there is no data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => failure('The ledger is unreachable') })
      .mockImplementation(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () => (url.startsWith('/api/dues/balance') ? envelope(balance) : envelope({ data: [] })),
      }))
    vi.stubGlobal('fetch', fetchMock)
    renderInIntl(<DuesPaymentPortal userId="member-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The ledger is unreachable')
    expect(screen.queryByText(enCA.dashboard.dues.noDataTitle)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: enCA.common.retry }))
    expect(await screen.findByText(enCA.dashboard.dues.tabs.deductions)).toBeInTheDocument()
  })

  it('shows an error, not "no dues data on file", when the body is not the route envelope', async () => {
    answerRoutes({ '/api/dues/balance': { body: { success: true } } })
    renderInIntl(<DuesPaymentPortal userId="member-1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response')
    expect(screen.queryByText(enCA.dashboard.dues.noDataTitle)).not.toBeInTheDocument()
  })
})

describe('ReportDeductionIssue', () => {
  async function fillAndSubmit() {
    fireEvent.change(screen.getByLabelText('Subject *'), { target: { value: 'Missing dues' } })
    fireEvent.change(screen.getByLabelText('Description *'), { target: { value: 'No dues were deducted on 14 March.' } })
    fireEvent.change(screen.getByLabelText('Issue type'), { target: { value: 'missing_deduction' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Issue Report' }))
  }

  it('sends only what the route accepts and says so only after the route accepted it', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, issue: { id: 'issue-1' } }) }))
    vi.stubGlobal('fetch', fetchMock)
    renderInIntl(<ReportDeductionIssue deductionId="d3b07384-d9a1-4f52-8a64-0f6c8b6f1a10" />)
    await fillAndSubmit()
    expect(await screen.findByText('Issue Reported')).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }]
    expect(url).toBe('/api/dues/issues')
    expect(JSON.parse(init.body)).toEqual({
      issueType: 'missing_deduction',
      subject: 'Missing dues',
      description: 'No dues were deducted on 14 March.',
      payrollDeductionId: 'd3b07384-d9a1-4f52-8a64-0f6c8b6f1a10',
    })
  })

  it('shows the route\'s own refusal and does not claim the issue was reported', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ code: 'NOT_FOUND', message: 'Payroll deduction not found', timestamp: 'x' }) })),
    )
    renderInIntl(<ReportDeductionIssue deductionId="d3b07384-d9a1-4f52-8a64-0f6c8b6f1a10" />)
    await fillAndSubmit()
    await waitFor(() => expect(screen.getAllByText('Payroll deduction not found').length).toBeGreaterThan(0))
    expect(screen.queryByText('Issue Reported')).not.toBeInTheDocument()
  })
})
