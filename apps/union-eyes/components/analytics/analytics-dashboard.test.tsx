// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'

const toasts = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: toasts.toast }) }))
// recharts measures its container, which jsdom cannot; the chart is not what is under test.
vi.mock('./trend-chart', () => ({
  TrendChart: ({ data }: { data: Array<{ date: string; value: number }> }) => <div data-testid="trend-chart">{data.length} points</div>,
}))

import { AnalyticsDashboard } from './analytics-dashboard'

const stamp = '2026-05-31T12:00:00.000Z'

// An analytics_metrics row as GET /api/analytics/metrics answers it: the role-guarded route's own { success, metrics } body.
const metricRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'm-1',
  organizationId: 'org-1',
  metricType: 'claims_volume',
  metricName: 'Claims volume',
  metricValue: '42',
  metricUnit: 'count',
  periodType: 'monthly',
  periodStart: '2026-05-01T00:00:00.000Z',
  periodEnd: '2026-05-31T23:59:59.000Z',
  metadata: { claimsCount: 42 },
  comparisonValue: '38',
  trend: 'up',
  createdAt: stamp,
  updatedAt: stamp,
  ...overrides,
})
const metricsBody = (rows: unknown[]) => ({ success: true, metrics: rows })

// The crud factory's list: withApi wraps { data, pagination } as { success, data: { data, pagination }, timestamp }.
const list = (rows: unknown[], total = rows.length) => ({
  success: true,
  data: { data: rows, pagination: { page: 1, limit: 20, total, totalPages: 1 } },
  timestamp: stamp,
})
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })

const kpiRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'k-1',
  organizationId: 'org-1',
  createdBy: 'user-1',
  name: 'Monthly claims',
  description: 'Claims opened each month',
  metricType: 'claims_volume',
  dataSource: 'claims',
  calculation: { aggregation: 'count', groupBy: 'day', filters: {} },
  visualizationType: 'number',
  targetValue: '50',
  warningThreshold: '60',
  criticalThreshold: '80',
  alertEnabled: false,
  direction: null,
  refreshInterval: 3600,
  isActive: true,
  displayOrder: null,
  dashboardLayout: null,
  createdAt: stamp,
  updatedAt: stamp,
  ...overrides,
})

const insightRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'i-1',
  organizationId: 'org-1',
  insightType: 'risk',
  category: 'claims',
  priority: 'high',
  title: 'Grievance backlog is growing',
  description: 'Open grievances rose for three weeks.',
  dataSource: null,
  metrics: null,
  trend: null,
  impact: 'high',
  recommendations: ['Assign a second steward', { description: 'Review the intake queue' }],
  actionRequired: true,
  actionDeadline: null,
  estimatedBenefit: null,
  confidenceScore: '0.8',
  aiReferenceId: null,
  relatedEntities: null,
  status: 'new',
  acknowledgedBy: null,
  acknowledgedAt: null,
  dismissedBy: null,
  dismissedAt: null,
  dismissalReason: null,
  completedAt: null,
  notes: null,
  createdAt: stamp,
  updatedAt: stamp,
  ...overrides,
})

const trendRow = (overrides: Record<string, unknown> = {}) => ({
  id: 't-1',
  organizationId: 'org-1',
  analysisType: 'trend',
  dataSource: 'claims',
  timeRange: { start: '2026-04-01', end: '2026-04-30' },
  detectedTrend: 'increasing',
  trendStrength: '0.9',
  anomaliesDetected: null,
  anomalyCount: 2,
  seasonalPattern: null,
  correlations: null,
  insights: 'Claims are rising week over week.',
  recommendations: null,
  statisticalTests: null,
  visualizationData: null,
  confidence: '0.75',
  createdAt: stamp,
  ...overrides,
})

type Reply = { status?: number; body: unknown }
type Init = { method?: string; body?: string }
type Router = (url: URL, init?: Init) => Reply

