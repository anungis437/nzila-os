// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// Radix tabs measure elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/hooks/use-organization', () => ({ useOrganizationId: () => 'org-1' }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

// The tabs below the metrics fetch for themselves; this file is about the dashboard's own request and actions.
vi.mock('../IncidentTrendChart', () => ({ IncidentTrendChart: () => null }));
vi.mock('../IncidentListTable', () => ({ IncidentListTable: () => null }));
vi.mock('../InspectionScheduleCalendar', () => ({ InspectionScheduleCalendar: () => null }));
vi.mock('../HazardsList', () => ({ HazardsList: () => null }));

import { HealthSafetyDashboard } from '../HealthSafetyDashboard';
import HealthSafetyOverview from '../HealthSafetyOverview';

const metrics = {
  totalIncidents: 4,
  incidentTrend: 'down',
  incidentChange: -20,
  openHazards: 2,
  hazardTrend: 'stable',
  inspectionsDue: 5,
  inspectionsCompleted: 3,
  inspectionComplianceRate: 60,
  daysWithoutIncident: 12,
  criticalAlerts: 0,
  trainingCompliance: null,
  ppeInventoryLow: 1,
};

const envelope = (value: unknown) => ({ success: true, data: { success: true, metrics: value }, timestamp: '2026-03-04T00:00:00.000Z' });

function answerWith(overrides: Record<string, unknown> = {}) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => envelope({ ...metrics, ...overrides }),
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderLoaded(overrides: Record<string, unknown> = {}) {
  const fetchMock = answerWith(overrides);
  render(<HealthSafetyDashboard organizationId="org-1" />);
  await screen.findByText('Total Incidents');
  return fetchMock;
}

