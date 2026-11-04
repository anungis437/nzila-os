// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

vi.mock('next/navigation', () => ({ useParams: () => ({ locale: 'en-CA' }) }))

import { OrganizingConsole } from './organizing-console'
import { CampaignDetailConsole } from './campaign-detail-console'

const stamp = '2026-05-31T12:00:00.000Z'
const success = (data: unknown) => ({ success: true, data, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })

// GET /api/organizing/campaigns: the crud factory's list, { data: rows, pagination } inside the withApi body.
const listBody = (rows: unknown[], page = 1, totalPages = 1) =>
  success({ data: rows, pagination: { page, limit: 100, total: rows.length, totalPages } })

const memberIds = ['8d1c7a40-1b2e-4c53-9a6d-2e3f4a5b6c01', '8d1c7a40-1b2e-4c53-9a6d-2e3f4a5b6c02', '8d1c7a40-1b2e-4c53-9a6d-2e3f4a5b6c03']

// One organizing_campaigns row as the table's own columns (Drizzle, serialised): dates are 'YYYY-MM-DD', counts are integers, progress is a decimal string.
const dispatchDrive = (overrides: Record<string, unknown> = {}) => ({
  id: '5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a01',
  organizationId: '0c9d6a1e-5f2b-4b7c-8d3e-1a2b3c4d5e6f',
  campaignName: 'Harbourfront Dispatch Drive',
  campaignCode: 'ORG-2026-004',
  targetEmployer: 'Harbourfront Logistics Ltd.',
  workplaceLocation: '210 Quay Street, Halifax NS',
  industry: 'Logistics',
  campaignType: 'card_check',
  status: 'active',
  priority: 'high',
  estimatedUnitSize: 200,
  targetCardCount: 120,
  cardsSigned: 90,
  cardSigningProgress: '45.00',
  leadOrganizerId: 'user_2abcdef',
  organizingTeam: memberIds,
  campaignStartDate: '2020-01-15',
  targetCardDeadline: '2099-01-01',
  filingDate: null,
  electionDate: null,
  certificationDate: null,
  campaignEndDate: null,
  organizingStrategy: 'Start with the night-shift dispatchers.',
  keyIssues: ['Scheduling', 'Safety'],
  employerVulnerabilities: null,
  unionAdvantages: null,
  contactsIdentified: 80,
  contactsCommitted: 40,
  houseVisitsCompleted: 12,
  workplaceMeetingsHeld: 3,
  electionEligibleVoters: null,
  votesForUnion: null,
  votesAgainstUnion: null,
  challengedBallots: null,
  electionResult: null,
  createdAt: '2026-01-10T15:00:00.000Z',
  updatedAt: '2026-05-20T15:00:00.000Z',
  createdBy: 'user_2abcdef',
  updatedBy: 'user_2abcdef',
  archivedAt: null,
  ...overrides,
})

// A campaign that has only what the table requires: every nullable column is null.
const bareDrive = (overrides: Record<string, unknown> = {}) =>
  dispatchDrive({
    id: '5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a02',
    campaignName: 'Mill Road Warehouse Drive',
    campaignCode: 'ORG-2026-009',
    targetEmployer: 'Mill Road Distribution Inc.',
    workplaceLocation: '14 Mill Road, Moncton NB',
    industry: null,
    campaignType: 'voluntary_recognition',
    status: 'planning',
    priority: null,
    estimatedUnitSize: 50,
    targetCardCount: null,
    cardsSigned: null,
    cardSigningProgress: null,
    leadOrganizerId: null,
    organizingTeam: null,
    campaignStartDate: null,
    targetCardDeadline: null,
    organizingStrategy: null,
    keyIssues: null,
    contactsIdentified: null,
    contactsCommitted: null,
    houseVisitsCompleted: null,
    workplaceMeetingsHeld: null,
    ...overrides,
  })