function stubFetch(router: Router) {
  const fetchMock = vi.fn(async (input: string, init?: Init) => {
    const reply = router(new URL(input, 'http://localhost'), init)
    const status = reply.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => reply.body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// A router that answers every analytics read with the given rows, per path.
function standardRouter(overrides: Partial<Record<string, Reply>> = {}): Router {
  return (url) => {
    const key = url.pathname === '/api/analytics/metrics' ? `metrics:${url.searchParams.get('metricType')}` : url.pathname
    const defaults: Record<string, Reply> = {
      'metrics:claims_volume': { body: metricsBody([metricRow()]) },
      'metrics:resolution_time': { body: metricsBody([metricRow({ id: 'm-2', metricType: 'resolution_time', metricValue: '6.5', metricUnit: 'days', trend: 'down' })]) },
      'metrics:member_growth': { body: metricsBody([]) },
      '/api/analytics/kpis': { body: list([kpiRow()]) },
      '/api/analytics/insights': { body: list([insightRow()], 7) },
      '/api/analytics/trends': { body: list([trendRow()]) },
    }
    const reply = overrides[key] ?? defaults[key]
    if (!reply) throw new Error(`unexpected request ${url.pathname}${url.search}`)
    return reply
  }
}

function renderDashboard() {
  return render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      <AnalyticsDashboard organizationId="org-1" />
    </NextIntlClientProvider>,
  )
}

const card = (title: string) => screen.getByText(title).closest('[class*="rounded"]') as HTMLElement

beforeEach(() => {
  toasts.toast.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('analytics dashboard: what it shows', () => {
  it('shows the stored figures with the period each covers, and the count of insights the route reports', async () => {
    stubFetch(standardRouter())
    renderDashboard()
    await screen.findByText('Claims This Month')

    expect(within(card('Claims This Month')).getByText('42')).toBeInTheDocument()
    const period = `${new Date('2026-05-01T00:00:00.000Z').toLocaleDateString('en-CA')} – ${new Date('2026-05-31T23:59:59.000Z').toLocaleDateString('en-CA')}`
    expect(within(card('Claims This Month')).getByText(period)).toBeInTheDocument()
    expect(within(card('Avg Resolution Time')).getByText('6.5 days')).toBeInTheDocument()
    // The seven insights nobody has triaged, not the one row this page asked for.
    expect(within(card('Active Insights')).getByText('7')).toBeInTheDocument()
    expect(screen.queryByText('vs. last month')).not.toBeInTheDocument()
  })

  it('shows a dash, not zero, for a figure nothing has recorded', async () => {
    stubFetch(standardRouter())
    renderDashboard()
    await screen.findByText('New Members')
    expect(within(card('New Members')).getByText('—')).toBeInTheDocument()
    expect(within(card('New Members')).queryByText('0')).not.toBeInTheDocument()
  })

  it('reads the latest period type only into a chart, oldest first', async () => {
    stubFetch(
      standardRouter({
        'metrics:claims_volume': {
          body: metricsBody([
            metricRow({ id: 'm-9', periodStart: '2026-05-02T00:00:00.000Z' }),
            metricRow({ id: 'm-8', periodStart: '2026-05-01T00:00:00.000Z' }),
            metricRow({ id: 'm-7', periodType: 'weekly', periodStart: '2026-04-24T00:00:00.000Z' }),
          ]),
        },
      }),
    )
    renderDashboard()
    await screen.findByText('Claims Volume Trend')
    expect(screen.getAllByTestId('trend-chart')[0]).toHaveTextContent('2 points')
    // A monthly series is not "daily volume over the last 30 days".
    expect(screen.queryByText(enCA.analyticsDashboard.claimsVolumeTrend.description)).not.toBeInTheDocument()
  })

  it('shows the KPI with the latest stored value of its metric, and a dash for a KPI whose metric nothing recorded', async () => {
    const user = userEvent.setup()
    stubFetch(
      standardRouter({
        '/api/analytics/kpis': { body: list([kpiRow(), kpiRow({ id: 'k-2', name: 'Member growth', metricType: 'member_growth', targetValue: null, warningThreshold: null, criticalThreshold: null })]) },
      }),
    )
    renderDashboard()
    await user.click(await screen.findByRole('tab', { name: 'Custom KPIs' }))
    const monthly = screen.getByText('Monthly claims').closest('[class*="rounded"]') as HTMLElement
    expect(within(monthly).getByText('42')).toBeInTheDocument()
    expect(within(monthly).getByText('Target: 50')).toBeInTheDocument()
    const growth = screen.getByText('Member growth').closest('[class*="rounded"]') as HTMLElement
    expect(within(growth).getByText('—')).toBeInTheDocument()
    expect(within(growth).getByText(/No member growth metric has been recorded yet/)).toBeInTheDocument()
    expect(within(growth).queryByText('0')).not.toBeInTheDocument()
  })

  it('offers no KPI control that does nothing', async () => {
    const user = userEvent.setup()
    stubFetch(standardRouter({ '/api/analytics/kpis': { body: list([]) } }))
    renderDashboard()
    await user.click(await screen.findByRole('tab', { name: 'Custom KPIs' }))
    expect(screen.getByText('No KPIs configured')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create Your First KPI/ })).not.toBeInTheDocument()
  })

  it('shows a trend with the confidence the row stores, and says nothing is computed when nothing is', async () => {
    const user = userEvent.setup()
    stubFetch(standardRouter())
    const { unmount } = renderDashboard()
    await user.click(await screen.findByRole('tab', { name: 'Trends' }))
    expect(screen.getByText('increasing')).toBeInTheDocument()
    expect(screen.getByText('(75.0% confidence)')).toBeInTheDocument()
    expect(screen.getByText('2 anomalies detected')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View Details' })).not.toBeInTheDocument()
    unmount()

    stubFetch(standardRouter({ '/api/analytics/trends': { body: list([]) } }))
    renderDashboard()
    await user.click(await screen.findByRole('tab', { name: 'Trends' }))
    expect(screen.getByText(enCA.analyticsDashboard.noTrends)).toBeInTheDocument()
  })

  it('states that comparison between organizations is not available', async () => {
    const user = userEvent.setup()
    stubFetch(standardRouter())
    renderDashboard()
    await user.click(await screen.findByRole('tab', { name: 'Compare' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Not available in this release')
    expect(screen.getByText('UE-ANALYTICS-COMPARATIVE')).toBeInTheDocument()
  })
})

describe('analytics dashboard: failures', () => {
  it("reports a section that could not be read with the server's reason, and retries only that section", async () => {
    let insightReads = 0
    const fetchMock = stubFetch((url, init) => {
      if (url.pathname === '/api/analytics/insights') {
        insightReads += 1
        return insightReads === 1 ? { status: 500, body: failure('INTERNAL_ERROR', 'The insight store is down') } : { body: list([insightRow()], 3) }
      }
      return standardRouter()(url, init)
    })
    const user = userEvent.setup()
    renderDashboard()
    expect(await screen.findByText('The insight store is down')).toBeInTheDocument()
    expect(within(card('Active Insights')).getByText('—')).toBeInTheDocument()
    // The figures that were read are still shown.
    expect(within(card('Claims This Month')).getByText('42')).toBeInTheDocument()
    const readsBefore = fetchMock.mock.calls.length

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(within(card('Active Insights')).getByText('3')).toBeInTheDocument())
    expect(screen.queryByText('The insight store is down')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.length - readsBefore).toBe(1)
  })

  it("reports the metrics route's own error body, not a blank dashboard", async () => {
    stubFetch(standardRouter({ 'metrics:claims_volume': { status: 400, body: { error: 'Organization context is required' } } }))
    renderDashboard()
    expect(await screen.findByText('Organization context is required')).toBeInTheDocument()
    expect(within(card('Claims This Month')).getByText('—')).toBeInTheDocument()
  })

  it('reports a body that is not the route\'s shape instead of showing a figure it cannot vouch for', async () => {
    stubFetch(standardRouter({ 'metrics:claims_volume': { body: { success: true, data: [] } } }))
    renderDashboard()
    expect(await screen.findByText(enCA.analyticsDashboard.errorDescription)).toBeInTheDocument()
    expect(within(card('Claims This Month')).getByText('—')).toBeInTheDocument()
  })

  it('says a refresh succeeded only when every section was read', async () => {
    const user = userEvent.setup()
    let failInsights = false
    stubFetch((url, init) => {
      if (url.pathname === '/api/analytics/insights' && failInsights) return { status: 500, body: failure('INTERNAL_ERROR', 'down') }
      return standardRouter()(url, init)
    })
    renderDashboard()
    await user.click(await screen.findByRole('button', { name: /Refresh/ }))
    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ title: enCA.analyticsDashboard.dashboardRefreshed })))

    toasts.toast.mockReset()
    failInsights = true
    await user.click(screen.getByRole('button', { name: /Refresh/ }))
    expect(await screen.findByText('down')).toBeInTheDocument()
    expect(toasts.toast).not.toHaveBeenCalled()
  })
})

describe('insights panel', () => {
  async function openInsights() {
    const user = userEvent.setup()
    renderDashboard()
    await user.click(await screen.findByRole('tab', { name: 'Insights' }))
    await user.click(await screen.findByRole('button', { name: 'Show More' }))
    return user
  }

  it('shows the recommendations as the text they are, whether stored as a string or as { description }', async () => {
    stubFetch(standardRouter())
    await openInsights()
    expect(screen.getByText('Assign a second steward')).toBeInTheDocument()
    expect(screen.getByText('Review the intake queue')).toBeInTheDocument()
  })

  it('will not dismiss an insight without the reason the person gives, and sends that reason', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.pathname === '/api/analytics/insights' && init?.method === 'PATCH') {
        return { body: { success: true, data: { success: true, data: insightRow({ status: 'dismissed' }) }, timestamp: stamp } }
      }
      return standardRouter()(url, init)
    })
    const user = await openInsights()
    const dismiss = screen.getByRole('button', { name: 'Dismiss' })
    expect(dismiss).toBeDisabled()

    await user.type(screen.getByLabelText('Reason for dismissing'), 'Duplicate of the Q1 finding')
    expect(dismiss).toBeEnabled()
    const readsBefore = fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/analytics/insights')).length
    await user.click(dismiss)

    await waitFor(() => expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Insight Updated' })))
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(patch[1]!.body!)).toEqual({ insightId: 'i-1', status: 'dismissed', dismissalReason: 'Duplicate of the Q1 finding' })
    // The list is read again instead of the page being reloaded.
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.startsWith('/api/analytics/insights')).length).toBe(readsBefore + 2))
  })

  it("shows the route's refusal when an insight cannot change", async () => {
    stubFetch((url, init) => {
      if (url.pathname === '/api/analytics/insights' && init?.method === 'PATCH') {
        return { status: 409, body: failure('CONFLICT', 'An insight that is completed cannot become dismissed') }
      }
      return standardRouter()(url, init)
    })
    const user = await openInsights()
    await user.click(screen.getByRole('button', { name: 'Acknowledge' }))
    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Error', description: 'An insight that is completed cannot become dismissed', variant: 'destructive' }),
      ),
    )
  })
})
