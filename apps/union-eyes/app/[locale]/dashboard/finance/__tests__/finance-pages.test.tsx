// @vitest-environment jsdom
import { Suspense } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../../../../messages/en-CA.json'

const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
  useParams: () => ({ locale: 'en-CA' }),
}))

import FinanceDashboardPage from '../page'
import InvoicesPage from '../invoices/page'
import InvoiceDetailPage from '../invoices/[id]/page'
import AllocationPage from '../allocation/page'
import BillingPage from '../billing/page'
import ExportsPage from '../exports/page'

const stamp = '2026-03-16T12:00:00.000Z'
// standardSuccessResponse(data): the route's own NextResponse, which withApi passes through unchanged.
const success = (data: unknown) => ({ success: true, data, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })
const reply = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, blob: async () => new Blob([JSON.stringify(body)]) })

function renderPage(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      <Suspense fallback={null}>{node}</Suspense>
    </NextIntlClientProvider>,
  )
}

type Handler = (url: string, init?: { method?: string; body?: string }) => ReturnType<typeof reply> | Promise<ReturnType<typeof reply>>
function stubFetch(handler: Handler) {
  const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => handler(url, init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const invoice = {
  id: '5a7e0c1d-3d2b-4a5e-9c55-0d6f1e2a3b4c',
  billingAccountId: 'acct-1',
  organizationId: 'org-1',
  invoiceNumber: 'INV-2026-0007',
  issueDate: '2026-03-01T00:00:00.000Z',
  dueDate: '2026-03-31T00:00:00.000Z',
  subtotal: '100.00',
  taxAmount: '13.00',
  totalAmount: '113.00',
  amountPaid: '40.00',
  currency: 'CAD',
  status: 'issued',
  notes: null,
}

beforeEach(() => {
  nav.push.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('finance dashboard page', () => {
  // The body of GET /api/finance/dashboard: standardSuccessResponse of the route's object, with no ledger summary because no period was asked for.
  const dashboard = {
    domain: 'NZILA_PLATFORM_BILLING',
    notUnionFinancialRecords: true,
    billingAccount: { id: 'acct-1', displayName: 'Local 100', status: 'active', currency: 'CAD' },
    ledgerSummary: null,
    recentInvoices: [invoice],
    recentChargebacks: [],
    duesAlignment: { anomalyCount: 1, anomalies: [{ type: 'arrears_spike', description: '12.0% members in arrears', severity: 'warning', details: {} }], memberCount: 120, arrearsCount: 14 },
  }

  it('shows what the route computed and a dash, not zero, for the ledger it did not compute', async () => {
    stubFetch(() => reply(success(dashboard)))
    renderPage(<FinanceDashboardPage />)
    expect(await screen.findByText('Local 100')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('12.0% members in arrears')).toBeInTheDocument()
    const ledgerCard = screen.getByText(enCA.financeDashboardPage.ledgerEntriesLabel).closest('div')!.parentElement!
    expect(within(ledgerCard).getAllByText(/—/).length).toBeGreaterThan(0)
    expect(within(ledgerCard).queryByText('0')).not.toBeInTheDocument()
  })

  it('sends the user to pages that exist, with the locale and the dashboard segment', async () => {
    stubFetch(() => reply(success(dashboard)))
    renderPage(<FinanceDashboardPage />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(enCA.financeDashboardPage.exports) }))
    expect(nav.push).toHaveBeenLastCalledWith('/en-CA/dashboard/finance/exports')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(enCA.financeDashboardPage.viewAll) }))
    expect(nav.push).toHaveBeenLastCalledWith('/en-CA/dashboard/finance/invoices')
    fireEvent.click(screen.getByText('INV-2026-0007'))
    expect(nav.push).toHaveBeenLastCalledWith(`/en-CA/dashboard/finance/invoices/${invoice.id}`)
  })

  it('shows the server\'s message, with a retry, when the dashboard cannot be read', async () => {
    const fetchMock = stubFetch(() => reply(failure('FORBIDDEN', 'Requires at least \'secretary_treasurer\' role'), 403))
    renderPage(<FinanceDashboardPage />)
    expect(await screen.findByText('Requires at least \'secretary_treasurer\' role')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: enCA.financeDashboardPage.retry }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('shows an error, not a blank dashboard, when the body lacks the lists the page needs', async () => {
    stubFetch(() => reply(success({ billingAccount: null })))
    renderPage(<FinanceDashboardPage />)
    expect(await screen.findByText(/Unexpected API response/)).toBeInTheDocument()
  })
})

describe('finance invoices page', () => {
  const page = (n: number, start = 0) =>
    Array.from({ length: n }, (_, i) => ({ ...invoice, id: `00000000-0000-4000-8000-${String(start + i).padStart(12, '0')}`, invoiceNumber: `INV-${start + i}` }))

  it('reads the list the route sends at data, and loads the next page when a full page came back', async () => {
    const fetchMock = stubFetch((url) => {
      const offset = Number(new URL(url, 'https://app.example').searchParams.get('offset'))
      return reply({ ...success(page(offset === 0 ? 50 : 3, offset)), meta: { total: offset === 0 ? 50 : 3, limit: 50, offset } })
    })
    renderPage(<InvoicesPage />)
    expect(await screen.findByText('INV-0')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: enCA.financeInvoicesPage.loadMore }))
    expect(await screen.findByText('INV-52')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith('/api/finance/invoices?limit=50&offset=50')
    expect(screen.queryByRole('button', { name: enCA.financeInvoicesPage.loadMore })).not.toBeInTheDocument()
  })

  it('opens an invoice at the dashboard path of its page', async () => {
    stubFetch(() => reply(success(page(1))))
    renderPage(<InvoicesPage />)
    fireEvent.click(await screen.findByText('INV-0'))
    expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard/finance/invoices/00000000-0000-4000-8000-000000000000')
  })

  it('shows the route\'s message and a retry, never "no invoices", when the list cannot be read', async () => {
    stubFetch(() => reply(failure('INTERNAL_ERROR', 'Failed to fetch invoices'), 500))
    renderPage(<InvoicesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch invoices')
    expect(screen.queryByText(enCA.financeInvoicesPage.empty)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: enCA.common.retry })).toBeInTheDocument()
  })

  it('says there are no invoices only when the route sent an empty list', async () => {
    stubFetch(() => reply(success([])))
    renderPage(<InvoicesPage />)
    expect(await screen.findByText(enCA.financeInvoicesPage.empty)).toBeInTheDocument()
  })

  it('shows an error when the body has no list', async () => {
    stubFetch(() => reply(success({ invoices: [] })))
    renderPage(<InvoicesPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response')
  })
})

