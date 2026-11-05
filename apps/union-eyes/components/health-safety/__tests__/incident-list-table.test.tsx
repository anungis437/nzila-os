// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import '@testing-library/jest-dom/vitest';

// Radix selects measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { IncidentListTable } from '../IncidentListTable';

interface Answer {
  status: number;
  body: unknown;
}

const incident = (overrides: Record<string, unknown> = {}) => ({
  id: 'inc-1',
  organizationId: 'org-1',
  incidentNumber: 'INC-2026-0001',
  incidentType: 'near_miss',
  severity: 'serious',
  status: 'reported',
  incidentDate: '2026-02-03T14:00:00.000Z',
  reportedDate: '2026-02-03T16:00:00.000Z',
  locationDescription: 'Loading dock',
  description: 'A pallet fell',
  reportedByName: 'Ada Lovelace',
  isAnonymous: false,
  ...overrides,
});

// What a CRUD-factory list sends: { data: rows, pagination } inside withApi's { success, data, timestamp } envelope.
const list = (rows: unknown[], page = 1, totalPages = 1): Answer => ({
  status: 200,
  body: { success: true, data: { data: rows, pagination: { page, limit: 10, total: rows.length, totalPages } }, timestamp: '2026-03-04T00:00:00.000Z' },
});

const requested: string[] = [];
let answer: (url: string) => Answer | Promise<Answer>;

