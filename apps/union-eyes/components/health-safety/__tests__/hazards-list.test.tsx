// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { format } from 'date-fns';
import '@testing-library/jest-dom/vitest';

// Radix selects measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { HazardsList } from '../HazardsList';

interface Answer {
  status: number;
  body: unknown;
}

const hazard = (overrides: Record<string, unknown> = {}) => ({
  id: 'haz-1',
  organizationId: 'org-1',
  reportNumber: 'HAZ-2026-0001',
  hazardCategory: 'working_at_heights',
  hazardLevel: 'high',
  status: 'reported',
  specificLocation: 'Roof of building B',
  hazardDescription: 'Unprotected edge on the roof',
  reportedDate: '2026-02-03T14:00:00.000Z',
  ...overrides,
});

// What a CRUD-factory list sends: { data: rows, pagination } inside withApi's { success, data, timestamp } envelope.
const list = (rows: unknown[], page = 1, totalPages = 1): Answer => ({
  status: 200,
  body: { success: true, data: { data: rows, pagination: { page, limit: 12, total: rows.length, totalPages } }, timestamp: '2026-03-04T00:00:00.000Z' },
});

const requested: string[] = [];
let answer: (url: string) => Answer | Promise<Answer>;

beforeEach(() => {
  requested.length = 0;
  answer = () => list([hazard()]);
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

describe('HazardsList: what it shows', () => {
  it('asks for the first page with no filter, and shows each hazard as stored', async () => {
    render(<HazardsList organizationId="org-1" />);
    expect(await screen.findByText('HAZ-2026-0001')).toBeInTheDocument();
    expect(requested).toEqual(['/api/health-safety/hazards?limit=12&page=1']);
    expect(screen.getByText('working at heights')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('reported')).toBeInTheDocument();
    expect(screen.getByText('Roof of building B')).toBeInTheDocument();
    expect(screen.getByText('Unprotected edge on the roof')).toBeInTheDocument();
    expect(screen.getByText(format(new Date('2026-02-03T14:00:00.000Z'), 'MMM dd, yyyy'))).toBeInTheDocument();
  });

  it('lists a hazard of any status by default: the filter does not start on a status no hazard has', async () => {
    answer = () => list([hazard({ id: 'a', reportNumber: 'HAZ-A', status: 'assigned' }), hazard({ id: 'b', reportNumber: 'HAZ-B', status: 'closed' })]);
    render(<HazardsList organizationId="org-1" />);
    expect(await screen.findByText('HAZ-A')).toBeInTheDocument();
    expect(screen.getByText('HAZ-B')).toBeInTheDocument();
    expect(requested[0]).not.toContain('status=');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('All Status');
  });

  it('shows an extreme hazard as Extreme, not as a lower level', async () => {
    answer = () => list([hazard({ hazardLevel: 'extreme' })]);
    render(<HazardsList organizationId="org-1" />);
    expect(await screen.findByText('Extreme')).toBeInTheDocument();
    expect(screen.queryByText('Low')).toBeNull();
  });

  it('says so when there are no hazards, and shows no error', async () => {
    answer = () => list([], 1, 0);
    render(<HazardsList organizationId="org-1" />);
    expect(await screen.findByText('No hazards found')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('HazardsList: filters use the values the routes store', () => {
  it('offers the five stored statuses and the five stored levels, not "open" or "medium"', async () => {
    const user = userEvent.setup();
    render(<HazardsList organizationId="org-1" />);
    await screen.findByText('HAZ-2026-0001');
    expect(await optionNames(user, 'Status')).toEqual(['All Status', 'Reported', 'Assessed', 'Assigned', 'Resolved', 'Closed']);
    await user.keyboard('{Escape}');
    expect(await optionNames(user, 'Priority')).toEqual(['All Priority', 'Extreme', 'Critical', 'High', 'Moderate', 'Low']);
  });

  it('sends the stored level when filtering by priority, and goes back to the first page', async () => {
    const user = userEvent.setup();
    render(<HazardsList organizationId="org-1" />);
    await screen.findByText('HAZ-2026-0001');
    await user.click(screen.getByRole('combobox', { name: 'Priority' }));
    await user.click(await screen.findByRole('option', { name: 'Moderate' }));
    await waitFor(() => expect(lastUrl()).toBe('/api/health-safety/hazards?limit=12&page=1&priority=moderate'));
  });

  it('sends the stored status when filtering by status', async () => {
    const user = userEvent.setup();
    render(<HazardsList organizationId="org-1" />);
    await screen.findByText('HAZ-2026-0001');
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Assigned' }));
    await waitFor(() => expect(lastUrl()).toBe('/api/health-safety/hazards?limit=12&page=1&status=assigned'));
  });

  it('sends what is typed as the search', async () => {
    const user = userEvent.setup();
    render(<HazardsList organizationId="org-1" />);
    await screen.findByText('HAZ-2026-0001');
    await user.type(screen.getByPlaceholderText('Search hazards...'), 'dock');
    await waitFor(() => expect(lastUrl()).toBe('/api/health-safety/hazards?limit=12&page=1&search=dock'));
  });
});

describe('HazardsList: paging', () => {
  it('shows the page and moves through the pages of the list', async () => {
    const user = userEvent.setup();
    answer = (url) => list([hazard({ reportNumber: url.includes('page=2') ? 'HAZ-PAGE-2' : 'HAZ-PAGE-1' })], url.includes('page=2') ? 2 : 1, 3);
    render(<HazardsList organizationId="org-1" />);
    expect(await screen.findByText('HAZ-PAGE-1')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Next/ }));
    expect(await screen.findByText('HAZ-PAGE-2')).toBeInTheDocument();
    expect(lastUrl()).toBe('/api/health-safety/hazards?limit=12&page=2');
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('shows no pager when everything fits on one page', async () => {
    render(<HazardsList organizationId="org-1" />);
    await screen.findByText('HAZ-2026-0001');
    expect(screen.queryByText(/^Page \d+ of/)).toBeNull();
  });
});

describe('HazardsList: opening a hazard', () => {
  it('has no View button and no clickable card when the host gave it nowhere to go', async () => {
    render(<HazardsList organizationId="org-1" />);
    await screen.findByText('HAZ-2026-0001');
    expect(screen.queryByRole('button', { name: /View details/ })).toBeNull();
  });

  it('opens the hazard from its View button, once', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    render(<HazardsList organizationId="org-1" onViewDetails={onViewDetails} />);
    await user.click(await screen.findByRole('button', { name: 'View details of HAZ-2026-0001' }));
    expect(onViewDetails).toHaveBeenCalledTimes(1);
    expect(onViewDetails).toHaveBeenCalledWith('haz-1');
  });
});

describe('HazardsList: when the list cannot be had', () => {
  it('shows the route’s refusal as an error with a retry, not as "No hazards found"', async () => {
    const user = userEvent.setup();
    answer = () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'health_safety_rep' role" } });
    render(<HazardsList organizationId="org-1" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The hazards could not be loaded.');
    expect(alert).toHaveTextContent("Requires at least 'health_safety_rep' role");
    expect(screen.queryByText('No hazards found')).toBeNull();

    answer = () => list([hazard()]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('HAZ-2026-0001')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['a row without its hazard level', { status: 200, body: { success: true, data: { data: [hazard({ hazardLevel: undefined })], pagination: { totalPages: 1 } } } }],
    ['a row without its report number', { status: 200, body: { success: true, data: { data: [hazard({ reportNumber: '' })], pagination: { totalPages: 1 } } } }],
    ['a row with a date that is not a date', { status: 200, body: { success: true, data: { data: [hazard({ reportedDate: 'soon' })], pagination: { totalPages: 1 } } } }],
    ['rows directly under data', { status: 200, body: { success: true, data: [hazard()] } }],
    ['no pagination', { status: 200, body: { success: true, data: { data: [hazard()] } } }],
  ])('treats %s as an error, never as a list with invented values', async (_label, reply) => {
    answer = () => reply;
    render(<HazardsList organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('HAZ-2026-0001')).toBeNull();
    expect(screen.queryByText('No hazards found')).toBeNull();
  });

  it('shows a network failure as an error', async () => {
    answer = () => { throw new Error('offline'); };
    render(<HazardsList organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
  });
});

describe('HazardsList: another organization', () => {
  it('does not show the previous organization’s hazards while the new one loads', async () => {
    const { rerender } = render(<HazardsList organizationId="org-1" />);
    expect(await screen.findByText('HAZ-2026-0001')).toBeInTheDocument();

    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    answer = async () => {
      await pending;
      return list([hazard({ id: 'haz-2', reportNumber: 'HAZ-ORG-2' })]);
    };
    rerender(<HazardsList organizationId="org-2" />);
    expect(screen.queryByText('HAZ-2026-0001')).toBeNull();
    release();
    expect(await screen.findByText('HAZ-ORG-2')).toBeInTheDocument();
  });
});