type Reply = { status?: number; body: unknown } | 'network'
function stubFetch(router: (url: URL) => Reply) {
  const fetchMock = vi.fn(async (input: string) => {
    const reply = router(new URL(input, 'http://localhost'))
    if (reply === 'network') throw new TypeError('Failed to fetch')
    const status = reply.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => reply.body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const dayText = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
const statValue = (label: string) => screen.getByText(label).nextElementSibling
// The outreach cards put the figure above its label.
const metricValue = (label: string) => screen.getByText(label).previousElementSibling

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('organizing console', () => {
  it('lists the campaigns the table stores, reading its own columns and computing the signing share from the two counts', async () => {
    stubFetch(() => ({ body: listBody([dispatchDrive(), bareDrive()]) }))
    render(<OrganizingConsole />)

    const drive = (await screen.findByText('Harbourfront Dispatch Drive')).closest('.border-2') as HTMLElement
    expect(within(drive).getByText('Harbourfront Logistics Ltd.')).toBeInTheDocument()
    expect(within(drive).getByText('210 Quay Street, Halifax NS')).toBeInTheDocument()
    expect(within(drive).getByText('ORG-2026-004')).toBeInTheDocument()
    expect(within(drive).getByText('200 estimated workers')).toBeInTheDocument()
    expect(within(drive).getByText('90 / 200 (45.0%)')).toBeInTheDocument()
    expect(within(drive).getByText('Target: 120 cards')).toBeInTheDocument()
    expect(within(drive).getByText('3 members')).toBeInTheDocument()
    expect(within(drive).getByText(dayText('2020-01-15'))).toBeInTheDocument()
    expect(within(drive).getByText(dayText('2099-01-01'))).toBeInTheDocument()
    expect(within(drive).getByText('Card Check')).toBeInTheDocument()

    expect(statValue('Total Campaigns')).toHaveTextContent('2')
    expect(statValue('Active Campaigns')).toHaveTextContent('1')
    expect(statValue('Certified')).toHaveTextContent('0')
    expect(statValue('Estimated Workers')).toHaveTextContent('250')
  })

  it('shows a column the row does not hold as a dash or "Not set", never a zero', async () => {
    stubFetch(() => ({ body: listBody([bareDrive()]) }))
    render(<OrganizingConsole />)

    const drive = (await screen.findByText('Mill Road Warehouse Drive')).closest('.border-2') as HTMLElement
    expect(within(drive).getByText('— / 50 (—)')).toBeInTheDocument()
    expect(within(drive).getByText('—', { selector: 'p' })).toBeInTheDocument()
    expect(within(drive).getAllByText('Not set')).toHaveLength(2)
    expect(within(drive).queryByText(/Target:/)).not.toBeInTheDocument()
    expect(within(drive).queryByText(/0%/)).not.toBeInTheDocument()
  })

  it('searches by name, employer and code and filters by the statuses the campaigns hold', async () => {
    stubFetch(() => ({ body: listBody([dispatchDrive(), bareDrive()]) }))
    const user = userEvent.setup()
    render(<OrganizingConsole />)
    await screen.findByText('Harbourfront Dispatch Drive')

    const search = screen.getByPlaceholderText('Search campaigns by name, employer, or code...')
    await user.type(search, 'mill road distribution')
    expect(screen.queryByText('Harbourfront Dispatch Drive')).not.toBeInTheDocument()
    expect(screen.getByText('Mill Road Warehouse Drive')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'ORG-2026-004')
    expect(screen.getByText('Harbourfront Dispatch Drive')).toBeInTheDocument()
    expect(screen.queryByText('Mill Road Warehouse Drive')).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'nothing matches this')
    expect(screen.getByText('No Campaigns Found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument()
    await user.clear(search)

    // Only the statuses present are offered: nothing here is won, lost or in card check.
    expect(screen.getByRole('button', { name: 'Planning' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Won' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lost' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Planning' }))
    expect(screen.queryByText('Harbourfront Dispatch Drive')).not.toBeInTheDocument()
    expect(screen.getByText('Mill Road Warehouse Drive')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('Harbourfront Dispatch Drive')).toBeInTheDocument()
  })

  it('counts a campaign with a certification date as certified', async () => {
    stubFetch(() => ({ body: listBody([dispatchDrive({ status: 'won', certificationDate: '2026-04-02', electionResult: 'certified' }), bareDrive()]) }))
    render(<OrganizingConsole />)
    await screen.findByText('Harbourfront Dispatch Drive')
    expect(statValue('Certified')).toHaveTextContent('1')
    expect(statValue('Active Campaigns')).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: 'Won' })).toBeInTheDocument()
  })

  it('reads every page of the list', async () => {
    const fetchMock = stubFetch((url) =>
      url.searchParams.get('page') === '2'
        ? { body: listBody([bareDrive()], 2, 2) }
        : { body: listBody([dispatchDrive()], 1, 2) },
    )
    render(<OrganizingConsole />)
    expect(await screen.findByText('Harbourfront Dispatch Drive')).toBeInTheDocument()
    expect(screen.getByText('Mill Road Warehouse Drive')).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/organizing/campaigns?limit=100&page=1',
      '/api/organizing/campaigns?limit=100&page=2',
    ])
    expect(statValue('Total Campaigns')).toHaveTextContent('2')
  })

  it('links each campaign to its own page under the locale', async () => {
    stubFetch(() => ({ body: listBody([dispatchDrive()]) }))
    render(<OrganizingConsole />)
    const link = await screen.findByRole('link', { name: /View Campaign/ })
    expect(link).toHaveAttribute('href', '/en-CA/dashboard/organizing/5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a01')
  })

  it('offers no control that does nothing', async () => {
    stubFetch(() => ({ body: listBody([dispatchDrive()]) }))
    render(<OrganizingConsole />)
    await screen.findByText('Harbourfront Dispatch Drive')
    expect(screen.queryByRole('button', { name: /New Campaign|Launch New Campaign|Analytics|Edit/i })).not.toBeInTheDocument()
  })

  it('says nothing has been recorded when the list is empty', async () => {
    stubFetch(() => ({ body: listBody([]) }))
    render(<OrganizingConsole />)
    expect(await screen.findByText('No organizing campaign has been recorded yet.')).toBeInTheDocument()
    expect(statValue('Total Campaigns')).toHaveTextContent('0')
  })

  it('reports a refusal with the server message, and retries', async () => {
    let refused = true
    stubFetch(() =>
      refused ? { status: 403, body: failure('FORBIDDEN', 'Insufficient permissions') } : { body: listBody([dispatchDrive()]) },
    )
    const user = userEvent.setup()
    render(<OrganizingConsole />)

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Insufficient permissions')).toBeInTheDocument()
    expect(screen.queryByText('No Campaigns Found')).not.toBeInTheDocument()

    refused = false
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Harbourfront Dispatch Drive')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports a network failure and a list that is not the crud shape, and never shows them as no campaigns', async () => {
    stubFetch(() => 'network')
    const first = render(<OrganizingConsole />)
    expect(await screen.findByText('Unable to load organizing campaigns. Please try again later.')).toBeInTheDocument()
    expect(screen.queryByText('No Campaigns Found')).not.toBeInTheDocument()
    first.unmount()

    stubFetch(() => ({ body: success({ campaigns: [dispatchDrive()] }) }))
    render(<OrganizingConsole />)
    expect(await screen.findByText('Unable to load organizing campaigns. Please try again later.')).toBeInTheDocument()
    expect(screen.queryByText('No Campaigns Found')).not.toBeInTheDocument()
  })

  it('fails loudly on a campaign row that lacks a column the table never leaves empty', async () => {
    const { campaignName: _dropped, ...rest } = dispatchDrive()
    stubFetch(() => ({ body: listBody([rest]) }))
    render(<OrganizingConsole />)
    expect(await screen.findByText('Unable to load organizing campaigns. Please try again later.')).toBeInTheDocument()
  })
})

describe('campaign detail console', () => {
  const detail = (id: string) =>
    render(<CampaignDetailConsole campaignId={id} />)

  it('picks the campaign out of the list by id and shows what the row stores, with no threshold the table does not hold', async () => {
    stubFetch(() => ({ body: listBody([bareDrive(), dispatchDrive()]) }))
    detail('5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a01')

    expect(await screen.findByRole('heading', { name: 'Harbourfront Dispatch Drive' })).toBeInTheDocument()
    expect(screen.getByText('Harbourfront Logistics Ltd.')).toBeInTheDocument()
    expect(screen.getByText('210 Quay Street, Halifax NS')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(statValue('Estimated Workers')).toHaveTextContent('200')
    expect(statValue('Cards Signed')).toHaveTextContent('90')
    expect(statValue('Signing %')).toHaveTextContent('45.0%')
    expect(statValue('Organizing Team')).toHaveTextContent('3')
    expect(screen.getByText('90 of 200 workers signed (45.0%)')).toBeInTheDocument()
    expect(screen.getByText(/Card target \(120 cards\)/)).toBeInTheDocument()
    expect(screen.queryByText(/Super Majority/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Threshold/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Mill Road Warehouse Drive')).not.toBeInTheDocument()

    expect(screen.getByText('Card Check')).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getAllByText('Logistics').length).toBeGreaterThan(0)
    expect(screen.getByText('Scheduling')).toBeInTheDocument()
    expect(screen.getByText('Safety')).toBeInTheDocument()
    expect(screen.getByText('Start with the night-shift dispatchers.')).toBeInTheDocument()
    expect(screen.getByText(dayText('2020-01-15'))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back/ })).toHaveAttribute('href', '/en-CA/dashboard/organizing')
  })

  it('shows the columns a bare campaign does not hold as dashes and hides the election tab', async () => {
    stubFetch(() => ({ body: listBody([bareDrive()]) }))
    const user = userEvent.setup()
    detail('5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a02')

    expect(await screen.findByRole('heading', { name: 'Mill Road Warehouse Drive' })).toBeInTheDocument()
    expect(statValue('Cards Signed')).toHaveTextContent('—')
    expect(statValue('Signing %')).toHaveTextContent('—')
    expect(statValue('Organizing Team')).toHaveTextContent('—')
    expect(screen.getByText('— of 50 workers signed (—)')).toBeInTheDocument()
    expect(screen.queryByText(/Card target/)).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Election Results' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Outreach Metrics' }))
    expect(metricValue('Contacts Identified')).toHaveTextContent('—')
    expect(metricValue('Workplace Meetings')).toHaveTextContent('—')
    expect(screen.queryByText('Commitment Funnel')).not.toBeInTheDocument()
  })

  it('shows the stored dates on the timeline, past or upcoming against today', async () => {
    stubFetch(() => ({ body: listBody([dispatchDrive({ filingDate: '2020-02-01' })]) }))
    const user = userEvent.setup()
    detail('5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a01')
    await screen.findByRole('heading', { name: 'Harbourfront Dispatch Drive' })

    await user.click(screen.getByRole('tab', { name: 'Timeline' }))
    const timeline = screen.getByText('Campaign Timeline').closest('.rounded-lg') as HTMLElement
    const item = (label: string) => within(timeline).getByText(label).closest('.border') as HTMLElement
    expect(within(item('Campaign Start')).getByText(dayText('2020-01-15'))).toBeInTheDocument()
    expect(within(item('Campaign Start')).getByText('Past')).toBeInTheDocument()
    expect(within(item('Card Deadline')).getByText('Upcoming')).toBeInTheDocument()
    expect(within(item('Filing')).getByText(dayText('2020-02-01'))).toBeInTheDocument()
    expect(within(item('Election')).getByText('Not set')).toBeInTheDocument()
    expect(within(item('Election')).queryByText(/Past|Upcoming/)).not.toBeInTheDocument()
  })

  it('shows the outreach counts the row holds and a funnel computed against the unit', async () => {
    stubFetch(() => ({ body: listBody([dispatchDrive()]) }))
    const user = userEvent.setup()
    detail('5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a01')
    await screen.findByRole('heading', { name: 'Harbourfront Dispatch Drive' })

    await user.click(screen.getByRole('tab', { name: 'Outreach Metrics' }))
    expect(metricValue('Contacts Identified')).toHaveTextContent('80')
    expect(metricValue('Contacts Committed')).toHaveTextContent('40')
    expect(metricValue('House Visits')).toHaveTextContent('12')
    expect(metricValue('Workplace Meetings')).toHaveTextContent('3')
    expect(screen.getByText('80 (40%)')).toBeInTheDocument()
    expect(screen.getByText('40 (20%)')).toBeInTheDocument()
    expect(screen.getByText('90 (45%)')).toBeInTheDocument()
  })

  it('shows the election tab only when a result is recorded, with a dash for a count not recorded', async () => {
    stubFetch(() =>
      ({ body: listBody([dispatchDrive({ status: 'won', electionResult: 'certified', electionEligibleVoters: 180, votesForUnion: 120, votesAgainstUnion: null })]) }),
    )
    const user = userEvent.setup()
    detail('5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a01')
    await screen.findByRole('heading', { name: 'Harbourfront Dispatch Drive' })

    await user.click(screen.getByRole('tab', { name: 'Election Results' }))
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Certified')).toBeInTheDocument()
    expect(within(panel).getByText('180')).toBeInTheDocument()
    expect(within(panel).getByText('120')).toBeInTheDocument()
    expect(within(panel).getByText('Votes Against').nextElementSibling).toHaveTextContent('—')
  })

  it('says the campaign was not found when the list does not hold it, without offering a retry', async () => {
    stubFetch(() => ({ body: listBody([dispatchDrive()]) }))
    detail('00000000-0000-4000-8000-000000000000')

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Campaign not found.')).toBeInTheDocument()
    expect(within(alert).queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument()
    expect(within(alert).getByRole('link', { name: /Back to Campaigns/ })).toHaveAttribute('href', '/en-CA/dashboard/organizing')
  })

  it('reports a refused read with the server message and retries', async () => {
    let refused = true
    stubFetch(() =>
      refused ? { status: 500, body: failure('INTERNAL_ERROR', 'The campaign list could not be read') } : { body: listBody([dispatchDrive()]) },
    )
    const user = userEvent.setup()
    detail('5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a01')

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('The campaign list could not be read')).toBeInTheDocument()

    refused = false
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Harbourfront Dispatch Drive' })).toBeInTheDocument()
  })

  it('fails loudly when the requested row is malformed, but is not broken by a malformed row of another campaign', async () => {
    const { campaignName: _dropped, ...malformed } = bareDrive()
    stubFetch(() => ({ body: listBody([malformed, dispatchDrive()]) }))
    detail('5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a01')
    expect(await screen.findByRole('heading', { name: 'Harbourfront Dispatch Drive' })).toBeInTheDocument()
    cleanup()

    stubFetch(() => ({ body: listBody([malformed, dispatchDrive()]) }))
    detail('5b1f0c52-3d0e-4a39-9a2e-0f6f1d7e8a02')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to load campaign details.'))
  })
})
