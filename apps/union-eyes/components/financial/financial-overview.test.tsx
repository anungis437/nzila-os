// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import FinancialOverview from './FinancialOverview'
import FinancialAiInsights from './FinancialAiInsights'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const stamp = '2026-03-16T12:00:00.000Z'
// withApi wraps what a handler returns as { success, data, timestamp }.
const success = (data: unknown) => ({ success: true, data, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })
const reply = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

// GET /api/admin/dues/overview returns its object as is.
const overview = {
  financialKpis: { totalCollected: 12500, totalOutstanding: 4300, totalOverdue: 900 },
  paymentStats: { pending: 3, paid: 41, overdue: 7, total: 44 },
  recentPayments: [
    { id: 'p1', memberName: 'Alex Tremblay', amount: -25, status: 'posted', paidDate: '2026-03-02T00:00:00.000Z', dueDate: '2026-03-01T00:00:00.000Z' },
    { id: 'p2', memberName: null, amount: 30, status: 'pending', paidDate: null, dueDate: '' },
  ],
  periodStats: { thisMonth: { collected: 600, outstanding: 100, transactionCount: 9 }, lastMonth: { collected: 400, outstanding: 120, transactionCount: 7 } },
}
// GET /api/dues/dashboard
const dashboard = { totalCollected: 8000, pendingRemittances: 1500, inArrears: 900, reconciliationQueue: 4 }
// GET /api/dues/arrears answers { members }.
const arrears = { members: [{ id: 'a1', memberId: 'u1', memberName: null, email: null, phone: null, amountOwed: '120.00', status: 'warning', hasPaymentPlan: false, lastPayment: null, monthsBehind: 2 }] }
// GET /api/finance/summary
const summary = {
  collectionRate: 83,
  totalPaid: 5000,
  totalCharged: 6000,
  uniquePayingMembers: 80,
  totalOrgMembers: 100,
  memberStanding: { total: 100, current: 80, warning: 15, suspended: 5, onPaymentPlan: 3 },
  paymentPlans: { activePlans: 3, totalRemaining: 900, totalRecovered: 200 },
  reconciliation: { reconciled: 10, unreconciled: 2, unreconciledAmount: 300 },
  remittanceTrend: [],
  financialPeriods: [],
  strikeFund: { totalDisbursements: 0, totalDisbursed: 0, craThresholdBreaches: 0, requiresT4a: 0, t4aGenerated: 0 },
  perCapitaTax: { totalPaid: 0, totalPending: 0, entries: [] },
  perCapitaInbound: { isParentOrg: false, childCount: 0, totalDue: 0, totalPaid: 0, totalOverdue: 0, children: [] },
  grievanceCosts: { totalClaims: 4, openClaims: 2, totalLegalCosts: 1000, arbitrations: { total: 0, estimatedCost: 0, actualCost: 0, unionShare: 0 }, settlements: { total: 0, totalSettled: 0, accepted: 0 } },
  pensionHealth: { totalMembers: 10, activeMembers: 9, totalYearsService: 90, contributions: { total: 5, received: 4, pending: 1, totalFunded: 2000, totalPending: 100 } },
  glSnapshot: { assets: 10000, liabilities: 4000, equity: 6000, revenue: 9000, expenses: 3000, netPosition: 6000 },
  budgets: [],
}