beforeEach(() => {
  requested.length = 0;
  answer = () => list([incident()]);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requested.push(url);
    const { status, body } = await answer(url);
    return new Response(JSON.stringify(body), { status });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const lastUrl = () => requested[requested.length - 1];
const optionNames = async (user: ReturnType<typeof userEvent.setup>, trigger: string) => {
  await user.click(screen.getByRole('combobox', { name: trigger }));
  return (await screen.findAllByRole('option')).map((option) => option.textContent);
};

describe('IncidentListTable: what it shows', () => {
  it('asks for the first page with no filter, and shows each incident as stored', async () => {
    render(<IncidentListTable organizationId="org-1" />);
    const row = (await screen.findByText('INC-2026-0001')).closest('tr') as HTMLElement;
    expect(requested).toEqual(['/api/health-safety/incidents?page=1&limit=10']);
    expect(within(row).getByText('near miss')).toBeInTheDocument();
    expect(within(row).getByText('serious')).toBeInTheDocument();
    expect(within(row).getByText('Reported')).toBeInTheDocument();
    expect(within(row).getByText('Loading dock')).toBeInTheDocument();
    expect(within(row).getByText('Ada Lovelace')).toBeInTheDocument();
    expect(within(row).getByText(format(new Date('2026-02-03T14:00:00.000Z'), 'MMM dd, yyyy'))).toBeInTheDocument();
  });

  it('labels a reported incident Reported, not Pending, and a status it does not know as stored', async () => {
    answer = () => list([incident({ id: 'a', incidentNumber: 'INC-A', status: 'reported' }), incident({ id: 'b', incidentNumber: 'INC-B', status: 'awaiting_union' })]);
    render(<IncidentListTable organizationId="org-1" />);
    const rowA = (await screen.findByText('INC-A')).closest('tr') as HTMLElement;
    const rowB = screen.getByText('INC-B').closest('tr') as HTMLElement;
    expect(within(rowA).getByText('Reported')).toBeInTheDocument();
    expect(within(rowB).getByText('awaiting union')).toBeInTheDocument();
    expect(screen.queryByText('Pending')).toBeNull();
  });

  it('says Anonymous for an anonymous report, a dash when nobody is named, and the name otherwise', async () => {
    answer = () => list([
      incident({ id: 'a', incidentNumber: 'INC-A', isAnonymous: true, reportedByName: null }),
      incident({ id: 'b', incidentNumber: 'INC-B', isAnonymous: false, reportedByName: null }),
    ]);
    render(<IncidentListTable organizationId="org-1" />);
    const rowA = (await screen.findByText('INC-A')).closest('tr') as HTMLElement;
    const rowB = screen.getByText('INC-B').closest('tr') as HTMLElement;
    expect(within(rowA).getByText('Anonymous')).toBeInTheDocument();
    expect(within(rowB).getByText('—')).toBeInTheDocument();
  });

  it('says so when there are no incidents, and shows no error', async () => {
    answer = () => list([], 1, 0);
    render(<IncidentListTable organizationId="org-1" />);
    expect(await screen.findByText('No incidents found')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('IncidentListTable: filters use the values the routes store', () => {
  it('offers the stored severities, so that no choice is refused with a 400 ("major" is not one)', async () => {
    const user = userEvent.setup();
    render(<IncidentListTable organizationId="org-1" />);
    await screen.findByText('INC-2026-0001');
    expect(await optionNames(user, 'Severity')).toEqual(['All Severity', 'Near miss', 'Minor', 'Moderate', 'Serious', 'Critical', 'Fatal']);
    await user.keyboard('{Escape}');
    expect(await optionNames(user, 'Status')).toEqual(['All Status', 'Reported', 'Investigating', 'Resolved', 'Closed']);
  });

  it('sends the stored severity when filtering by severity, and the stored status when filtering by status', async () => {
    const user = userEvent.setup();
    render(<IncidentListTable organizationId="org-1" />);
    await screen.findByText('INC-2026-0001');
    await user.click(screen.getByRole('combobox', { name: 'Severity' }));
    await user.click(await screen.findByRole('option', { name: 'Serious' }));
    await waitFor(() => expect(lastUrl()).toBe('/api/health-safety/incidents?page=1&limit=10&severity=serious'));

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Closed' }));
    await waitFor(() => expect(lastUrl()).toBe('/api/health-safety/incidents?page=1&limit=10&status=closed&severity=serious'));
  });

  it('sends what is typed as the search', async () => {
    const user = userEvent.setup();
    render(<IncidentListTable organizationId="org-1" />);
    await screen.findByText('INC-2026-0001');
    await user.type(screen.getByPlaceholderText('Search incidents...'), 'pallet');
    await waitFor(() => expect(lastUrl()).toBe('/api/health-safety/incidents?page=1&limit=10&search=pallet'));
  });
});

describe('IncidentListTable: paging', () => {
  it('shows the page and moves through the pages of the list', async () => {
    const user = userEvent.setup();
    answer = (url) => list([incident({ incidentNumber: url.includes('page=2') ? 'INC-PAGE-2' : 'INC-PAGE-1' })], url.includes('page=2') ? 2 : 1, 2);
    render(<IncidentListTable organizationId="org-1" />);
    expect(await screen.findByText('INC-PAGE-1')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('INC-PAGE-2')).toBeInTheDocument();
    expect(lastUrl()).toBe('/api/health-safety/incidents?page=2&limit=10');
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();
  });
});

describe('IncidentListTable: opening an incident', () => {
  it('has no Actions column and no View button when the host gave it nowhere to go', async () => {
    render(<IncidentListTable organizationId="org-1" />);
    await screen.findByText('INC-2026-0001');
    expect(screen.queryByRole('button', { name: /View/ })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
  });

  it('opens the incident from its View button', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    render(<IncidentListTable organizationId="org-1" onViewDetails={onViewDetails} />);
    await user.click(await screen.findByRole('button', { name: /View/ }));
    expect(onViewDetails).toHaveBeenCalledWith('inc-1');
  });
});

describe('IncidentListTable: when the list cannot be had', () => {
  it('shows the route’s refusal as an error with a retry, not as "No incidents found"', async () => {
    const user = userEvent.setup();
    answer = () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'health_safety_rep' role" } });
    render(<IncidentListTable organizationId="org-1" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The incidents could not be loaded.');
    expect(alert).toHaveTextContent("Requires at least 'health_safety_rep' role");
    expect(screen.queryByText('No incidents found')).toBeNull();

    answer = () => list([incident()]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('INC-2026-0001')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['a row without its severity', { status: 200, body: { success: true, data: { data: [incident({ severity: undefined })], pagination: { totalPages: 1 } } } }],
    ['a row without its status', { status: 200, body: { success: true, data: { data: [incident({ status: null })], pagination: { totalPages: 1 } } } }],
    ['a row with an incident date that is not a date', { status: 200, body: { success: true, data: { data: [incident({ incidentDate: 'later' })], pagination: { totalPages: 1 } } } }],
    ['rows directly under data', { status: 200, body: { success: true, data: [incident()] } }],
    ['no pagination', { status: 200, body: { success: true, data: { data: [incident()] } } }],
  ])('treats %s as an error, never as a table with invented values', async (_label, reply) => {
    answer = () => reply;
    render(<IncidentListTable organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('INC-2026-0001')).toBeNull();
    expect(screen.queryByText('No incidents found')).toBeNull();
  });
});

describe('IncidentListTable: another organization', () => {
  it('does not show the previous organization’s incidents while the new one loads', async () => {
    const { rerender } = render(<IncidentListTable organizationId="org-1" />);
    expect(await screen.findByText('INC-2026-0001')).toBeInTheDocument();

    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    answer = async () => {
      await pending;
      return list([incident({ id: 'inc-2', incidentNumber: 'INC-ORG-2' })]);
    };
    rerender(<IncidentListTable organizationId="org-2" />);
    expect(screen.queryByText('INC-2026-0001')).toBeNull();
    release();
    expect(await screen.findByText('INC-ORG-2')).toBeInTheDocument();
  });
});
