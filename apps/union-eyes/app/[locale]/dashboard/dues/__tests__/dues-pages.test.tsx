// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../../../../messages/en-CA.json'

const nav = vi.hoisted(() => ({ push: vi.fn(), params: { transactionId: '8d1f6c7e-0a52-4a7e-b3a0-2f0f9f6a1c11' } }))
vi.mock('next/navigation', () => ({
  useParams: () => nav.params,
  useRouter: () => ({ push: nav.push }),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/utils/sanitize', () => ({ validateRedirectUrl: (url: string) => (url.startsWith('https://checkout.stripe.com/') ? url : null) }))

import PaymentCheckoutPage from '../pay/[transactionId]/page'
import ReceiptViewerPage from '../receipts/[transactionId]/page'

const transactionId = nav.params.transactionId
const envelope = (payload: unknown) => ({ success: true, data: payload, timestamp: '2026-03-16T12:00:00.000Z' })
const failure = (code: string, message: string) => ({ code, message, timestamp: '2026-03-16T12:00:00.000Z' })

function renderPage(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      {node}
    </NextIntlClientProvider>,
  )
}

// A dues_transactions row as GET /api/members/dues sends it: decimal text for numeric columns, null for the parts a charge does not have.
const dueTransaction = {
  id: transactionId,
  organizationId: 'org-1',
  memberId: 'member-1',
  transactionType: 'charge',
  amount: '48.00',
  periodStart: '2026-03-01',
  periodEnd: '2026-03-31',
  dueDate: '2026-03-15',
  status: 'pending',
  paymentMethod: null,
  processorType: null,
  metadata: {},
  createdAt: '2026-03-01T00:00:00.000Z',
  duesAmount: '45.00',
  copeAmount: '3.00',
  pacAmount: null,
  strikeFundAmount: null,
  lateFeeAmount: null,
  adjustmentAmount: null,
  totalAmount: '48.00',
  paidDate: null,
  receiptUrl: null,
}
const listPage = (rows: unknown[], page = 1, totalPages = 1) => envelope({ data: rows, pagination: { page, limit: 100, total: rows.length, totalPages } })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  nav.push.mockReset()
})

describe('dues payment page', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: { origin: 'https://app.example', href: 'https://app.example/en-CA/dashboard/dues/pay/x' } })
  })

  it('finds the transaction in the route\'s list envelope, on any page of it, and states only the parts the charge has', async () => {
    const other = { ...dueTransaction, id: 'someone-else', totalAmount: '99.00' }
    const fetchMock = vi.fn(async (url: string) => {
      const page = Number(new URL(url, 'https://app.example').searchParams.get('page'))
      return { ok: true, status: 200, json: async () => (page === 1 ? listPage([other], 1, 2) : listPage([dueTransaction], 2, 2)) }
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<PaymentCheckoutPage />)
    expect(await screen.findByText('$48.00')).toBeInTheDocument()
    expect(screen.getByText('$3.00')).toBeInTheDocument()
    expect(screen.queryByText(enCA.duesPayPage.pacContributionLabel)).not.toBeInTheDocument()
    expect(screen.queryByText(enCA.duesPayPage.adjustmentLabel)).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/members/dues?limit=100&page=2')
  })

  it('does not offer a bank-transfer option nothing implements', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => listPage([dueTransaction]) })))
    renderPage(<PaymentCheckoutPage />)
    expect(await screen.findByText(enCA.duesPayPage.cardOptionTitle)).toBeInTheDocument()
    expect(screen.queryByText(enCA.duesPayPage.bankTransferOptionTitle)).not.toBeInTheDocument()
  })

  it('says the transaction was not found when the member has no such transaction', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => listPage([{ ...dueTransaction, id: 'other' }]) })))
    renderPage(<PaymentCheckoutPage />)
    expect(await screen.findByText(enCA.duesPayPage.transactionNotFound)).toBeInTheDocument()
  })

  it('shows the server\'s message when the transactions cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => failure('INTERNAL_ERROR', 'The dues ledger could not be read') })))
    renderPage(<PaymentCheckoutPage />)
    expect(await screen.findByText('The dues ledger could not be read')).toBeInTheDocument()
  })

  it('starts the payment with the body the route accepts and goes to the checkout address the route returns', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/members/dues')) return { ok: true, status: 200, json: async () => listPage([dueTransaction]) }
      return {
        ok: true,
        status: 200,
        json: async () => envelope({ sessionId: 'cs_1', checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_1', transactionId, amount: '48.00', currency: 'CAD' }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<PaymentCheckoutPage />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(enCA.duesPayPage.cardOptionTitle) }))
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.com/c/pay/cs_1'))
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/payments/checkout/create') as unknown as [string, { method: string; body: string }]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      transactionId,
      processorType: 'stripe',
      returnUrl: 'https://app.example/en-CA/dashboard/dues?payment=returned',
      cancelUrl: `https://app.example/en-CA/dashboard/dues/pay/${transactionId}?payment=cancelled`,
    })
  })

  it('shows the route\'s refusal when member payments are not enabled, and does not go anywhere', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/members/dues')) return { ok: true, status: 200, json: async () => listPage([dueTransaction]) }
      return { ok: false, status: 501, json: async () => ({ code: 'NOT_IMPLEMENTED', message: 'Member dues payment is not enabled in this deployment' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<PaymentCheckoutPage />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(enCA.duesPayPage.cardOptionTitle) }))
    expect(await screen.findByText('Member dues payment is not enabled in this deployment')).toBeInTheDocument()
    expect(window.location.href).toBe('https://app.example/en-CA/dashboard/dues/pay/x')
  })

  it('refuses an answer that carries no checkout address', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith('/api/members/dues')) return { ok: true, status: 200, json: async () => listPage([dueTransaction]) }
      return { ok: true, status: 200, json: async () => envelope({ sessionId: 'cs_1' }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<PaymentCheckoutPage />)
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(enCA.duesPayPage.cardOptionTitle) }))
    expect(await screen.findByText(enCA.duesPayPage.noCheckoutUrlReceived)).toBeInTheDocument()
  })
})