describe('finance invoice detail page', () => {
  const detail = { ...invoice, lineItems: [{ id: 'li-1', description: 'Base subscription', costType: 'base_subscription', quantity: '1.0000', unitPrice: '100.00', amount: '100.00' }] }
  const payment = { id: 'pay-1', amount: '40.00', currency: 'CAD', method: 'eft', status: 'completed', externalReference: 'EFT-9', paidAt: '2026-03-10T00:00:00.000Z', createdAt: '2026-03-10T00:00:00.000Z' }
  // The page reads its route params with `use`, which suspends until the promise settles: the render is awaited inside act.
  const renderDetail = async () => {
    await act(async () => {
      renderPage(<InvoiceDetailPage params={Promise.resolve({ id: invoice.id, locale: 'en-CA' })} />)
    })
  }

  it('shows the invoice with its lines and payments, and a status the catalogue has no word for as the stored word', async () => {
    stubFetch((url) => (url.endsWith('/payments') ? reply(success([payment])) : reply(success(detail))))
    await renderDetail()
    expect(await screen.findByText('INV-2026-0007')).toBeInTheDocument()
    expect(screen.getByText('issued')).toBeInTheDocument()
    expect(screen.getByText('Base subscription')).toBeInTheDocument()
    expect(screen.getByText('EFT-9')).toBeInTheDocument()
    expect(screen.getByText('$73.00')).toBeInTheDocument()
  })

  it('says the payments could not be read, instead of "no payments recorded", when only that call fails', async () => {
    stubFetch((url) => (url.endsWith('/payments') ? reply(failure('INTERNAL_ERROR', 'Failed to fetch payments'), 500) : reply(success(detail))))
    await renderDetail()
    expect(await screen.findByText('INV-2026-0007')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch payments')
    expect(screen.queryByText(enCA.financeInvoiceDetailPage.noPaymentsRecorded)).not.toBeInTheDocument()
  })

  it('states the route\'s refusal for the invoice, not "Invoice not found", when the role is refused', async () => {
    stubFetch(() => reply(failure('FORBIDDEN', 'Requires at least \'secretary_treasurer\' role'), 403))
    await renderDetail()
    expect(await screen.findByText('Requires at least \'secretary_treasurer\' role')).toBeInTheDocument()
    expect(screen.queryByText(enCA.financeInvoiceDetailPage.invoiceNotFound)).not.toBeInTheDocument()
  })

  it('shows the route\'s message when recording a payment is refused', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (init?.method === 'POST') return reply(failure('INSUFFICIENT_PERMISSIONS', 'Requires at least \'admin\' role'), 403)
      return url.endsWith('/payments') ? reply(success([])) : reply(success(detail))
    })
    await renderDetail()
    fireEvent.click(await screen.findByRole('button', { name: enCA.financeInvoiceDetailPage.recordPaymentButton }))
    fireEvent.change(screen.getByPlaceholderText(/Amount \(CAD/), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: enCA.financeInvoiceDetailPage.confirmPaymentButton }))
    expect(await screen.findByText('Requires at least \'admin\' role')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body!)).toEqual({ amount: '10.00', method: 'eft' })
  })
})

