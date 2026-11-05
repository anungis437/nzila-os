// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'

import PensionAdminConsole from './pension-admin-console'
import PensionMemberConsole from './pension-member-console'

const stamp = '2026-05-31T12:00:00.000Z'
// withApi wraps what a handler returns as { success, data, timestamp }: the pension list routes return their rows, so they arrive at data.
const list = (rows: unknown[]) => ({ success: true, data: rows, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })

// pension_plans as GET /api/pension/plans answers an administrator (the row plus the counted enrolments), numeric columns as strings.
const adminPlan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-a',
  organizationId: 'org-1',
  planName: 'Staff Plan',
  planType: 'defined_benefit',
  status: 'active',
  activeMembers: 12,
  totalAssets: '250000.00',
  fundingStatus: '96.50',
  description: null,
  metadata: {},
  createdAt: stamp,
  updatedAt: stamp,
  ...overrides,
})
// memberSafePlan: what a member receives.
const memberPlan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-b',
  planName: 'Trades Plan',
  planType: 'defined_contribution',
  status: 'active',
  description: 'Contribution-based plan',
  ...overrides,
})
const pensionMember = (overrides: Record<string, unknown> = {}) => ({
  id: 'enrol-1',
  organizationId: 'org-1',
  planId: 'plan-b',
  userId: 'orgmember-1',
  name: 'Alex Tremblay',
  planName: 'Trades Plan',
  enrollmentDate: '2019-03-01T00:00:00.000Z',
  membershipStatus: 'active',
  yearsOfService: '12.5',
  vestingStatus: 'fully_vested',
  metadata: {},
  createdAt: stamp,
  updatedAt: stamp,
  ...overrides,
})
const contribution = (overrides: Record<string, unknown> = {}) => ({
  id: 'c-1',
  organizationId: 'org-1',
  memberId: 'enrol-1',
  memberName: 'Alex Tremblay',
  period: '2026-04',
  amount: '125.50',
  paymentStatus: 'received',
  paymentDate: '2026-04-30T00:00:00.000Z',
  metadata: {},
  createdAt: stamp,
  updatedAt: stamp,
  ...overrides,
})
const claim = (overrides: Record<string, unknown> = {}) => ({
  id: 'cl-1',
  organizationId: 'org-1',
  memberId: 'enrol-1',
  memberName: 'Alex Tremblay',
  claimType: 'retirement',
  status: 'pending',
  amount: '900.00',
  submittedDate: '2026-05-01T00:00:00.000Z',
  processedDate: null,
  notes: null,
  metadata: {},
  createdAt: stamp,
  updatedAt: stamp,
  ...overrides,
})
const t4a = (overrides: Record<string, unknown> = {}) => ({
  id: 't-1',
  organizationId: 'org-1',
  memberId: 'enrol-1',
  memberName: 'Alex Tremblay',
  taxYear: 2025,
  pensionIncome: '10800.00',
  status: 'filed',
  generatedDate: '2026-02-15T00:00:00.000Z',
  metadata: {},
  createdAt: stamp,
  updatedAt: stamp,
  ...overrides,
})

type Reply = { status?: number; body: unknown }
type Router = (url: URL) => Reply | undefined

