// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { cleanup, fireEvent, render as renderPlain, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import type { AnnualComplianceReport, ComplianceAnomaly, MultiYearTrendAnalysis } from '@/services/clc/compliance-reports';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import CLCAnalyticsDashboard from '../clc-analytics-dashboard';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

// The dashboard's own words come from the message catalogs, so it is rendered inside the provider the application gives it.
const render = (ui: ReactElement, locale: 'en-CA' | 'fr-CA' = 'en-CA') =>
  renderPlain(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      {ui}
    </NextIntlClientProvider>,
  );

// The routes answer with the report and the analysis themselves (NextResponse.json(report)), so the bodies below are the service's own types.
const report = (overrides: Partial<AnnualComplianceReport> = {}): AnnualComplianceReport => ({
  year: 2026,
  generatedAt: new Date('2026-03-16T12:00:00Z'),
  summary: {
    totalOrganizations: 12,
    totalRemittances: 1234,
    totalAmount: 250000,
    paidAmount: 200000,
    outstandingAmount: 50000,
    overdueAmount: 12000,
    complianceRate: 92.5,
    averagePaymentDelay: 4,
  },
  organizationPerformance: [],
  paymentPatterns: {
    monthlyDistribution: [],
    averageProcessingTime: 3.2,
    onTimePaymentRate: 80,
    latePaymentRate: 15,
    nonPaymentRate: 5,
    seasonalTrends: [],
  },
  complianceMetrics: {
    onTimeSubmissionRate: 88.8,
    onTimePaymentRate: 91.1,
    averageSubmissionDelay: 2,
    averagePaymentDelay: 4,
    perfectComplianceOrgs: 7,
    criticalNonComplianceOrgs: 1,
  },
  anomalies: [],
  recommendations: [],
  ...overrides,
});

const trends = (): MultiYearTrendAnalysis => ({
  years: [2024, 2025, 2026],
  totalRemittancesTrend: [],
  totalAmountTrend: [],
  complianceRateTrend: [],
  organizationGrowth: [],
  forecastNextYear: { year: 2027, forecastRemittances: 1300, forecastAmount: 260000, forecastComplianceRate: 93, confidenceLevel: 70 },
  keyInsights: ['Compliance has improved for three years'],
});

const anomaly = (overrides: Partial<ComplianceAnomaly> = {}): ComplianceAnomaly => ({
  type: 'late_payment',
  severity: 'medium',
  organizationId: 'org-1',
  organizationName: 'Local 100',
  description: 'Payment arrived 45 days late',
  suggestedAction: 'Contact the treasurer',
  detectedAt: new Date('2026-03-01T00:00:00Z'),
  ...overrides,
});

interface Server {
  annual: () => Response;
  trends: () => Response;
}
let server: Server;
const fetchMock = vi.fn(async (url: string, _init?: RequestInit): Promise<Response> => {
  if (url.startsWith('/api/admin/clc/analytics/annual-report?year=')) return server.annual();
  if (url.startsWith('/api/admin/clc/analytics/multi-year-trends?years=')) return server.trends();
  return Response.json({ message: `unexpected ${url}` }, { status: 404 });
});

