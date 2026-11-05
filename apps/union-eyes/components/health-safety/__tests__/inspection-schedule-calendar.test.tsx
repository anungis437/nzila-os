// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { InspectionScheduleCalendar } from '../InspectionScheduleCalendar';

interface Answer {
  status: number;
  body: unknown;
}

// The inspections are drawn on the current month's calendar, so their dates are this month's.
const today = new Date();
const dayOfThisMonth = (day: number) => new Date(today.getFullYear(), today.getMonth(), day, 12, 0, 0).toISOString();

const inspection = (overrides: Record<string, unknown> = {}) => ({
  id: 'insp-1',
  organizationId: 'org-1',
  inspectionNumber: 'INS-2026-0001',
  inspectionType: 'routine',
  status: 'scheduled',
  scheduledDate: dayOfThisMonth(10),
  ...overrides,
});

// What a CRUD-factory list sends: { data: rows, pagination } inside withApi's { success, data, timestamp } envelope.
const list = (rows: unknown[], page = 1, totalPages = 1): Answer => ({
  status: 200,
  body: { success: true, data: { data: rows, pagination: { page, limit: 100, total: rows.length, totalPages } }, timestamp: '2026-03-04T00:00:00.000Z' },
});

const requested: string[] = [];
let answer: (url: string) => Answer | Promise<Answer>;

beforeEach(() => {
  requested.length = 0;
  answer = () => list([inspection()]);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requested.push(url);
    const { status, body } = await answer(url);
    return new Response(JSON.stringify(body), { status });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InspectionScheduleCalendar', () => {
  it('reads every inspection once (the route cannot filter by date) and draws each on its day', async () => {
    answer = (url) => (url.includes('page=2') ? list([inspection({ id: 'insp-2', inspectionNumber: 'INS-2026-0002', inspectionType: 'post_incident', scheduledDate: dayOfThisMonth(20) })], 2, 2) : list([inspection()], 1, 2));
    render(<InspectionScheduleCalendar organizationId="org-1" />);
    expect(await screen.findByText('INS-2026-0001 · routine')).toBeInTheDocument();
    expect(screen.getByText('INS-2026-0002 · post incident')).toBeInTheDocument();
    expect(requested).toEqual(['/api/health-safety/inspections?limit=100&page=1', '/api/health-safety/inspections?limit=100&page=2']);
    expect(requested.join(' ')).not.toContain('startDate');
  });

  it('draws an inspection of another month when that month is shown, without asking again', async () => {
    const user = userEvent.setup();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 15, 12, 0, 0).toISOString();
    answer = () => list([inspection(), inspection({ id: 'insp-3', inspectionNumber: 'INS-NEXT', scheduledDate: nextMonth })]);
    render(<InspectionScheduleCalendar organizationId="org-1" />);
    await screen.findByText('INS-2026-0001 · routine');
    expect(screen.queryByText(/INS-NEXT/)).toBeNull();

    // Next month's button is the last of the three navigation buttons.
    const navigation = screen.getAllByRole('button');
    await user.click(navigation[2]);
    expect(await screen.findByText('INS-NEXT · routine')).toBeInTheDocument();
    expect(requested).toHaveLength(1);
  });

  it('makes an inspection a button only where the host can open it', async () => {
    const user = userEvent.setup();
    const onViewInspection = vi.fn();
    const { unmount } = render(<InspectionScheduleCalendar organizationId="org-1" />);
    const plain = await screen.findByText('INS-2026-0001 · routine');
    expect(plain.closest('button')).toBeNull();
    unmount();

    render(<InspectionScheduleCalendar organizationId="org-1" onViewInspection={onViewInspection} />);
    const openable = (await screen.findByText('INS-2026-0001 · routine')).closest('button') as HTMLElement;
    expect(openable).not.toBeNull();
    await user.click(openable);
    expect(onViewInspection).toHaveBeenCalledWith('insp-1');
  });

  it('offers Schedule only when the host can schedule', async () => {
    const { unmount } = render(<InspectionScheduleCalendar organizationId="org-1" />);
    await screen.findByText('INS-2026-0001 · routine');
    expect(screen.queryByRole('button', { name: /Schedule/ })).toBeNull();
    unmount();

    render(<InspectionScheduleCalendar organizationId="org-1" onScheduleInspection={() => {}} />);
    expect(await screen.findByRole('button', { name: /Schedule/ })).toBeInTheDocument();
  });

  it('has a legend entry for every status it colours', async () => {
    answer = () => list([inspection({ status: 'overdue' }), inspection({ id: 'insp-4', inspectionNumber: 'INS-4', status: 'requires_followup', scheduledDate: dayOfThisMonth(12) })]);
    render(<InspectionScheduleCalendar organizationId="org-1" />);
    await screen.findByText('INS-2026-0001 · routine');
    for (const label of ['Scheduled', 'In Progress', 'Completed', 'Needs follow-up', 'Overdue', 'Cancelled']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('shows a failed read as an error with the route’s message and a retry, not as an empty calendar', async () => {
    const user = userEvent.setup();
    answer = () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'member' role" } });
    render(<InspectionScheduleCalendar organizationId="org-1" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The inspection schedule could not be loaded.');
    expect(alert).toHaveTextContent("Requires at least 'member' role");
    expect(screen.queryByText('Scheduled')).toBeNull();

    answer = () => list([inspection()]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('INS-2026-0001 · routine')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['an inspection without its number', { inspectionNumber: undefined }],
    ['an inspection without its status', { status: '' }],
    ['an inspection whose date is not a date', { scheduledDate: 'sometime' }],
  ])('treats %s as an error, never as an inspection with an invented title, status or date', async (_label, overrides) => {
    answer = () => list([inspection(overrides)]);
    render(<InspectionScheduleCalendar organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/routine/)).toBeNull();
  });

  it('treats a body that is not a list as an error', async () => {
    answer = () => ({ status: 200, body: { success: true, data: [inspection()] } });
    render(<InspectionScheduleCalendar organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('keeps the calendar grid out of the error state', async () => {
    answer = () => ({ status: 500, body: {} });
    render(<InspectionScheduleCalendar organizationId="org-1" />);
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('Sun')).toBeNull();
  });
});