type Answers = Partial<Record<'/api/admin/dues/overview' | '/api/dues/dashboard' | '/api/dues/arrears' | '/api/finance/summary', ReturnType<typeof reply>>>
function stubRoutes(answers: Answers) {
  const fetchMock = vi.fn(async (url: string) => {
    const answer = answers[url as keyof Answers]
    if (!answer) throw new Error(`unexpected request ${url}`)
    return answer
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const allAnswer = (): Answers => ({
  '/api/admin/dues/overview': reply(success(overview)),
  '/api/dues/dashboard': reply(success(dashboard)),
  '/api/dues/arrears': reply(success(arrears)),
  '/api/finance/summary': reply(success(summary)),
})

describe('FinancialOverview', () => {
  it('shows what the four routes answered', async () => {
    stubRoutes(allAnswer())
    render(<FinancialOverview />)
    expect(await screen.findByText('$12,500')).toBeInTheDocument()
    expect(screen.getByText('$4,300')).toBeInTheDocument()
    expect(screen.getByText('41 payments posted')).toBeInTheDocument()
    expect(screen.getByText('83%')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    // This month collected 600 against 400 last month, both from the ledger: the KPI trend and the month-over-month row both say so.
    expect(screen.getAllByText('+50%').length).toBeGreaterThan(0)
  })

  it('shows a dash, not $0, for what a failed section feeds, says which section failed and why, and keeps the other sections', async () => {
    stubRoutes({ ...allAnswer(), '/api/admin/dues/overview': reply(failure('INTERNAL_ERROR', 'The ledger could not be read'), 500) })
    render(<FinancialOverview />)
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('Dues overview: The ledger could not be read')
    expect(banner).toHaveTextContent('not zero')
    for (const title of ['Total Collected', 'Outstanding', 'Total Overdue']) {
      const card = screen.getByText(title).closest('div')!.parentElement!.parentElement!
      expect(within(card).getAllByText('—').length).toBeGreaterThan(0)
      expect(card.textContent).not.toMatch(/\$/)
    }
    // The other sections still show their own figures.
    expect(screen.getByText('83%')).toBeInTheDocument()
  })

  it('treats a body that is not the route envelope as a failure of that section', async () => {
    stubRoutes({ ...allAnswer(), '/api/dues/dashboard': reply({ totalCollected: 8000 }) })
    render(<FinancialOverview />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Remittance dashboard: Unexpected API response')
  })

  it('shows the arrears failure in the arrears tab instead of "All Members Current"', async () => {
    stubRoutes({ ...allAnswer(), '/api/dues/arrears': reply(failure('FORBIDDEN', 'You do not hold this financial duty'), 403) })
    render(<FinancialOverview />)
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('tab', { name: /Arrears/ }))
    expect(await screen.findByText(/The members in arrears could not be loaded: You do not hold this financial duty/)).toBeInTheDocument()
    expect(screen.queryByText('All Members Current')).not.toBeInTheDocument()
  })

  it('shows a dash for a member the roster does not name, in the arrears and payment tabs', async () => {
    stubRoutes(allAnswer())
    render(<FinancialOverview />)
    await screen.findByText('$12,500')
    await userEvent.click(screen.getByRole('tab', { name: /Arrears/ }))
    const arrearsRow = (await screen.findByText('$120.00')).closest('tr')!
    expect(within(arrearsRow).getAllByText('—').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('tab', { name: /Recent Payments/ }))
    expect(await screen.findByText('Alex Tremblay')).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('Unknown')
  })

  it('retries every section when the banner\'s retry is pressed', async () => {
    const fetchMock = stubRoutes({ ...allAnswer(), '/api/finance/summary': reply(failure('INTERNAL_ERROR', 'Failed to read the summary'), 500) })
    render(<FinancialOverview />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(8))
  })
})

describe('FinancialAiInsights', () => {
  const report = {
    available: true,
    data: { analysisType: 'comprehensive', timeframe: '90d', title: 'Financial comprehensive report', executiveSummary: 'Collections are steady.', insights: [], risks: [], recommendations: [], dataSourcesUsed: [] },
    confidence: 0.7,
    explanation: 'x',
    modelVersion: 'm-1',
    disclaimer: 'Advisory only.',
    auditRef: 'ai-1',
  }

  it('shows the analysis the route sent inside the envelope', async () => {
    const fetchMock = vi.fn(async () => reply(success(report)))
    vi.stubGlobal('fetch', fetchMock)
    render(<FinancialAiInsights />)
    fireEvent.click(screen.getByRole('button', { name: /Generate Financial Analysis/ }))
    expect(await screen.findByText('Collections are steady.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/ai/finance/analysis?type=comprehensive&timeframe=90d')
  })

  it('states why the AI feature refused, using the guard\'s own reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply({ available: false, reason: "AI feature 'financial_analysis' is not enabled for this organization.", fallbackAdvice: 'Contact your administrator to enable this capability.' }, 403)))
    render(<FinancialAiInsights />)
    fireEvent.click(screen.getByRole('button', { name: /Generate Financial Analysis/ }))
    expect(await screen.findByText(/is not enabled for this organization\. Contact your administrator/)).toBeInTheDocument()
  })

  it('states the standard error message for any other refusal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(failure('FORBIDDEN', 'A financial mandate is required'), 403)))
    render(<FinancialAiInsights />)
    fireEvent.click(screen.getByRole('button', { name: /Generate Financial Analysis/ }))
    expect(await screen.findByText('A financial mandate is required')).toBeInTheDocument()
  })

  it('refuses a body that is not an analysis instead of rendering an empty report', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => reply(success({ available: true, data: { title: 'x' }, confidence: 0.5 }))))
    render(<FinancialAiInsights />)
    fireEvent.click(screen.getByRole('button', { name: /Generate Financial Analysis/ }))
    expect(await screen.findByText(/Unexpected API response/)).toBeInTheDocument()
  })
})