beforeEach(() => {
  server = { annual: () => Response.json(report()), trends: () => Response.json(trends()) };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  // The select and the charts measure their containers, which jsdom cannot.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const openTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });

describe('CLCAnalyticsDashboard: what it loads', () => {
  it('loads the annual report and the multi-year trends, and offers no export: there is no export route', async () => {
    render(<CLCAnalyticsDashboard />);

    expect(await screen.findByText('CLC Remittance Analytics')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const requested = fetchMock.mock.calls.map(([url]) => url);
    expect(requested.some((url) => url.startsWith('/api/admin/clc/analytics/annual-report?year='))).toBe(true);
    expect(requested.some((url) => url.startsWith('/api/admin/clc/analytics/multi-year-trends?years='))).toBe(true);
    expect(requested.some((url) => url.includes('/analytics/export'))).toBe(false);
    expect(screen.queryByRole('button', { name: /export/i })).toBeNull();
    expect(screen.queryByText(/export pdf/i)).toBeNull();
  });

  it('shows the figures of the report as the route answers with them', async () => {
    render(<CLCAnalyticsDashboard />);

    expect(await screen.findByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('12 organizations')).toBeInTheDocument();
    expect(screen.getByText('92.5%')).toBeInTheDocument();
    expect(screen.getByText('7 perfect orgs')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('CLCAnalyticsDashboard: when a load fails', () => {
  it('says so in the page with the route’s reason and a retry, instead of showing an empty dashboard', async () => {
    server.annual = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
    render(<CLCAnalyticsDashboard />);

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent(`The ${new Date().getFullYear()} compliance report could not be loaded`);
    expect(failure).toHaveTextContent('Organization context required');
    expect(screen.queryByText('1,234')).toBeNull();

    server.annual = () => Response.json(report());
    fireEvent.click(within(failure).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('1,234')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the trends could not be loaded without hiding the report that did load', async () => {
    server.trends = () => Response.json({ error: 'Rate limit exceeded. Too many CLC requests.', resetIn: 30 }, { status: 429 });
    render(<CLCAnalyticsDashboard />);

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('The multi-year trends could not be loaded');
    expect(failure).toHaveTextContent('Rate limit exceeded. Too many CLC requests.');
    expect(await screen.findByText('1,234')).toBeInTheDocument();
  });

  it('treats a body that is not a report as a failure, and renders none of it', async () => {
    server.annual = () => Response.json({ success: true, data: report() });
    render(<CLCAnalyticsDashboard />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response: not an annual compliance report');
    expect(screen.queryByText('1,234')).toBeNull();
  });

  it('drops the figures it had when a refresh fails, instead of keeping them under the same heading', async () => {
    render(<CLCAnalyticsDashboard />);
    expect(await screen.findByText('1,234')).toBeInTheDocument();

    server.annual = () => new Response('unavailable', { status: 503 });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503');
    expect(screen.queryByText('1,234')).toBeNull();
  });

  it('does not announce a refresh that has not happened', async () => {
    render(<CLCAnalyticsDashboard />);
    await screen.findByText('1,234');

    server.annual = () => new Response('unavailable', { status: 503 });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await screen.findByRole('alert');
    expect(screen.queryByText(/analytics data updated/i)).toBeNull();
  });
});

describe('CLCAnalyticsDashboard: anomalies', () => {
  const showAnomalies = async (anomalies: ComplianceAnomaly[]) => {
    server.annual = () => Response.json(report({ anomalies }));
    render(<CLCAnalyticsDashboard />);
    await screen.findByText('1,234');
    openTab('Anomalies');
  };

  it('writes a type with several underscores out in full and shows no period it does not have', async () => {
    await showAnomalies([anomaly({ type: 'payment_pattern_change' })]);

    expect(await screen.findByText('payment pattern change')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/N\/A|payment pattern_change/);
    expect(screen.queryByText('Period:')).toBeNull();
  });

  it('shows the period when the anomaly has one', async () => {
    await showAnomalies([anomaly({ period: '2026-Q1' })]);

    expect(await screen.findByText('Period:')).toBeInTheDocument();
    expect(screen.getByText(/late payment\s*\|\s*2026-Q1/)).toBeInTheDocument();
  });
});

describe('CLCAnalyticsDashboard: French', () => {
  it('says a failed report and a failed trend analysis could not be loaded, in French, with a retry', async () => {
    server.annual = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Contexte d’organisation requis');
    server.trends = () => new Response('unavailable', { status: 503 });
    render(<CLCAnalyticsDashboard />, 'fr-CA');

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent(`Le rapport de conformité de ${new Date().getFullYear()} n’a pas pu être chargé`);
    expect(alerts[0]).toHaveTextContent('Contexte d’organisation requis');
    expect(alerts[1]).toHaveTextContent('Les tendances pluriannuelles n’ont pas pu être chargées');
    expect(alerts[1]).toHaveTextContent('HTTP 503');
    for (const alert of alerts) expect(within(alert).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/could not be loaded|Retry/);
  });

  it('names the refresh control in French', async () => {
    render(<CLCAnalyticsDashboard />, 'fr-CA');
    await screen.findByText('1,234');

    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeInTheDocument();
  });

  it('labels an anomaly’s type, period and suggested action in French', async () => {
    server.annual = () => Response.json(report({ anomalies: [anomaly({ period: '2026-Q1' })] }));
    render(<CLCAnalyticsDashboard />, 'fr-CA');
    await screen.findByText('1,234');
    openTab('Anomalies');

    expect(await screen.findByText('Type :')).toBeInTheDocument();
    expect(screen.getByText('Période :')).toBeInTheDocument();
    expect(screen.getByText('Mesure suggérée :')).toBeInTheDocument();
    expect(screen.queryByText('Period:')).toBeNull();
    expect(screen.queryByText('Suggested Action:')).toBeNull();
  });
});