function stubFetch(router: Router) {
  const fetchMock = vi.fn(async (input: string) => {
    const url = new URL(input, 'http://localhost')
    const reply = router(url)
    if (!reply) throw new Error(`unexpected request ${url.pathname}${url.search}`)
    const status = reply.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => reply.body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const wrap = (node: React.ReactNode) => (
  <NextIntlClientProvider locale="en-CA" messages={enCA}>
    {node}
  </NextIntlClientProvider>
)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('pension administration console', () => {
  const adminRouter = (overrides: Record<string, Reply> = {}): Router => (url) => {
    const defaults: Record<string, Reply> = {
      '/api/pension/plans': { body: list([adminPlan(), adminPlan({ id: 'plan-c', planName: 'Retiree Plan', activeMembers: 5, totalAssets: '100000.50' })]) },
      '/api/pension/contributions': { body: list([contribution()]) },
      '/api/pension/benefits': { body: list([claim(), claim({ id: 'cl-2', status: 'under_review' }), claim({ id: 'cl-3', status: 'approved' })]) },
      '/api/pension/members': { body: list([pensionMember({ planId: 'plan-a' }), pensionMember({ id: 'enrol-2', planId: 'plan-c', name: 'Sam Roy' })]) },
      '/api/pension/t4a': { body: list([t4a()]) },
    }
    return overrides[url.pathname] ?? defaults[url.pathname]
  }

  it('adds the numeric strings the plans route sends as numbers, not as text', async () => {
    stubFetch(adminRouter())
    render(wrap(<PensionAdminConsole />))
    const card = async (title: string) => (await screen.findByText(title)).closest('[class*="rounded"]') as HTMLElement
    // 250000.00 + 100000.50: string concatenation made this "0250000.00100000.50".
    expect(within(await card('Recorded Total Assets')).getByText(/\$350,000\.50/)).toBeInTheDocument()
    expect(within(await card('Total Members')).getByText('17')).toBeInTheDocument()
    expect(within(await card('Pending Claims')).getByText('2')).toBeInTheDocument()
    expect(within(await card('Pending Claims')).getByText('3 total claims')).toBeInTheDocument()
  })

  it('shows a dash, not zero, for the administrator figures a response does not carry', async () => {
    stubFetch(adminRouter({ '/api/pension/plans': { body: list([{ id: 'plan-b', planName: 'Trades Plan', planType: 'defined_contribution', status: 'active', description: null }]) } }))
    render(wrap(<PensionAdminConsole />))
    const card = async (title: string) => (await screen.findByText(title)).closest('[class*="rounded"]') as HTMLElement
    expect(within(await card('Total Members')).getByText('—')).toBeInTheDocument()
    expect(within(await card('Recorded Total Assets')).getByText('—')).toBeInTheDocument()
  })

  it('lists every enrolment of the organization, not the first plan\'s only, and reads every page', async () => {
    const page = (n: number) => Array.from({ length: 200 }, (_, i) => pensionMember({ id: `enrol-${n}-${i}`, name: `Member ${n}-${i}` }))
    const fetchMock = stubFetch((url) => {
      if (url.pathname === '/api/pension/members') {
        return { body: list(url.searchParams.get('offset') === '0' ? page(1) : [pensionMember({ id: 'enrol-last', name: 'Last Member' })]) }
      }
      return adminRouter()(url)
    })
    const user = userEvent.setup()
    render(wrap(<PensionAdminConsole />))
    await user.click(await screen.findByRole('tab', { name: 'Members' }))
    expect(await screen.findByText('Last Member')).toBeInTheDocument()
    const memberCalls = fetchMock.mock.calls.map(([input]) => new URL(input, 'http://localhost')).filter((url) => url.pathname === '/api/pension/members')
    expect(memberCalls.map((url) => url.searchParams.get('offset'))).toEqual(['0', '200'])
    for (const url of memberCalls) expect(url.searchParams.has('planId')).toBe(false)
  })

  it('reports a section that failed with the route\'s reason and retries it, while the others show', async () => {
    let reads = 0
    stubFetch((url) => {
      if (url.pathname === '/api/pension/contributions') {
        reads += 1
        return reads === 1 ? { status: 403, body: failure('FORBIDDEN', 'Pension records are limited to administrators') } : { body: list([contribution()]) }
      }
      return adminRouter()(url)
    })
    const user = userEvent.setup()
    render(wrap(<PensionAdminConsole />))
    await user.click(await screen.findByRole('tab', { name: 'Contributions' }))
    expect(await screen.findByText('Pension records are limited to administrators')).toBeInTheDocument()
    expect(screen.queryByText('No contributions found.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText(/Period: 2026-04/)).toBeInTheDocument()
  })

  it('offers no control that does nothing, and says what is not available', async () => {
    stubFetch(adminRouter())
    const user = userEvent.setup()
    render(wrap(<PensionAdminConsole />))
    await screen.findByText('Staff Plan')
    expect(screen.queryByRole('button', { name: /Add New Plan|Settings|Edit|View Details|Export/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Claims' }))
    expect(screen.getByText('UE-FIN-PENSION-TRUSTEE-ADMIN')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Approve|Deny|Review|Request Documents/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Reports' }))
    expect(screen.getByText('UE-FIN-PENSION-REPORTS')).toBeInTheDocument()
    expect(screen.getByText(/Tax Year 2025/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Generate T4A|Download|Annual Pension Statement/ })).not.toBeInTheDocument()
  })
})

describe('pension member console', () => {
  const memberRouter = (overrides: Record<string, Reply> = {}): Router => (url) => {
    const defaults: Record<string, Reply> = {
      '/api/pension/plans': { body: list([memberPlan({ id: 'plan-a', planName: 'Staff Plan', planType: 'defined_benefit' }), memberPlan()]) },
      '/api/pension/members': { body: list([pensionMember()]) },
      '/api/pension/contributions': { body: list([contribution(), contribution({ id: 'c-2', period: '2026-03', amount: '100.00' })]) },
      '/api/pension/t4a': { body: list([t4a()]) },
      '/api/documents/repository': { body: { success: true, data: [{ id: 'doc-1', title: 'Annual statement', name: null, filename: 'statement.pdf', documentType: 'pension', privacyLabel: null, createdAt: stamp, updatedAt: stamp }], meta: { page: 1, pageSize: 50, nextOffset: 50 }, timestamp: stamp } },
    }
    return overrides[url.pathname] ?? defaults[url.pathname]
  }

  it('shows the member\'s own enrolment in the plan it names, not the first plan listed, with real figures', async () => {
    stubFetch(memberRouter())
    render(wrap(<PensionMemberConsole />))
    expect((await screen.findAllByText('Trades Plan')).length).toBeGreaterThan(0)
    // Plan b is the second plan the route lists: the page used to ask for the first plan's members and find none.
    // The enrolment and the contributions are separate reads that land after the plans, so each is awaited.
    expect(await screen.findByText('12.5')).toBeInTheDocument()
    expect(await screen.findByText('fully vested')).toBeInTheDocument()
    expect(await screen.findByText('defined contribution')).toBeInTheDocument()
    expect(await screen.findByText(/\$225\.50/)).toBeInTheDocument()
    // Nothing is shown for the figures a member's plans route does not send: no zero assets, zero funding, zero members.
    expect(screen.queryByText('Fund Health')).not.toBeInTheDocument()
    expect(screen.queryByText(/Total Plan Assets|Funding Status/)).not.toBeInTheDocument()
  })

  it('states no retirement age, accrual or vesting rule of its own, and no benefit estimate', async () => {
    const user = userEvent.setup()
    stubFetch(memberRouter())
    render(wrap(<PensionMemberConsole />))
    await screen.findAllByText('Trades Plan')
    expect(screen.queryByText(/Normal Retirement Age|Early Retirement Age/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Benefit Estimate' }))
    expect(screen.getByText('UE-FIN-PENSION-BENEFIT-ESTIMATE')).toBeInTheDocument()
    expect(screen.queryByText(/Estimated Monthly Benefit|Annual Pension/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Request Detailed Benefit Statement/ })).not.toBeInTheDocument()
  })

  it('says a member with no enrolment is not enrolled, without a button that does nothing', async () => {
    stubFetch(memberRouter({ '/api/pension/members': { body: list([]) } }))
    render(wrap(<PensionMemberConsole />))
    expect(await screen.findByText('No Pension Plan Enrollment')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Contact Union Office/ })).not.toBeInTheDocument()
  })

  it('does not call an administrator\'s view of every enrolment "my pension"', async () => {
    stubFetch(memberRouter({ '/api/pension/plans': { body: list([adminPlan()]) }, '/api/pension/members': { body: list([pensionMember(), pensionMember({ id: 'enrol-2', name: 'Sam Roy' })]) } }))
    render(wrap(<PensionMemberConsole />))
    expect(await screen.findByRole('link', { name: 'Open Pension Administration' })).toHaveAttribute('href', '/en-CA/dashboard/pension/admin')
    expect(screen.queryByText('Alex Tremblay')).not.toBeInTheDocument()
  })

  it('shows the route\'s reason when the enrolment cannot be read, with a retry', async () => {
    let reads = 0
    stubFetch((url) => {
      if (url.pathname === '/api/pension/members') {
        reads += 1
        return reads === 1 ? { status: 500, body: failure('INTERNAL_ERROR', 'The pension record store is down') } : { body: list([pensionMember()]) }
      }
      return memberRouter()(url)
    })
    const user = userEvent.setup()
    render(wrap(<PensionMemberConsole />))
    expect(await screen.findByText('The pension record store is down')).toBeInTheDocument()
    expect(screen.queryByText('No Pension Plan Enrollment')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect((await screen.findAllByText('Trades Plan')).length).toBeGreaterThan(0)
  })

  it('reports contributions that could not be read instead of an empty history, and lists documents with their download link', async () => {
    const user = userEvent.setup()
    stubFetch(memberRouter({ '/api/pension/contributions': { status: 500, body: failure('INTERNAL_ERROR', 'Contribution history is unavailable') } }))
    render(wrap(<PensionMemberConsole />))
    await screen.findAllByText('Trades Plan')
    await user.click(screen.getByRole('tab', { name: 'Contributions' }))
    expect(await screen.findByText('Contribution history is unavailable')).toBeInTheDocument()
    expect(screen.queryByText(/No contribution history available/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Documents' }))
    const link = await screen.findByRole('link', { name: /Annual statement/ })
    expect(link).toHaveAttribute('href', '/api/documents/doc-1/download')
    await waitFor(() => expect(screen.getByText(/T4A — 2025/)).toBeInTheDocument())
  })
})
