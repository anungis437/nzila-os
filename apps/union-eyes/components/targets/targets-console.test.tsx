// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const toastMock = vi.hoisted(() => vi.fn())
vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }))
vi.mock('recharts', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  const Nothing = () => null
  return {
    ResponsiveContainer: Box,
    RadialBarChart: Box,
    BarChart: Box,
    Bar: Box,
    RadialBar: Nothing,
    XAxis: Nothing,
    YAxis: Nothing,
    Tooltip: Nothing,
    CartesianGrid: Nothing,
    Cell: Nothing,
  }
})

import { TargetsConsole } from './targets-console'

const stamp = '2026-05-31T12:00:00.000Z'
const success = (data: unknown) => ({ success: true, data, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })

// GET /api/targets/summary: { summary, targets } inside the withApi body; each target is a kpi_configurations row's own fields plus what the route works out.
const summaryBody = (targets: unknown[], counts: Partial<Record<'total' | 'onTrack' | 'atRisk' | 'critical' | 'noData', number>> = {}, bySource: Record<string, number> = {}) =>
  success({
    summary: { total: targets.length, onTrack: 0, atRisk: 0, critical: 0, noData: 0, bySource, ...counts },
    targets,
  })
const resolutionRate = (overrides: Record<string, unknown> = {}) => ({
  id: 'b3a1f5c2-0d4e-4f6a-8b7c-1d2e3f4a5b01',
  name: 'Grievance Resolution Rate',
  description: 'Share of grievances resolved within 30 days',
  metricType: 'resolution_rate',
  dataSource: 'claims',
  visualizationType: 'gauge',
  targetValue: '80',
  isActive: true,
  displayOrder: 1,
  health: 'at_risk',
  currentValue: 62.5,
  progress: 78,
  valueBasis: 'latest_metric_row_of_the_metric_type',
  asOf: '2026-04-30T00:00:00.000Z',
  stale: false,
  trend: 'up',
  ...overrides,
})
const noMetricYet = (overrides: Record<string, unknown> = {}) =>
  resolutionRate({
    id: 'b3a1f5c2-0d4e-4f6a-8b7c-1d2e3f4a5b02',
    name: 'Member Retention',
    description: null,
    metricType: 'member_retention',
    dataSource: 'members',
    targetValue: '95',
    health: 'no_data',
    currentValue: null,
    progress: null,
    asOf: null,
    stale: false,
    trend: null,
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

const posts = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
const gets = (fetchMock: ReturnType<typeof vi.fn>) => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === undefined)

beforeEach(() => toastMock.mockReset())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('targets console', () => {
  it('shows the counts the route computed and the targets it needs attention on, with the stored value, target and its date', async () => {
    stubFetch(() => ({
      body: summaryBody([resolutionRate(), noMetricYet()], { atRisk: 1, noData: 1 }, { claims: 1, members: 1 }),
    }))
    render(<TargetsConsole />)

    expect(await screen.findByText('Performance Targets')).toBeInTheDocument()
    const total = screen.getByText('Total Targets').closest('div.flex')!.parentElement as HTMLElement
    expect(within(total).getByText('2')).toBeInTheDocument()
    expect(within(total).getByText('Configured KPI targets, active or not')).toBeInTheDocument()
    const atRisk = screen.getByText('At Risk').closest('div.flex')!.parentElement as HTMLElement
    expect(within(atRisk).getByText('1')).toBeInTheDocument()

    const attention = screen.getByText('Needs Attention').closest('div.rounded-lg') as HTMLElement
    expect(within(attention).getByText('Grievance Resolution Rate')).toBeInTheDocument()
    expect(within(attention).getByText('78% complete')).toBeInTheDocument()
    expect(within(attention).queryByText('Member Retention')).not.toBeInTheDocument()
  })

  it('shows a target without a stored value as a dash and a stale one as too old to judge, never as zero', async () => {
    stubFetch(() => ({
      body: summaryBody([resolutionRate(), noMetricYet(), noMetricYet({ id: 'b3a1f5c2-0d4e-4f6a-8b7c-1d2e3f4a5b03', name: 'Dues Collection', metricType: 'dues_collection', stale: true })], { atRisk: 1, noData: 2 }),
    }))
    const user = userEvent.setup()
    render(<TargetsConsole />)
    await screen.findByText('Performance Targets')
    await user.click(screen.getByRole('tab', { name: 'All Targets' }))

    const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement
    const resolution = within(row('Grievance Resolution Rate'))
    expect(resolution.getByText('62.5')).toBeInTheDocument()
    expect(resolution.getByText('/ 80')).toBeInTheDocument()
    expect(resolution.getByText(/as of Apr 30, 2026/)).toBeInTheDocument()
    expect(resolution.getByText('78%')).toBeInTheDocument()
    expect(resolution.getByText('At Risk')).toBeInTheDocument()

    const retention = within(row('Member Retention'))
    expect(retention.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    expect(retention.getByText('No Data')).toBeInTheDocument()
    expect(retention.queryByText(/too old/)).not.toBeInTheDocument()
    expect(within(row('Dues Collection')).getByText('Latest stored value is too old to judge')).toBeInTheDocument()
  })

  it('creates a target with no alert (nothing sends one), shows the new list and confirms', async () => {
    const fetchMock = stubFetch((_url, init) =>
      init?.method === 'POST' ? { status: 201, body: success({ id: 'b3a1f5c2-0d4e-4f6a-8b7c-1d2e3f4a5b09', name: 'Grievance Resolution Rate' }) } : { body: summaryBody([]) },
    )
    const user = userEvent.setup()
    render(<TargetsConsole />)
    await screen.findByText('No targets configured yet')

    await user.click(screen.getByRole('button', { name: /New Target/ }))
    expect(screen.queryByText(/Enable threshold alerts/)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Target Name *'), 'Grievance Resolution Rate')
    await user.type(screen.getByLabelText('Metric Type *'), 'resolution_rate')
    await user.type(screen.getByLabelText('Target Value'), '80')
    await user.type(screen.getByLabelText('Warning Threshold'), '70')
    await user.click(screen.getByRole('button', { name: 'Create Target' }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'Target Created', description: '"Grievance Resolution Rate" has been created.' }))
    const [url, init] = posts(fetchMock)[0] as [string, RequestInit]
    expect(url).toBe('/api/targets')
    expect(JSON.parse(String(init.body))).toEqual({
      name: 'Grievance Resolution Rate',
      metricType: 'resolution_rate',
      dataSource: 'claims',
      calculation: { aggregation: 'sum' },
      visualizationType: 'gauge',
      targetValue: 80,
      warningThreshold: 70,
    })
    // The list is read again after the create.
    await waitFor(() => expect(gets(fetchMock).length).toBe(2))
  })

  it("shows the server's refusal when a create is refused, and keeps the form open", async () => {
    stubFetch((_url, init) =>
      init?.method === 'POST' ? { status: 400, body: failure('VALIDATION_ERROR', 'Invalid input: alertEnabled') } : { body: summaryBody([]) },
    )
    const user = userEvent.setup()
    render(<TargetsConsole />)
    await screen.findByText('No targets configured yet')

    await user.click(screen.getByRole('button', { name: /New Target/ }))
    await user.type(screen.getByLabelText('Target Name *'), 'Grievance Resolution Rate')
    await user.type(screen.getByLabelText('Metric Type *'), 'resolution_rate')
    await user.click(screen.getByRole('button', { name: 'Create Target' }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'Error', description: 'Invalid input: alertEnabled', variant: 'destructive' }))
    expect(screen.getByRole('button', { name: 'Create Target' })).toBeInTheDocument()
  })

  it('does not post a create without a name and metric type', async () => {
    const fetchMock = stubFetch(() => ({ body: summaryBody([]) }))
    const user = userEvent.setup()
    render(<TargetsConsole />)
    await screen.findByText('No targets configured yet')
    await user.click(screen.getByRole('button', { name: /New Target/ }))
    await user.click(screen.getByRole('button', { name: 'Create Target' }))

    expect(toastMock).toHaveBeenCalledWith({ title: 'Validation', description: 'Name and metric type are required.', variant: 'destructive' })
    expect(posts(fetchMock)).toHaveLength(0)
  })

  it('deactivates a target with the PATCH the route reads, reloads, and reports a refusal with its message', async () => {
    let refuse = false
    const fetchMock = stubFetch((_url, init) =>
      init?.method === 'PATCH'
        ? refuse
          ? { status: 404, body: failure('NOT_FOUND', 'Target not found') }
          : { body: success({ id: 'b3a1f5c2-0d4e-4f6a-8b7c-1d2e3f4a5b01', isActive: false }) }
        : { body: summaryBody([resolutionRate()], { atRisk: 1 }) },
    )
    const user = userEvent.setup()
    render(<TargetsConsole />)
    await screen.findByText('Performance Targets')
    await user.click(screen.getByRole('tab', { name: 'All Targets' }))
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'Deactivated' }))
    const patch = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH') as [string, RequestInit]
    expect(patch[0]).toBe('/api/targets/b3a1f5c2-0d4e-4f6a-8b7c-1d2e3f4a5b01')
    expect(JSON.parse(String(patch[1].body))).toEqual({ isActive: false })
    await waitFor(() => expect(gets(fetchMock).length).toBe(2))

    refuse = true
    await user.click(await screen.findByRole('tab', { name: 'All Targets' }))
    await user.click(await screen.findByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'Error', description: 'Target not found', variant: 'destructive' }))
  })

  it('reports a refused read and retries, showing no zero counts while it has nothing', async () => {
    let refused = true
    stubFetch(() => (refused ? { status: 403, body: failure('FORBIDDEN', 'Insufficient permissions') } : { body: summaryBody([resolutionRate()], { atRisk: 1 }) }))
    const user = userEvent.setup()
    render(<TargetsConsole />)

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Insufficient permissions')).toBeInTheDocument()
    expect(screen.queryByText('Total Targets')).not.toBeInTheDocument()
    expect(screen.queryByText('No targets configured yet')).not.toBeInTheDocument()

    refused = false
    await user.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Total Targets')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports a network failure and a summary that is not the route shape instead of showing zeros', async () => {
    stubFetch(() => 'network')
    const first = render(<TargetsConsole />)
    expect(await screen.findByText('Unable to load performance targets.')).toBeInTheDocument()
    expect(screen.queryByText('Total Targets')).not.toBeInTheDocument()
    first.unmount()

    stubFetch(() => ({ body: success({ targets: [resolutionRate()] }) }))
    render(<TargetsConsole />)
    expect(await screen.findByText('Unable to load performance targets.')).toBeInTheDocument()
    expect(screen.queryByText('Total Targets')).not.toBeInTheDocument()
  })

  it('fails loudly on a target with an unrecognised health instead of showing it as healthy', async () => {
    stubFetch(() => ({ body: summaryBody([resolutionRate({ health: 'thriving' })], { onTrack: 1 }) }))
    render(<TargetsConsole />)
    expect(await screen.findByText('Unable to load performance targets.')).toBeInTheDocument()
  })
})