describe('dues receipt page', () => {
  // GET /api/dues/receipt/:id returns { data: <member_dues_ledger row> }, which withApi wraps as { success, data: { data: row } }.
  const entry = {
    id: transactionId,
    userId: 'member-1',
    organizationId: 'org-1',
    transactionType: 'payment',
    transactionDate: '2026-05-01T00:00:00.000Z',
    effectiveDate: '2026-05-01T00:00:00.000Z',
    amount: '25.00',
    balanceBefore: '75.00',
    balanceAfter: '50.00',
    periodStart: null,
    periodEnd: null,
    receiptNumber: 'R-2026-0042',
    paymentMethod: 'cash',
    paymentReference: 'CASH-77',
    description: 'Dues payment',
    status: 'posted',
    createdAt: '2026-05-01T00:00:00.000Z',
  }

  it('shows the ledger entry the route sends, and none of the receipt details it does not have', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => envelope({ data: entry }) }))
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<ReceiptViewerPage />)
    expect(await screen.findByText('R-2026-0042')).toBeInTheDocument()
    expect(screen.getByText('$25.00')).toBeInTheDocument()
    expect(screen.getByText('Dues payment')).toBeInTheDocument()
    expect(screen.getByText('CASH-77')).toBeInTheDocument()
    expect(screen.getByText(enCA.duesReceiptPage.status.posted)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(`/api/dues/receipt/${transactionId}`)
    // The route sends no PDF, no union or member identity, and no official-receipt statement, so the page makes none.
    expect(screen.queryByText(enCA.duesReceiptPage.downloadPdfButton)).not.toBeInTheDocument()
    expect(screen.queryByText(enCA.duesReceiptPage.officialReceiptNote)).not.toBeInTheDocument()
    expect(screen.queryByText(enCA.duesReceiptPage.memberInformationTitle)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: new RegExp(enCA.duesReceiptPage.printButton) })).toBeInTheDocument()
  })

  it('does not print a receipt number or a period the entry does not have', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => envelope({ data: { ...entry, receiptNumber: null, paymentReference: null, paymentMethod: null } }) })))
    renderPage(<ReceiptViewerPage />)
    expect(await screen.findByText('$25.00')).toBeInTheDocument()
    expect(screen.queryByText('R-2026-0042')).not.toBeInTheDocument()
    expect(screen.queryByText(enCA.duesReceiptPage.billingPeriodLabel)).not.toBeInTheDocument()
    expect(screen.getByText(enCA.duesReceiptPage.naLabel)).toBeInTheDocument()
  })

  it('shows the route\'s own message when the entry is not found, with a retry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => failure('NOT_FOUND', 'Dues payment receipt not found') })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => envelope({ data: entry }) })
    vi.stubGlobal('fetch', fetchMock)
    renderPage(<ReceiptViewerPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Dues payment receipt not found')
    fireEvent.click(screen.getByRole('button', { name: enCA.duesReceiptPage.retryButton }))
    expect(await screen.findByText('R-2026-0042')).toBeInTheDocument()
  })

  it('shows an error, not a blank receipt, when the body is not the route envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => entry })))
    renderPage(<ReceiptViewerPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response')
    expect(screen.queryByText('$25.00')).not.toBeInTheDocument()
  })

  it('shows an error when the entry lacks the amount it must have', async () => {
    const { amount: _amount, ...withoutAmount } = entry
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => envelope({ data: withoutAmount }) })))
    renderPage(<ReceiptViewerPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('amount is missing')
  })
})
