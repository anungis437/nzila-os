// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

import { HazardPriorityBadge } from '../HazardPriorityBadge';
import { IncidentStatusBadge } from '../IncidentStatusBadge';
import { InspectionFindingsCard, type InspectionFinding } from '../InspectionFindingsCard';
import { SafetyMetricsCard } from '../SafetyMetricsCard';
import { ClipboardCheck } from 'lucide-react';

afterEach(cleanup);

describe('HazardPriorityBadge', () => {
  it.each([
    ['low', 'Low'],
    ['moderate', 'Moderate'],
    ['high', 'High'],
    ['critical', 'Critical'],
    ['extreme', 'Extreme'],
  ])('labels the stored level %s as %s', (level, label) => {
    render(<HazardPriorityBadge priority={level} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows a level it does not know as stored, not as Low', () => {
    render(<HazardPriorityBadge priority="catastrophic" />);
    expect(screen.getByText('catastrophic')).toBeInTheDocument();
    expect(screen.queryByText('Low')).toBeNull();
  });
});

describe('IncidentStatusBadge', () => {
  it.each([
    ['reported', 'Reported'],
    ['investigating', 'Investigating'],
    ['closed', 'Closed'],
    ['resolved', 'Resolved'],
  ])('labels the stored status %s as %s', (status, label) => {
    render(<IncidentStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows a status it does not know as stored, not as Pending', () => {
    render(<IncidentStatusBadge status="awaiting_union" />);
    expect(screen.getByText('awaiting union')).toBeInTheDocument();
    expect(screen.queryByText('Pending')).toBeNull();
  });
});

describe('InspectionFindingsCard', () => {
  const finding: InspectionFinding = {
    id: 'insp-9',
    title: 'Warehouse walk-through',
    date: new Date('2026-02-20T15:00:00.000Z'),
    location: 'Warehouse',
    inspector: 'Grace Hopper',
    complianceRate: 90,
    passCount: 9,
    failCount: 1,
    naCount: 0,
    criticalIssues: 0,
    status: 'completed',
  };

  it('has a View Full Report button only where the host can open the report, and it opens that report', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    const { unmount } = render(<InspectionFindingsCard finding={finding} />);
    expect(screen.queryByRole('button')).toBeNull();
    unmount();

    render(<InspectionFindingsCard finding={finding} onViewDetails={onViewDetails} />);
    await user.click(screen.getByRole('button', { name: 'View Full Report' }));
    expect(onViewDetails).toHaveBeenCalledWith('insp-9');
  });

  it('shows an unscored inspection as a dash with no progress bar, not as an empty bar', () => {
    render(<InspectionFindingsCard finding={{ ...finding, complianceRate: null }} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('draws the progress bar for a scored inspection', () => {
    render(<InspectionFindingsCard finding={finding} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('says the inspector was not recorded, and leaves no dangling separator when there is no location', () => {
    render(<InspectionFindingsCard finding={{ ...finding, inspector: '', location: '' }} />);
    expect(screen.getByText('Inspector: not recorded')).toBeInTheDocument();
    expect(screen.queryByText(/•/)).toBeNull();
  });
});

describe('SafetyMetricsCard trend', () => {
  it('shows the size of a change without its sign, and the direction through the arrow and the plus or minus it adds', () => {
    const { unmount } = render(<SafetyMetricsCard title="Incidents" value={4} trend="down" trendValue={-20} icon={ClipboardCheck} />);
    expect(screen.getByText('-20%')).toBeInTheDocument();
    unmount();
    render(<SafetyMetricsCard title="Incidents" value={4} trend="up" trendValue={35} icon={ClipboardCheck} />);
    expect(screen.getByText('+35%')).toBeInTheDocument();
  });

  it('says which way it went, without a percentage, when there was nothing to compare with', () => {
    const { unmount } = render(<SafetyMetricsCard title="Incidents" value={4} trend="up" trendValue={null} icon={ClipboardCheck} />);
    expect(screen.getByText('Up')).toBeInTheDocument();
    expect(screen.queryByText(/%/)).toBeNull();
    unmount();
    render(<SafetyMetricsCard title="Incidents" value={0} trend="stable" trendValue={null} icon={ClipboardCheck} />);
    expect(screen.getByText('No change')).toBeInTheDocument();
  });

  it('shows no trend line when the card has no trend value', () => {
    render(<SafetyMetricsCard title="Hazards" value={2} trend="up" icon={ClipboardCheck} />);
    expect(screen.queryByText('vs. last period')).toBeNull();
  });
});
