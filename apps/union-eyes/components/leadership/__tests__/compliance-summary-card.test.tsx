// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

import { ComplianceSummaryCard } from '../compliance-summary-card';

// DEF-0B6-CMP-LEADERSHIP-COMPLIANCE-DEFAULTS-TO-100-AND-TRUNCATES: an unmeasured compliance summary reads as not measured, never as
// 0 open alerts, a 0-day response or 100%.
describe('ComplianceSummaryCard', () => {
  afterEach(cleanup);

  it('shows every unmeasured figure as a dash and states why', () => {
    render(
      <ComplianceSummaryCard
        metrics={{ deadlineAdherence: null, avgResponseTime: null, documentationRate: null, openAlerts: null }}
        alerts={[]}
        measurement={{ status: 'not_measured', reason: 'Not measured: nothing records compliance alerts.' }}
      />,
    );
    expect(screen.getByTestId('compliance-not-measured').textContent).toBe('Not measured: nothing records compliance alerts.');
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('0d')).toBeNull();
    expect(screen.queryByText('100%')).toBeNull();
  });

  it('shows measured figures as they are', () => {
    render(
      <ComplianceSummaryCard
        metrics={{ deadlineAdherence: 80, avgResponseTime: 3, documentationRate: 50, openAlerts: 2 }}
        alerts={[]}
        measurement={{ status: 'measured', reason: null }}
      />,
    );
    expect(screen.queryByTestId('compliance-not-measured')).toBeNull();
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByText('3d')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });
});
