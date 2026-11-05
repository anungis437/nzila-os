// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next-intl', () => ({ useLocale: () => 'en-CA', useTranslations: () => (key: string) => key }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('@/components/ui/loading-skeleton-composer', () => ({ LoadingSkeletonComposer: () => <div>skeleton</div> }));
vi.mock('@/components/leadership/kpi-cards', () => ({ KpiCards: () => <div>kpi-cards</div> }));
vi.mock('@/components/leadership/grievance-trends-chart', () => ({ GrievanceTrendsChart: () => <div>trends</div> }));
vi.mock('@/components/leadership/steward-capacity-chart', () => ({ StewardCapacityChart: () => <div>stewards</div> }));
vi.mock('@/components/leadership/compliance-summary-card', () => ({ ComplianceSummaryCard: () => <div>compliance</div> }));
vi.mock('@/components/leadership/leadership-export', () => ({ LeadershipExport: () => <div>export</div> }));
// The real table draws a "view" control only when it is given a handler for it.
vi.mock('@/components/leadership/employer-hotspots-table', () => ({
  EmployerHotspotsTable: ({ employers, onViewEmployer }: { employers: Array<{ employerId: string; employerName: string }>; onViewEmployer?: (id: string) => void }) => (
    <div>
      {employers.map((employer) => (
        <span key={employer.employerId}>{employer.employerName}</span>
      ))}
      {onViewEmployer ? <button type="button">view-employer</button> : null}
    </div>
  ),
}));

import LeadershipPage from '../page';

const metrics = {
  kpi: { activeGrievances: 4, resolvedThisMonth: 2, avgTriageDays: 1.5, avgResolutionDays: 9, arbitrationCount: 1, overdueCases: 0, previousPeriod: null },
  employers: [{ employerId: 'emp-1', employerName: 'Acme Corp', activeGrievances: 3, overdueCases: 0, resolvedThisQuarter: 1, topCategory: 'wages', avgResolutionDays: 8, trend: 'flat' }],
  trends: [],
  categories: [],
  stewards: [],
  compliance: { metrics: {}, alerts: [] },
};

// The route answers { success, data: metrics, timestamp } (standardSuccessResponse).
const ok = (data: unknown) => ({ status: 200, body: { success: true, data, timestamp: '2026-03-04T00:00:00.000Z' } });

interface Answer {
  status: number;
  body: unknown;
}

let answer: Answer;

beforeEach(() => {
  answer = ok(metrics);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('leadership page', () => {
  it('shows the employer hotspots without a control that opens an employer page, because there is none', async () => {
    render(<LeadershipPage />);
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByText('view-employer')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('says why the dashboard could not be read, with the route\'s own reason, and offers a retry', async () => {
    answer = { status: 403, body: { code: 'FORBIDDEN', message: 'Requires officer role or above' } };
    const user = userEvent.setup();
    render(<LeadershipPage />);
    expect(await screen.findByText('Requires officer role or above')).toBeInTheDocument();

    answer = ok(metrics);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
  });

  it.each([
    ['a body with no data', { success: true }],
    ['data that lacks the employers', { success: true, data: { ...metrics, employers: undefined } }],
    ['data that lacks the compliance summary', { success: true, data: { ...metrics, compliance: undefined } }],
    ['metrics that are not wrapped in the envelope', metrics],
  ])('treats %s as an error instead of drawing a half-empty dashboard', async (_label, body) => {
    answer = { status: 200, body };
    render(<LeadershipPage />);
    expect(await screen.findByText('Dashboard unavailable')).toBeInTheDocument();
    expect(screen.getByText(/cannot read/)).toBeInTheDocument();
    expect(screen.queryByText('kpi-cards')).toBeNull();
  });
});