describe('finance allocation page', () => {
  // The allocation_rules columns the route sends: there is no cost type on a rule.
  const rule = { id: 'rule-1', organizationId: 'org-1', name: 'Per member', description: null, isActive: true, createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z', createdBy: 'user-1' }
  const periodId = '8f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'

  it('lists rules that have no cost type (it used to crash on one)', async () => {
    stubFetch(() => reply(success([rule])))
    renderPage(<AllocationPage />)
    expect(await screen.findByText('Per member')).toBeInTheDocument()
    expect(screen.getByText(enCA.financeAllocationPage.rules.status.active)).toBeInTheDocument()
  })

  it('shows the simulation the route sent: the cost pool as totalAmount and the lines as weight and allocatedAmount', async () => {
    const fetchMock = stubFetch((url, init) =>
      init?.method === 'POST'
        ? reply(success({ simulation: true, runId: 'run-1', isSimulation: true, totalAmount: '250.00', lines: [{ localId: 'local-1', method: 'per_member_count', basisValue: '10.0000', weight: '40.00', allocatedAmount: '100.00', costType: 'base_subscription' }] }))
        : reply(success([rule])),
    )
    renderPage(<AllocationPage />)
    fireEvent.change(await screen.findByLabelText(enCA.financeAllocationPage.rules.billingPeriodId), { target: { value: periodId } })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(enCA.financeAllocationPage.rules.simulate) }))
    expect(await screen.findByText(/Total cost pool: \$250\.00/)).toBeInTheDocument()
    expect(screen.getByText('40.00%')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/NaN|undefined/)
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body!)).toEqual({ ruleId: 'rule-1', billingPeriodId: periodId, localBasisData: [] })
  })

  it('does not offer a simulation for a billing period id that is not a UUID', async () => {
    stubFetch(() => reply(success([rule])))
    renderPage(<AllocationPage />)
    fireEvent.change(await screen.findByLabelText(enCA.financeAllocationPage.rules.billingPeriodId), { target: { value: 'period-1' } })
    expect(screen.getByRole('button', { name: new RegExp(enCA.financeAllocationPage.rules.simulate) })).toBeDisabled()
  })

  it('shows the route\'s message and a retry, not "no rules", when the rules cannot be read', async () => {
    stubFetch(() => reply(failure('INTERNAL_ERROR', 'Failed to fetch allocation rules'), 500))
    renderPage(<AllocationPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch allocation rules')
    expect(screen.queryByText(enCA.financeAllocationPage.rules.empty)).not.toBeInTheDocument()
  })

  it('shows the route\'s message when the simulation is refused', async () => {
    stubFetch((url, init) => (init?.method === 'POST' ? reply(failure('INTERNAL_ERROR', 'Simulation failed'), 500) : reply(success([rule]))))
    renderPage(<AllocationPage />)
    fireEvent.change(await screen.findByLabelText(enCA.financeAllocationPage.rules.billingPeriodId), { target: { value: periodId } })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(enCA.financeAllocationPage.rules.simulate) }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Simulation failed')
  })
})

