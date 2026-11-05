// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const m = vi.hoisted(() => ({
  role: 'clc_staff' as string,
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`)
  }),
  listAffiliates: vi.fn(),
  loadRemittanceFacts: vi.fn(),
  loadAffiliateStandings: vi.fn(),
  loadRemittanceMetrics: vi.fn(),
  systemResults: [] as unknown[],
  systemFails: false,
}))

vi.mock('@/lib/api-auth-guard', () => ({ requireUser: vi.fn(async () => ({ userId: 'user-1', organizationId: 'clc-org' })) }))
vi.mock('next/navigation', () => ({ redirect: m.redirect }))
vi.mock('next-intl/server', () => ({
  getLocale: vi.fn(async () => 'en-CA'),
  getTranslations: vi.fn(async () => (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key),
}))
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: vi.fn(async () => m.role) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/organizations/affiliates', () => ({ listAffiliates: m.listAffiliates }))
vi.mock('@/lib/organizations/per-capita-standing', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/organizations/per-capita-standing')>()),
  loadRemittanceFacts: m.loadRemittanceFacts,
  loadAffiliateStandings: m.loadAffiliateStandings,
  loadRemittanceMetrics: m.loadRemittanceMetrics,
}))
// Each query of the staff page awaits one result, in order: failed syncs, last sync, pending approvals, overdue, recent activity.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(),
  withSystemContext: async (run: (tx: unknown) => Promise<unknown>) => {
    if (m.systemFails) throw new Error('system connection refused')
    const queue = [...m.systemResults]
    const chain = (): unknown => {
      const result = queue.shift()
      const link: Record<string, unknown> = {}
      for (const method of ['from', 'where', 'orderBy', 'limit']) link[method] = () => link
      link.then = (resolve: (value: unknown) => void) => resolve(result)
      return link
    }
    return run({ select: chain })
  },
}))
vi.mock('@/components/admin/clc-approval-workflow', () => ({ CLCApprovalWorkflow: () => <div data-testid="approval-workflow" /> }))
vi.mock('@/components/admin/clc-analytics-dashboard', () => ({ default: () => <div data-testid="clc-analytics-dashboard" /> }))
vi.mock('@/components/admin/clc-remittances-dashboard', () => ({ ClcRemittancesDashboard: () => <div data-testid="clc-remittances-dashboard" /> }))

import CLCDashboardPage from '../page'
import CLCAffiliatesPage from '../affiliates/page'
import CLCCompliancePage from '../compliance/page'
import CLCStaffDashboardPage from '../staff/page'

const fact = (overrides: Record<string, unknown> = {}) => ({
  fromOrganizationId: 'aff-a',
  remittanceYear: 2026,
  remittanceMonth: 4,
  status: 'paid',
  remittableMembers: 100,
  totalAmount: '1000.00',
  submittedAt: '2026-04-10',
  overdue: false,
  fellDueInLastYear: true,
  submittedOnTime: true,
  inCurrentYear: true,
  ...overrides,
})

const affiliate = (overrides: Record<string, unknown> = {}) => ({
  id: 'aff-a',
  name: 'Affiliate A',
  organizationType: 'union',
  provinceTerritory: 'ON',
  clcAffiliateCode: 'A-1',
  email: null,
  phone: null,
  address: null,
  description: null,
  status: 'active',
  memberCount: 100,
  ...overrides,
})

const adminLinksToMissingPages = (container: HTMLElement) =>
  [...container.querySelectorAll('a')]
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => /^\/dashboard\/admin\/(clc-|settings)/.test(href))

beforeEach(() => {
  m.role = 'clc_staff'
  m.systemFails = false
  m.systemResults = []
  m.redirect.mockClear()
  m.listAffiliates.mockReset()
  m.loadRemittanceFacts.mockReset()
  m.loadAffiliateStandings.mockReset()
  m.loadRemittanceMetrics.mockReset()
})
afterEach(() => cleanup())

describe('CLC staff dashboard', () => {
  it('shows the counts the system reads returned and the real sync history, with the row fields the table has', async () => {
    m.systemResults = [
      [{ count: 2 }],
      [{ syncedAt: '2026-05-30T10:00:00.000Z' }],
      [{ count: 5 }],
      [{ count: 3 }],
      [
        { id: 's-1', affiliateCode: 'AFF-0001', action: 'failed', syncedAt: '2026-05-30T10:00:00.000Z', error: 'Upstream refused the request' },
        { id: 's-2', affiliateCode: 'AFF-0002', action: 'updated', syncedAt: '2026-05-29T10:00:00.000Z', error: null },
      ],
    ]
    const { container } = render(await CLCStaffDashboardPage())

    const card = (title: string) => screen.getByText(title).closest('[class*="rounded"]') as HTMLElement
    expect(within(card('Failed Syncs (24h)')).getByText('2')).toBeInTheDocument()
    expect(within(card('Pending Approvals')).getByText('5')).toBeInTheDocument()
    expect(within(card('Overdue Remittances')).getByText('3')).toBeInTheDocument()
    expect(screen.getByText('AFF-0001')).toBeInTheDocument()
    expect(screen.getByText('Upstream refused the request')).toBeInTheDocument()
    expect(screen.getByText('failed')).toBeInTheDocument()
    expect(screen.getByText('updated')).toBeInTheDocument()
    // The count of syncs "pending" was a literal 0: no queue exists to count.
    expect(screen.queryByText('Pending Syncs')).not.toBeInTheDocument()
    expect(screen.getByTestId('approval-workflow')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(adminLinksToMissingPages(container)).toEqual([])
  })

  it('offers no sync, import or settings control that does nothing or leads nowhere', async () => {
    m.systemResults = [[{ count: 0 }], [], [{ count: 0 }], [{ count: 0 }], []]
    const { container } = render(await CLCStaffDashboardPage())
    expect(screen.queryByRole('button', { name: /Sync Now/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Bulk Import/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Automated daily sync/)).not.toBeInTheDocument()
    expect(adminLinksToMissingPages(container)).toEqual([])
    expect(container.querySelector('a[href="/dashboard/admin/organizations"]')).not.toBeNull()
  })

  it('shows dashes and says so when the figures could not be read, instead of zero failures and nothing awaiting review', async () => {
    m.systemFails = true
    render(await CLCStaffDashboardPage())
    expect(screen.getByRole('alert')).toHaveTextContent('could not be read')
    const card = (title: string) => screen.getByText(title).closest('[class*="rounded"]') as HTMLElement
    expect(within(card('Failed Syncs (24h)')).getByText('—')).toBeInTheDocument()
    expect(within(card('Pending Approvals')).getByText('—')).toBeInTheDocument()
    expect(within(card('Overdue Remittances')).getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.queryByText('All on track')).not.toBeInTheDocument()
  })

  it('sends a caller without a CLC role away', async () => {
    m.role = 'member'
    await expect(CLCStaffDashboardPage()).rejects.toThrow('NEXT_REDIRECT /dashboard')
  })
})

describe('CLC compliance page', () => {
  const affiliates = [
    affiliate({ id: 'aff-a', name: 'Affiliate A', provinceTerritory: 'ON' }),
    affiliate({ id: 'aff-b', name: 'Affiliate B', provinceTerritory: 'ON' }),
    affiliate({ id: 'aff-c', name: 'Affiliate C', provinceTerritory: 'QC', organizationType: 'federation' }),
  ]
  const facts = [
    fact({ fromOrganizationId: 'aff-a' }),
    fact({ fromOrganizationId: 'aff-b', status: 'pending', totalAmount: '500.00', submittedAt: null, overdue: true, submittedOnTime: false }),
  ]

  it('derives the position from the remittances and affiliates, and says what an affiliate with nothing on file is', async () => {
    m.listAffiliates.mockResolvedValue(affiliates)
    m.loadRemittanceFacts.mockResolvedValue(facts)
    const { container } = render(await CLCCompliancePage())

    // One affiliate compliant, one non-compliant (overdue), one at risk (nothing on file).
    const stat = (label: string) => screen.getByText(label).previousElementSibling as HTMLElement
    expect(stat('Compliant')).toHaveTextContent('1')
    expect(stat('At Risk')).toHaveTextContent('1')
    expect(stat('Non-Compliant')).toHaveTextContent('1')
    expect(stat('Total Affiliates')).toHaveTextContent('3')
    // One of the two remittances that fell due was on time.
    expect(screen.getByText('50%', { selector: 'div.text-4xl' })).toBeInTheDocument()
    expect(screen.getByText(/\$1,500\.00/)).toBeInTheDocument()
    expect(screen.getByText(/\$1,000\.00 received/)).toBeInTheDocument()
    expect(screen.getByText('66.7%')).toBeInTheDocument()

    expect(screen.getByText('1 overdue remittance')).toBeInTheDocument()
    expect(screen.getByText('No remittance on file')).toBeInTheDocument()
    expect(screen.getByText('ON')).toBeInTheDocument()
    expect(screen.getByText('1/2 compliant')).toBeInTheDocument()
    expect(screen.getByText('0/1 compliant')).toBeInTheDocument()

    expect(screen.queryByText(/30-day average/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export|Follow Up|Generate Report/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(adminLinksToMissingPages(container)).toEqual([])
  })

  it('shows a dash, not 0%, when no remittance fell due', async () => {
    m.listAffiliates.mockResolvedValue([])
    m.loadRemittanceFacts.mockResolvedValue([])
    render(await CLCCompliancePage())
    expect(screen.getByText('—', { selector: 'div.text-4xl' })).toBeInTheDocument()
    expect(screen.getByText(/No remittance fell due in the last twelve months/)).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('does not print a position when the remittances cannot be read', async () => {
    m.listAffiliates.mockResolvedValue(affiliates)
    m.loadRemittanceFacts.mockRejectedValue(new Error('remittance read failed'))
    await expect(CLCCompliancePage()).rejects.toThrow('remittance read failed')
  })
})

describe('CLC affiliates page', () => {
  beforeEach(() => {
    m.listAffiliates.mockResolvedValue([
      affiliate({ id: 'aff-a', name: 'Union Alpha', organizationType: 'union' }),
      affiliate({ id: 'aff-f', name: 'Federation Beta', organizationType: 'federation', provinceTerritory: 'QC' }),
      affiliate({ id: 'aff-l', name: 'Local Gamma', organizationType: 'local' }),
    ])
    m.loadAffiliateStandings.mockResolvedValue(
      new Map([['aff-a', { remittanceStatus: 'unheard-of', complianceStatus: 'compliant', lastRemittanceDate: null }]]),
    )
  })

  // Issue #1116: administering the congress does not show an affiliate's membership; the count is null and reads as not available.
  it('shows N/A, not zero, for an affiliate whose member count the caller may not see', async () => {
    m.listAffiliates.mockResolvedValue([affiliate({ id: 'aff-a', name: 'Union Alpha', organizationType: 'union', provinceTerritory: null, memberCount: null })])
    const { container } = render(await CLCAffiliatesPage())
    expect(screen.getByText('Union Alpha')).toBeInTheDocument()
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(1)
    expect(container.textContent).not.toMatch(/\b0 members/)
  })

  it('lists each tab\'s own affiliates instead of a placeholder sentence', async () => {
    const user = userEvent.setup()
    render(await CLCAffiliatesPage())
    await user.click(screen.getByRole('tab', { name: /Direct-Chartered/ }))
    expect(screen.getByText('Union Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Local Gamma')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Locals & Chapters/ }))
    expect(screen.getByText('Local Gamma')).toBeInTheDocument()
    expect(screen.queryByText(/Filtered view showing only/)).not.toBeInTheDocument()
  })

  it('shows a status it does not know as it is stored, never as "Current"', async () => {
    render(await CLCAffiliatesPage())
    expect(screen.getByText('unheard-of')).toBeInTheDocument()
    const row = screen.getByText('Union Alpha').closest('tr') as HTMLElement
    expect(within(row).queryByText('Current')).not.toBeInTheDocument()
  })

  it('has no search, filter, export or bulk control that does nothing, and no link to a remittance page that does not exist', async () => {
    const { container } = render(await CLCAffiliatesPage())
    expect(screen.queryByPlaceholderText(/Search/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Export|Send Reminders|Download Data/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Bulk Actions')).not.toBeInTheDocument()
    expect(adminLinksToMissingPages(container)).toEqual([])
  })
})

describe('CLC executive dashboard', () => {
  it('does not link to an analytics page that does not exist', async () => {
    m.listAffiliates.mockResolvedValue([affiliate()])
    m.loadRemittanceMetrics.mockResolvedValue({ totalMembers: 100, pendingRemittances: 1, overdueRemittances: 0, complianceRate: null, totalRevenue: 0 })
    const { container } = render(await CLCDashboardPage())
    expect(adminLinksToMissingPages(container)).toEqual([])
    expect(screen.getByText('—', { selector: 'div.text-2xl' })).toBeInTheDocument()
  })
})