beforeEach(() => toast.mockClear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

describe('HealthSafetyDashboard', () => {
  it('loads its metrics from the dashboard route and shows them', async () => {
    const fetchMock = answerWith();
    render(<HealthSafetyDashboard organizationId="org-1" period="30d" />);
    expect(await screen.findByText('Total Incidents')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/health-safety/dashboard?organizationId=org-1&period=30d');
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('offers a refresh but no report export, and never calls the export route', async () => {
    const fetchMock = await renderLoaded();
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export|download|pdf/i })).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url).join(' ')).not.toContain('/reports/export');
  });

  describe('when the metrics cannot be had', () => {
    it('shows an error with the route’s own message, not an empty dashboard, and a way to try again', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ code: 'INTERNAL_ERROR', message: 'Failed to load health and safety metrics' }) })));
      render(<HealthSafetyDashboard organizationId="org-1" />);
      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('could not be loaded');
      expect(alert).toHaveTextContent('Failed to load health and safety metrics');
      expect(screen.queryByText('No data available')).toBeNull();
      expect(screen.queryByText('Total Incidents')).toBeNull();

      answerWith();
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Total Incidents')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it.each([
      ['no metrics', {}],
      ['metrics that are not the dashboard’s', { totalIncidents: 'many' }],
      ['metrics missing a figure', { ...metrics, openHazards: undefined }],
    ])('treats a 200 answer with %s as an error, never as a dashboard of zeros', async (_label, body) => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => envelope(body) })));
      render(<HealthSafetyDashboard organizationId="org-1" />);
      expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
      expect(screen.queryByText('Total Incidents')).toBeNull();
    });

    it('treats a network failure as an error', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
      render(<HealthSafetyDashboard organizationId="org-1" />);
      expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    });

    it('does not report a refresh that failed as a refresh', async () => {
      const user = userEvent.setup();
      await renderLoaded();
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({ message: 'down' }) })));
      await user.click(screen.getByRole('button', { name: /refresh/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('down');
      expect(toast).not.toHaveBeenCalled();
    });

    it('reports a refresh that worked', async () => {
      const user = userEvent.setup();
      await renderLoaded();
      await user.click(screen.getByRole('button', { name: /refresh/i }));
      await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dashboard Refreshed' })));
    });
  });

  describe('figures', () => {
    it('shows the inspection compliance as a percentage with the counts it comes from', async () => {
      await renderLoaded();
      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText('3 of 5')).toBeInTheDocument();
      expect(screen.getByText('Scheduled inspections completed')).toBeInTheDocument();
    });

    it('shows a dash, never "%" or "null%", when nothing was measured', async () => {
      await renderLoaded({ inspectionComplianceRate: null, inspectionsDue: 0, inspectionsCompleted: 0, daysWithoutIncident: null });
      const text = document.body.textContent ?? '';
      expect(text).not.toMatch(/null|undefined|NaN/);
      expect(screen.queryByText('%')).toBeNull();
      expect(screen.getByText('No inspections scheduled in this period')).toBeInTheDocument();
      expect(screen.getByText('No incident on record')).toBeInTheDocument();
      expect(screen.getAllByText('—').length).toBe(2);
    });

    it('shows a decrease as -20%, not --20%, and an increase as +N%', async () => {
      await renderLoaded();
      expect(screen.getByText('-20%')).toBeInTheDocument();
      expect(screen.queryByText('--20%')).toBeNull();
      cleanup();

      await renderLoaded({ incidentTrend: 'up', incidentChange: 35 });
      expect(screen.getByText('+35%')).toBeInTheDocument();
      expect(screen.queryByText('+-35%')).toBeNull();
    });

    it('says an increase went up, without a percentage, when the previous period had no incident', async () => {
      await renderLoaded({ incidentTrend: 'up', incidentChange: null, totalIncidents: 3 });
      expect(screen.getByText('Up')).toBeInTheDocument();
      expect(screen.queryByText('+0%')).toBeNull();
      expect(screen.queryByText('No change')).toBeNull();
    });

    it('labels the scheduled inspections as scheduled, with how many are completed', async () => {
      await renderLoaded();
      expect(screen.getByText('Inspections Scheduled')).toBeInTheDocument();
      expect(screen.queryByText('Inspections Due')).toBeNull();
      expect(screen.getByText('3 completed · last 30 days')).toBeInTheDocument();
    });

    it('counts PPE below its reorder level and does not call an inventory "Good" or "Fully stocked"', async () => {
      await renderLoaded({ ppeInventoryLow: 0 });
      expect(screen.getByText('Items below reorder level')).toBeInTheDocument();
      expect(screen.queryByText(/^Good$|Fully stocked/)).toBeNull();
    });

    it('says training is not measured and draws no training bar', async () => {
      const user = userEvent.setup();
      await renderLoaded();
      expect(screen.getByText('Not measured')).toBeInTheDocument();
      await user.click(screen.getByRole('tab', { name: 'Compliance' }));
      expect(screen.getAllByText('Not measured')).toHaveLength(1);
      // Only the inspection compliance has a measurement, so it is the only bar.
      expect(screen.getAllByRole('progressbar')).toHaveLength(1);
      expect(screen.getByText('3 of 5 scheduled inspections completed')).toBeInTheDocument();
      expect(screen.queryByText(/on time/)).toBeNull();
    });

    it('draws no inspection bar when no inspection was scheduled', async () => {
      const user = userEvent.setup();
      await renderLoaded({ inspectionComplianceRate: null, inspectionsDue: 0, inspectionsCompleted: 0 });
      await user.click(screen.getByRole('tab', { name: 'Compliance' }));
      expect(screen.queryAllByRole('progressbar')).toHaveLength(0);
      expect(screen.getByText('No inspections were scheduled in this period')).toBeInTheDocument();
    });
  });

  describe('what it links to', () => {
    it('has quick actions that lead to pages that exist, and none for pages that do not', async () => {
      await renderLoaded();
      expect(screen.getByRole('link', { name: 'Report Incident' })).toHaveAttribute('href', '/dashboard/health-safety/incidents/new');
      expect(screen.getByRole('link', { name: 'Report Hazard' })).toHaveAttribute('href', '/dashboard/health-safety/hazards?report=1');
      expect(screen.queryByText(/Schedule Inspection|Committee Schedule/)).toBeNull();
    });

    it('has no button that does nothing: the only button is Refresh', async () => {
      await renderLoaded({ criticalAlerts: 2 });
      const labels = screen.getAllByRole('button').map((button) => button.textContent?.trim());
      expect(labels).toEqual(['Refresh']);
    });

    it('sends critical alerts to the incident list, not to a dead "View Alerts" button', async () => {
      await renderLoaded({ criticalAlerts: 2 });
      expect(screen.getByText(/You have 2 critical safety alerts/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'View incidents' })).toHaveAttribute('href', '/dashboard/health-safety/incidents');
      expect(screen.queryByRole('button', { name: /view alerts/i })).toBeNull();
    });

    it('has no critical alert section when there is no critical alert', async () => {
      await renderLoaded({ criticalAlerts: 0 });
      expect(screen.queryByText(/critical safety alert/)).toBeNull();
      expect(screen.queryByRole('link', { name: 'View incidents' })).toBeNull();
    });
  });

  it('does not show one organization’s figures while another organization loads', async () => {
    const first = answerWith({ totalIncidents: 41 });
    const { rerender } = render(<HealthSafetyDashboard organizationId="org-1" />);
    expect(await screen.findByText('41')).toBeInTheDocument();
    expect(first).toHaveBeenCalledTimes(1);

    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal('fetch', vi.fn(async () => {
      await pending;
      return { ok: true, status: 200, json: async () => envelope({ ...metrics, totalIncidents: 7 }) };
    }));
    rerender(<HealthSafetyDashboard organizationId="org-2" />);
    expect(screen.queryByText('41')).toBeNull();
    expect(screen.getByText(/Loading health & safety dashboard/)).toBeInTheDocument();
    release();
    expect(await screen.findByText('7')).toBeInTheDocument();
  });
});

describe('HealthSafetyOverview', () => {
  it('keeps the incident report link and has no export button, because nothing exports', () => {
    answerWith();
    render(<HealthSafetyOverview />);
    expect(screen.getByRole('link', { name: /report incident/i })).toHaveAttribute('href', '/dashboard/health-safety/incidents/new');
    expect(screen.queryByRole('button', { name: /export/i })).toBeNull();
    expect(screen.queryByText(/exporting/i)).toBeNull();
  });
});
