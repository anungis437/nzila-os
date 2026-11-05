// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// Radix selects and tabs measure elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

const locale = vi.hoisted(() => ({ current: 'en-CA' }));
const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));
const sonner = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }));
const seen = vi.hoisted(() => ({
  hazardsList: [] as Array<Record<string, unknown>>,
  incidentList: [] as Array<Record<string, unknown>>,
  trendPeriods: [] as string[],
}));

vi.mock('sonner', () => ({ toast: sonner }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => locale.current }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams.current,
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));
vi.mock('@/lib/hooks/use-organization', () => ({ useOrganizationId: () => 'org-1' }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('@/components/health-safety', () => {
  const HazardsList = (props: Record<string, unknown>) => {
    seen.hazardsList.push(props);
    return <div data-testid="hazards-list" />;
  };
  HazardsList.displayName = 'HazardsList';

  const HazardReportForm = ({ onSubmit }: { onSubmit: (data: Record<string, unknown>) => Promise<void> }) => {
    const [failure, setFailure] = React.useState('');
    const send = () => {
      onSubmit({
        hazardType: 'fire',
        priority: 'high',
        location: 'Loading dock',
        description: 'Oily rags are piled against the breaker panel on the loading dock',
        potentialConsequences: 'A fire could start and block the only exit',
        recommendedAction: '',
        reporterName: 'Ada Lovelace',
        reporterContact: 'ada@union.example',
        isAnonymous: false,
      }).catch((error: unknown) => setFailure(error instanceof Error ? error.message : 'failed'));
    };
    return (
      <div data-testid="hazard-report-form">
        <button type="button" onClick={send}>submit-hazard</button>
        {failure !== '' && <p data-testid="form-failure">{failure}</p>}
      </div>
    );
  };
  HazardReportForm.displayName = 'HazardReportForm';

  const IncidentListTable = (props: Record<string, unknown>) => {
    seen.incidentList.push(props);
    return <div data-testid="incident-list-table" />;
  };
  IncidentListTable.displayName = 'IncidentListTable';

  const IncidentTrendChart = ({ period }: { period: string }) => {
    seen.trendPeriods.push(period);
    return <div data-testid="incident-trend-chart" />;
  };
  IncidentTrendChart.displayName = 'IncidentTrendChart';

  const InspectionScheduleCalendar = ({ onViewInspection, onScheduleInspection }: { onViewInspection?: (id: string) => void; onScheduleInspection?: () => void }) => (
    <div data-testid="inspection-calendar">
      {onViewInspection && <button type="button" onClick={() => onViewInspection('insp-7')}>open-inspection-7</button>}
      {onScheduleInspection && <button type="button">schedule-inspection</button>}
    </div>
  );
  InspectionScheduleCalendar.displayName = 'InspectionScheduleCalendar';

  const InspectionReportViewer = ({ inspectionId }: { inspectionId: string }) => <div data-testid="report-viewer">{inspectionId}</div>;
  InspectionReportViewer.displayName = 'InspectionReportViewer';

  const InspectionFindingsCard = ({ finding, onViewDetails }: { finding: { id: string; title: string; date: Date }; onViewDetails?: (id: string) => void }) => (
    <div data-testid="finding">
      <span>{finding.title}</span>
      <span data-testid="finding-date-type">{finding.date instanceof Date ? 'Date' : typeof finding.date}</span>
      {onViewDetails && <button type="button" onClick={() => onViewDetails(finding.id)}>{`view-report-${finding.id}`}</button>}
    </div>
  );
  InspectionFindingsCard.displayName = 'InspectionFindingsCard';

  return {
    HazardsList,
    HazardReportForm,
    IncidentListTable,
    IncidentTrendChart,
    InspectionScheduleCalendar,
    InspectionReportViewer,
    InspectionFindingsCard,
  };
});

import HazardsPage from '../hazards/page';
import InspectionsPage from '../inspections/page';
import IncidentsPage from '../incidents/page';

interface Answer {
  status: number;
  body: unknown;
}
interface Call {
  method: string;
  url: string;
  body: unknown;
}

const envelope = (data: unknown) => ({ success: true, data, timestamp: '2026-03-04T00:00:00.000Z' });
const ok = (data: unknown): Answer => ({ status: 200, body: envelope(data) });
const refused = (status: number, message: string): Answer => ({ status, body: { code: 'REFUSED', message, timestamp: '2026-03-04T00:00:00.000Z' } });

const calls: Call[] = [];
const routes = new Map<string, () => Answer>();
const requestedUrls = () => calls.map((call) => call.url);

beforeEach(() => {
  calls.length = 0;
  routes.clear();
  seen.hazardsList.length = 0;
  seen.incidentList.length = 0;
  seen.trendPeriods.length = 0;
  Object.values(sonner).forEach((fn) => fn.mockClear());
  locale.current = 'en-CA';
  searchParams.current = new URLSearchParams();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const answer = routes.get(`${method} ${url.split('?')[0]}`);
    if (!answer) throw new Error(`unexpected request ${method} ${url}`);
    const { status, body } = answer();
    return new Response(JSON.stringify(body), { status });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const HAZARD_STATS = 'GET /api/health-safety/hazards/stats';
const INCIDENT_STATS = 'GET /api/health-safety/incidents/stats';
const INSPECTION_STATS = 'GET /api/health-safety/inspections/stats';
const INSPECTION_FINDINGS = 'GET /api/health-safety/inspections/findings';

describe('hazards page', () => {
  const stats = { total: 7, open: 4, inProgress: 2, resolved: 1, critical: 3, avgResolutionTime: 12.5 };

  it('shows the figures the stats route sends (its data is inside the withApi envelope), not zeros', async () => {
    routes.set(HAZARD_STATS, () => ok(stats));
    render(<HazardsPage />);
    expect(await screen.findByText('12.5')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    // The organization is the caller's own: it is not sent.
    expect(requestedUrls()).toEqual(['/api/health-safety/hazards/stats']);
  });

  it('shows an average resolution time that is unknown as a dash, and a count that really is 0 as 0', async () => {
    routes.set(HAZARD_STATS, () => ok({ ...stats, critical: 0, avgResolutionTime: null }));
    render(<HazardsPage />);
    await waitFor(() => expect(screen.getAllByText('—')).toHaveLength(1));
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows failed statistics as dashes with an alert, never as zeros, and recovers on retry', async () => {
    const user = userEvent.setup();
    routes.set(HAZARD_STATS, () => refused(500, 'Failed to load hazard statistics'));
    render(<HazardsPage />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The statistics could not be loaded');
    expect(alert).toHaveTextContent('Failed to load hazard statistics');
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('0')).toBeNull();

    routes.set(HAZARD_STATS, () => ok(stats));
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('12.5')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats a stats body that is not the route’s as an error, not as zeros', async () => {
    routes.set(HAZARD_STATS, () => ok({ total: 'many' }));
    render(<HazardsPage />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('speaks French in its alert when the locale is French', async () => {
    locale.current = 'fr-CA';
    routes.set(HAZARD_STATS, () => refused(500, 'boom'));
    render(<HazardsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('n’ont pas pu être chargées');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('has the list, the report button, and no corrective-action tab, export, or search and filters that filter nothing', async () => {
    routes.set(HAZARD_STATS, () => ok(stats));
    render(<HazardsPage />);
    expect(await screen.findByTestId('hazards-list')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reportHazardButton/ })).toBeInTheDocument();
    expect(screen.queryByText(/correctiveActions/i)).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('button', { name: /exportButton/ })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByPlaceholderText('searchPlaceholder')).toBeNull();
    expect(requestedUrls().join(' ')).not.toContain('corrective-actions');
    expect(sonner.info).not.toHaveBeenCalled();
  });

  it('lists hazards without a way to open one, because no hazard page exists', async () => {
    routes.set(HAZARD_STATS, () => ok(stats));
    render(<HazardsPage />);
    await screen.findByTestId('hazards-list');
    expect(seen.hazardsList.length).toBeGreaterThan(0);
    for (const props of seen.hazardsList) expect(props.onViewDetails).toBeUndefined();
  });

  describe('reporting a hazard', () => {
    it('opens the report form from the Report Hazard button', async () => {
      const user = userEvent.setup();
      routes.set(HAZARD_STATS, () => ok(stats));
      render(<HazardsPage />);
      await user.click(await screen.findByRole('button', { name: /reportHazardButton/ }));
      expect(await screen.findByTestId('hazard-report-form')).toBeInTheDocument();
    });

    it('opens the report form straight away with ?report=1, which is where the dashboard’s Report Hazard action goes', async () => {
      searchParams.current = new URLSearchParams('report=1');
      routes.set(HAZARD_STATS, () => ok(stats));
      render(<HazardsPage />);
      expect(await screen.findByTestId('hazard-report-form')).toBeInTheDocument();
      expect(screen.queryByTestId('hazards-list')).toBeNull();
    });

    it('posts the form’s fields to the hazards route without an organization or blank fields, then closes the form and reads the figures again', async () => {
      const user = userEvent.setup();
      searchParams.current = new URLSearchParams('report=1');
      routes.set(HAZARD_STATS, () => ok(stats));
      routes.set('POST /api/health-safety/hazards', () => ok({ data: { id: 'haz-1' } }));
      render(<HazardsPage />);
      await user.click(await screen.findByRole('button', { name: 'submit-hazard' }));

      await screen.findByTestId('hazards-list');
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.url).toBe('/api/health-safety/hazards');
      expect(post?.body).toEqual({
        hazardType: 'fire',
        priority: 'high',
        location: 'Loading dock',
        description: 'Oily rags are piled against the breaker panel on the loading dock',
        potentialConsequences: 'A fire could start and block the only exit',
        reporterName: 'Ada Lovelace',
        reporterContact: 'ada@union.example',
        isAnonymous: false,
      });
      expect(post?.body).not.toHaveProperty('organizationId');
      expect(post?.body).not.toHaveProperty('recommendedAction');
      expect(sonner.success).toHaveBeenCalledWith('Hazard report submitted successfully');
      await waitFor(() => expect(calls.filter((call) => call.url === '/api/health-safety/hazards/stats')).toHaveLength(2));
    });

    it('gives the route’s refusal to the form and keeps it open, instead of reporting success', async () => {
      const user = userEvent.setup();
      searchParams.current = new URLSearchParams('report=1');
      routes.set(HAZARD_STATS, () => ok(stats));
      routes.set('POST /api/health-safety/hazards', () => refused(403, "Requires at least 'health_safety_rep' role"));
      render(<HazardsPage />);
      await user.click(await screen.findByRole('button', { name: 'submit-hazard' }));

      expect(await screen.findByTestId('form-failure')).toHaveTextContent("Requires at least 'health_safety_rep' role");
      expect(screen.getByTestId('hazard-report-form')).toBeInTheDocument();
      expect(sonner.success).not.toHaveBeenCalled();
    });
  });
});

describe('incidents page', () => {
  const stats = { total: 9, reported: 3, investigating: 2, resolved: 0, closed: 4, avgResolutionTime: 6.5 };

  it('shows the figures the stats route sends for the period, not zeros, and asks for the 30-day period by default', async () => {
    routes.set(INCIDENT_STATS, () => ok(stats));
    render(<IncidentsPage />);
    expect(await screen.findByText('6.5')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('totalIncidents')).toBeInTheDocument();
    expect(requestedUrls()).toEqual(['/api/health-safety/incidents/stats?period=30d']);
  });

  it('counts closed incidents, because no route resolves one: there is no Resolved figure', async () => {
    routes.set(INCIDENT_STATS, () => ok(stats));
    render(<IncidentsPage />);
    await screen.findByText('6.5');
    expect(screen.getAllByText('closed').length).toBeGreaterThan(0);
    expect(screen.queryByText('resolved')).toBeNull();
  });

  it('shows an average resolution time that is unknown as a dash, never as 0', async () => {
    routes.set(INCIDENT_STATS, () => ok({ ...stats, closed: 0, avgResolutionTime: null }));
    render(<IncidentsPage />);
    await waitFor(() => expect(screen.getAllByText('—')).toHaveLength(1));
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('shows failed statistics as dashes with an alert, never as zeros, and recovers on retry', async () => {
    const user = userEvent.setup();
    routes.set(INCIDENT_STATS, () => refused(500, 'Failed to load incident statistics'));
    render(<IncidentsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load incident statistics');
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('0')).toBeNull();

    routes.set(INCIDENT_STATS, () => ok(stats));
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('6.5')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reads the statistics again for the period the user picks, and draws the trend for it', async () => {
    const user = userEvent.setup();
    routes.set(INCIDENT_STATS, () => ok(stats));
    render(<IncidentsPage />);
    await screen.findByText('6.5');

    await user.click(screen.getByRole('combobox', { name: 'dateRangePlaceholder' }));
    await user.click(await screen.findByRole('option', { name: 'last7Days' }));
    await waitFor(() => expect(requestedUrls()).toContain('/api/health-safety/incidents/stats?period=7d'));
    await user.click(screen.getByRole('tab', { name: /trendsTab/ }));
    await waitFor(() => expect(seen.trendPeriods).toContain('7d'));
  });

  it('has one selector, the period that really applies, and no search or filters that filter nothing, and no way to open an incident', async () => {
    routes.set(INCIDENT_STATS, () => ok(stats));
    render(<IncidentsPage />);
    expect(await screen.findByTestId('incident-list-table')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.queryByPlaceholderText('searchPlaceholder')).toBeNull();
    expect(screen.queryByRole('button', { name: /exportButton/ })).toBeNull();
    for (const props of seen.incidentList) expect(props.onViewDetails).toBeUndefined();
  });

  it('keeps incident reporting', async () => {
    routes.set(INCIDENT_STATS, () => ok(stats));
    render(<IncidentsPage />);
    expect(await screen.findByRole('link', { name: /reportIncidentButton/ })).toHaveAttribute('href', '/dashboard/health-safety/incidents/new');
  });
});

describe('inspections page', () => {
  const stats = { total: 10, scheduled: 3, completed: 6, overdue: 1, complianceRate: 82.5, avgScore: 88 };
  const finding = {
    id: 'insp-9',
    title: 'Warehouse walk-through',
    date: '2026-02-20T15:00:00.000Z',
    location: 'Warehouse',
    inspector: 'Grace Hopper',
    complianceRate: 90,
    passCount: 9,
    failCount: 1,
    naCount: 0,
    criticalIssues: 0,
    status: 'completed',
  };

  function answerAll(overrides: { stats?: Answer; findings?: Answer } = {}) {
    routes.set(INSPECTION_STATS, () => overrides.stats ?? ok(stats));
    routes.set(INSPECTION_FINDINGS, () => overrides.findings ?? ok({ findings: [finding] }));
  }

  it('shows the figures the stats route sends, and says what the compliance rate is', async () => {
    answerAll();
    render(<InspectionsPage />);
    expect(await screen.findByText('82.5%')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('scheduled: 3 · completed: 6')).toBeInTheDocument();
    expect(screen.getByText('Checklist items passed')).toBeInTheDocument();
    expect(screen.queryByText('onTimeCompletion')).toBeNull();
  });

  it('shows a rate and an average that were never measured as dashes, not as 0%', async () => {
    answerAll({ stats: ok({ ...stats, complianceRate: null, avgScore: null }) });
    render(<InspectionsPage />);
    await waitFor(() => expect(screen.getAllByText('—')).toHaveLength(2));
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.queryByText('%')).toBeNull();
  });

  it('shows failed statistics as dashes with an alert, never as zeros', async () => {
    answerAll({ stats: refused(500, 'Failed to load inspection statistics') });
    render(<InspectionsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load inspection statistics');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText('0')).toBeNull();
  });

  it('has no Schedule Inspection button (its page does not exist), no export, and no search or filters that filter nothing', async () => {
    answerAll();
    render(<InspectionsPage />);
    await screen.findByText('82.5%');
    expect(screen.queryByRole('button', { name: /scheduleInspectionButton/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /exportButton/ })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByPlaceholderText('searchPlaceholder')).toBeNull();
    expect(requestedUrls().join(' ')).not.toContain('/inspections/new');
  });

  it('lists the findings the route sends (inside the envelope), with real dates', async () => {
    const user = userEvent.setup();
    answerAll();
    render(<InspectionsPage />);
    await user.click(await screen.findByRole('tab', { name: /findingsTab/ }));
    expect(await screen.findByText('Warehouse walk-through')).toBeInTheDocument();
    expect(screen.getByTestId('finding-date-type')).toHaveTextContent('Date');
    expect(screen.queryByText('noFindingsMessage')).toBeNull();
  });

  it('says there are no findings only when the route sends none', async () => {
    const user = userEvent.setup();
    answerAll({ findings: ok({ findings: [] }) });
    render(<InspectionsPage />);
    await user.click(await screen.findByRole('tab', { name: /findingsTab/ }));
    expect(await screen.findByText('noFindingsMessage')).toBeInTheDocument();
  });

  it('shows findings that could not be loaded as an error with a retry, not as "no findings"', async () => {
    const user = userEvent.setup();
    answerAll({ findings: refused(500, 'Failed to load findings') });
    render(<InspectionsPage />);
    await user.click(await screen.findByRole('tab', { name: /findingsTab/ }));
    const alert = await screen.findByText('The findings could not be loaded.');
    expect(alert.closest('[role="alert"]')).toHaveTextContent('Failed to load findings');
    expect(screen.queryByText('noFindingsMessage')).toBeNull();

    routes.set(INSPECTION_FINDINGS, () => ok({ findings: [finding] }));
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Warehouse walk-through')).toBeInTheDocument();
  });

  it('opens the report of a finding in the list view when its View Full Report button is used', async () => {
    const user = userEvent.setup();
    answerAll();
    render(<InspectionsPage />);
    await user.click(await screen.findByRole('tab', { name: /findingsTab/ }));
    await user.click(await screen.findByRole('button', { name: 'view-report-insp-9' }));
    expect(await screen.findByTestId('report-viewer')).toHaveTextContent('insp-9');
  });

  it('opens an inspection chosen on the calendar in the list view, where its report is', async () => {
    const user = userEvent.setup();
    answerAll();
    render(<InspectionsPage />);
    await user.click(await screen.findByRole('button', { name: 'open-inspection-7' }));
    expect(await screen.findByTestId('report-viewer')).toHaveTextContent('insp-7');
    expect(screen.queryByText('selectInspectionMessage')).toBeNull();
  });

  it('does not offer scheduling from the calendar either', async () => {
    answerAll();
    render(<InspectionsPage />);
    await screen.findByTestId('inspection-calendar');
    expect(screen.queryByRole('button', { name: 'schedule-inspection' })).toBeNull();
  });
});