describe('finance billing page', () => {
  const account = {
    id: 'acct-1',
    organizationId: 'org-1',
    displayName: 'Local 100',
    billingEmail: 'billing@local100.example',
    billingContactName: null,
    billingPhone: null,
    billingAddress: null,
    taxId: null,
    currency: 'CAD',
    status: 'active',
    netTermsDays: 30,
    createdAt: '2026-01-02T00:00:00.000Z',
  }

  it('shows the account the route sent', async () => {
    stubFetch(() => reply(success(account)))
    renderPage(<BillingPage />)
    expect(await screen.findByText('Local 100')).toBeInTheDocument()
    expect(screen.getByText('billing@local100.example')).toBeInTheDocument()
  })

  it('offers to create an account only when the route says there is none', async () => {
    stubFetch(() => reply(failure('NOT_FOUND', 'No billing account found'), 404))
    renderPage(<BillingPage />)
    expect(await screen.findByText(enCA.financeBillingPage.setupBillingTitle)).toBeInTheDocument()
  })

  it('does not offer to create an account, and states the server\'s message with a retry, when the account cannot be read', async () => {
    const fetchMock = stubFetch(() => reply(failure('FORBIDDEN', 'Requires at least \'secretary_treasurer\' role'), 403))
    renderPage(<BillingPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Requires at least \'secretary_treasurer\' role')
    expect(screen.queryByText(enCA.financeBillingPage.setupBillingTitle)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: enCA.common.retry }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('shows the route\'s validation message when creating the account is refused', async () => {
    stubFetch((url, init) => (init?.method === 'POST' ? reply(failure('VALIDATION_ERROR', 'Invalid input'), 400) : reply(failure('NOT_FOUND', 'No billing account found'), 404)))
    renderPage(<BillingPage />)
    fireEvent.change(await screen.findByPlaceholderText(enCA.financeBillingPage.organizationNamePlaceholder), { target: { value: 'Local 100' } })
    fireEvent.change(screen.getByPlaceholderText(enCA.financeBillingPage.billingEmailPlaceholder), { target: { value: 'billing@local100.example' } })
    fireEvent.click(screen.getByRole('button', { name: enCA.financeBillingPage.createButton }))
    expect(await screen.findByText('Invalid input')).toBeInTheDocument()
  })

  it('shows an error when the body is not an account', async () => {
    stubFetch(() => reply(success({ status: 'active' })))
    renderPage(<BillingPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response')
  })
})

describe('finance exports page', () => {
  const periodId = '8f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:export') }))
  })

  it('states the route\'s own message when an export is refused', async () => {
    stubFetch(() => reply(failure('VALIDATION_ERROR', 'periodId required'), 400))
    renderPage(<ExportsPage />)
    fireEvent.click(screen.getByRole('button', { name: enCA.financeExportsPage.generate.generateButton }))
    expect(await screen.findByText('periodId required')).toBeInTheDocument()
    expect(screen.queryByText(enCA.financeExportsPage.messages.exportFailed)).not.toBeInTheDocument()
  })

  it('reports the row count and hash the export carries, and names the download for what it is', async () => {
    const fetchMock = stubFetch(() => reply(success({ meta: { exportId: 'e-1', rowCount: 12, dataHash: 'abcdef0123456789' }, rows: [] })))
    renderPage(<ExportsPage />)
    fireEvent.change(screen.getAllByPlaceholderText(enCA.financeExportsPage.generate.uuidPlaceholder)[0], { target: { value: periodId } })
    fireEvent.click(screen.getByRole('button', { name: enCA.financeExportsPage.generate.generateButton }))
    expect(await screen.findByText('Exported 12 rows (hash: abcdef012345)')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(`/api/finance/exports?type=gl_journal&periodId=${periodId}&format=json`)
    expect(screen.getByRole('link', { name: enCA.financeExportsPage.results.download })).toHaveAttribute('download', 'gl_journal-export.json')
  })

  it('refuses an export that carries no row count or hash instead of reporting zero rows', async () => {
    stubFetch(() => reply(success({ rows: [] })))
    renderPage(<ExportsPage />)
    fireEvent.click(screen.getByRole('button', { name: enCA.financeExportsPage.generate.generateButton }))
    expect(await screen.findByText(/Unexpected API response/)).toBeInTheDocument()
    expect(screen.queryByText(/Exported 0 rows/)).not.toBeInTheDocument()
  })
})
