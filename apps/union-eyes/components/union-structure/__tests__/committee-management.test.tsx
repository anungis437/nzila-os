// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { getTableColumns } from 'drizzle-orm';
import { committees } from '@/db/schema/union-structure-schema';
import { committeeRow, item, list, unitRow, worksiteRow } from './route-rows';
import { installFetch, writesOf, type Answer, type Call } from './fetch-harness';

// Radix menus, dialogs and selects measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

const toast = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { CommitteeManagement, toCommitteePayload } from '../CommitteeManagement';

const bargaining = committeeRow({
  unitId: 'unit-1',
  mandate: 'Negotiate the 2026 agreement',
  meetingFrequency: 'Monthly',
  meetingDay: 'First Monday',
  meetingTime: '6:00 PM',
  meetingLocation: 'Union Hall',
  maxMembers: 9,
  currentMemberCount: 7,
  requiresAppointment: true,
  termLength: 24,
  contactEmail: 'bargaining@union.test',
  description: 'Main table',
  chairId: 'user_chair',
  secretaryId: 'user_secretary',
});
const executive = committeeRow({ id: 'com-2', name: 'Executive Board', committeeType: 'executive', isOrganizationWide: true, currentMemberCount: null });
const safety = committeeRow({ id: 'com-3', name: 'Plant Safety', committeeType: 'health_safety', worksiteId: 'ws-1', currentMemberCount: 3 });
const retired = committeeRow({ id: 'com-4', name: 'Old Committee', status: 'archived' });

const units = [unitRow({}), unitRow({ id: 'unit-2', name: 'Retired Unit', status: 'archived' })];
const sites = [worksiteRow({})];

let committeeRows: unknown[];
let respond: (call: Call) => Answer | undefined;
let calls: Call[];

function defaultAnswer({ url, method }: Call): Answer {
  const path = url.split('?')[0];
  if (method === 'GET' && path === '/api/committees') return { status: 200, body: list(committeeRows) };
  if (method === 'GET' && path === '/api/units') return { status: 200, body: list(units) };
  if (method === 'GET' && path === '/api/worksites') return { status: 200, body: list(sites) };
  if (path === '/api/committees' && method === 'POST') return { status: 200, body: item({}) };
  if (path.startsWith('/api/committees/') && (method === 'PATCH' || method === 'DELETE')) return { status: 200, body: item({}) };
  throw new Error(`unexpected request ${method} ${url}`);
}

beforeEach(() => {
  committeeRows = [bargaining, executive, safety, retired];
  respond = () => undefined;
  calls = installFetch((call) => respond(call) ?? defaultAnswer(call));
  toast.mockClear();
  push.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement;

async function openRowMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
}

describe('CommitteeManagement: reading', () => {
  it('lists the committees the route sends, with the scope named from the unit and worksite lists', async () => {
    render(<CommitteeManagement organizationId="org-1" />);

    const main = await rowOf('Bargaining Committee');
    expect(within(main).getByText('Bargaining')).toBeInTheDocument();
    expect(within(main).getByText('Maintenance Unit')).toBeInTheDocument();
    expect(within(main).getByText('7 / 9')).toBeInTheDocument();
    expect(within(main).getByText('Monthly')).toBeInTheDocument();
    expect(within(main).getByText('bargaining@union.test')).toBeInTheDocument();
    expect(within(main).getByText('Active')).toBeInTheDocument();

    const board = await rowOf('Executive Board');
    expect(within(board).getByText('Organization-wide')).toBeInTheDocument();
    // A member count nobody recorded is unknown, not zero.
    expect(within(board).getAllByText('—').length).toBeGreaterThanOrEqual(3);

    const plant = await rowOf('Plant Safety');
    expect(within(plant).getByText('Health & Safety')).toBeInTheDocument();
    expect(within(plant).getByText('Plant A')).toBeInTheDocument();
    expect(within(plant).getByText('3')).toBeInTheDocument();
  });

  it('keeps an archived committee off the working list', async () => {
    render(<CommitteeManagement organizationId="org-1" />);
    await rowOf('Bargaining Committee');
    expect(screen.queryByText('Old Committee')).toBeNull();
  });

  it('asks the three routes for every page, and sends none of them the organization they already know', async () => {
    render(<CommitteeManagement organizationId="org-1" />);
    await rowOf('Bargaining Committee');
    expect(calls.map((call) => call.url).sort()).toEqual([
      '/api/committees?limit=100&page=1',
      '/api/units?limit=100&page=1',
      '/api/worksites?limit=100&page=1',
    ]);
  });

  it('shows any of the three lists failing as an error on the screen, and recovers on Retry', async () => {
    let failing = true;
    respond = ({ url, method }) =>
      method === 'GET' && failing && url.startsWith('/api/units')
        ? { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } }
        : undefined;
    const user = userEvent.setup();
    render(<CommitteeManagement organizationId="org-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load committees: Database unavailable');
    expect(screen.queryByText('No committees yet')).toBeNull();
    expect(screen.queryByText('Bargaining Committee')).toBeNull();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Bargaining Committee')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats a body that is not the list envelope as a failure instead of guessing at its shape', async () => {
    respond = ({ url, method }) =>
      method === 'GET' && url.startsWith('/api/committees') ? { status: 200, body: { success: true, data: [bargaining] } } : undefined;
    render(<CommitteeManagement organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response');
  });

  it('refuses a committee row without a type', async () => {
    committeeRows = [{ ...bargaining, committeeType: null }];
    render(<CommitteeManagement organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('committeeType is missing');
  });

  it('says so when there are no committees, and only then', async () => {
    committeeRows = [];
    render(<CommitteeManagement organizationId="org-1" />);
    expect(await screen.findByText('No committees yet')).toBeInTheDocument();
  });

  it('opens the committee workspace from a row and from the menu', async () => {
    const user = userEvent.setup();
    render(<CommitteeManagement organizationId="org-1" />);
    await user.click(await screen.findByText('Executive Board'));
    expect(push).toHaveBeenLastCalledWith('/en-CA/dashboard/committees/com-2');

    await openRowMenu(user, 'Bargaining Committee');
    await user.click(await screen.findByRole('menuitem', { name: /View Workspace/ }));
    expect(push).toHaveBeenLastCalledWith('/en-CA/dashboard/committees/com-1');
  });

  it('offers a read-only viewer no way to add, edit or archive', async () => {
    render(<CommitteeManagement organizationId="org-1" readOnly />);
    await rowOf('Bargaining Committee');
    expect(screen.queryByRole('button', { name: /Add Committee/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Actions for/ })).toBeNull();
  });
});

describe('CommitteeManagement: writing', () => {
  it('saves an edit through PATCH /api/committees/{id} with the whole of what the form shows, and not the people or notes it does not', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<CommitteeManagement organizationId="org-1" onUpdate={onUpdate} />);
    await openRowMenu(user, 'Bargaining Committee');
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));

    const name = await screen.findByLabelText(/Committee Name/);
    expect(name).toHaveValue('Bargaining Committee');
    // Nothing the committee already holds is blanked by opening it.
    expect(screen.getByLabelText('Mandate')).toHaveValue('Negotiate the 2026 agreement');
    expect(screen.getByLabelText('Meeting Location')).toHaveValue('Union Hall');
    expect(screen.queryByLabelText('Notes')).toBeNull();
    await user.clear(name);
    await user.type(name, 'Bargaining Committee 2026');
    await user.click(screen.getByRole('button', { name: 'Update Committee' }));

    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const [write] = writesOf(calls);
    expect(write).toMatchObject({ url: '/api/committees/com-1', method: 'PATCH' });
    expect(write.body).toEqual({
      name: 'Bargaining Committee 2026',
      committeeType: 'bargaining',
      status: 'active',
      contactEmail: 'bargaining@union.test',
      isOrganizationWide: false,
      unitId: 'unit-1',
      worksiteId: null,
      meetingFrequency: 'Monthly',
      meetingDay: 'First Monday',
      meetingTime: '6:00 PM',
      meetingLocation: 'Union Hall',
      maxMembers: 9,
      currentMemberCount: 7,
      requiresAppointment: true,
      requiresElection: false,
      termLength: 24,
      mandate: 'Negotiate the 2026 agreement',
      description: 'Main table',
    });
    for (const forbidden of ['organizationId', 'chairId', 'secretaryId', 'notes', 'customFields']) {
      expect(write.body).not.toHaveProperty(forbidden);
    }
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Committee updated successfully' }));
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET' && call.url.startsWith('/api/committees'))).toHaveLength(2));
  });

  it('clears the unit and the worksite when the committee is made organization-wide', async () => {
    const user = userEvent.setup();
    render(<CommitteeManagement organizationId="org-1" />);
    await openRowMenu(user, 'Bargaining Committee');
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    await user.click(await screen.findByRole('checkbox', { name: /Organization-Wide Committee/ }));
    expect(screen.getByRole('combobox', { name: /Bargaining Unit/ })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /Worksite/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Update Committee' }));

    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toMatchObject({ isOrganizationWide: true, unitId: null, worksiteId: null });
  });

  it('does not create a committee until its type is chosen, and then posts exactly the form\'s fields', async () => {
    const user = userEvent.setup();
    render(<CommitteeManagement organizationId="org-1" />);
    await rowOf('Bargaining Committee');
    await user.click(screen.getByRole('button', { name: /Add Committee/ }));
    await user.type(await screen.findByLabelText(/Committee Name/), 'Grievance Panel');
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create Committee' }));
    expect(await screen.findByText('Select a committee type')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);

    await user.click(screen.getByRole('combobox', { name: /Committee Type/ }));
    await user.click(await screen.findByRole('option', { name: 'Grievance' }));
    await user.click(screen.getByRole('button', { name: 'Create Committee' }));

    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ url: '/api/committees', method: 'POST' });
    expect(writesOf(calls)[0].body).toEqual({
      name: 'Grievance Panel',
      committeeType: 'grievance',
      status: 'active',
      contactEmail: null,
      isOrganizationWide: false,
      unitId: null,
      worksiteId: null,
      meetingFrequency: null,
      meetingDay: null,
      meetingTime: null,
      meetingLocation: null,
      maxMembers: null,
      currentMemberCount: null,
      requiresAppointment: false,
      requiresElection: false,
      termLength: null,
      mandate: null,
      description: null,
      notes: null,
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Committee created successfully' }));
  });

  it('never offers an archived unit for a new committee', async () => {
    const user = userEvent.setup();
    render(<CommitteeManagement organizationId="org-1" />);
    await rowOf('Bargaining Committee');
    await user.click(screen.getByRole('button', { name: /Add Committee/ }));
    await user.click(await screen.findByRole('combobox', { name: /Bargaining Unit/ }));
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(options).toEqual(['Maintenance Unit']);
  });

  it('shows the route\'s own refusal when a save is rejected, and does not claim success', async () => {
    respond = ({ method }) =>
      method === 'PATCH' ? { status: 400, body: { code: 'VALIDATION_ERROR', message: 'committeeType must be one of: bargaining, grievance' } } : undefined;
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<CommitteeManagement organizationId="org-1" onUpdate={onUpdate} />);
    await openRowMenu(user, 'Bargaining Committee');
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    await user.click(await screen.findByRole('button', { name: 'Update Committee' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'committeeType must be one of: bargaining, grievance' }),
      ),
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'Committee updated successfully' }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('archives through DELETE /api/committees/{id} after confirmation, and not without it', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<CommitteeManagement organizationId="org-1" onUpdate={onUpdate} />);

    confirm.mockReturnValue(false);
    await openRowMenu(user, 'Bargaining Committee');
    await user.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    expect(writesOf(calls)).toHaveLength(0);

    confirm.mockReturnValue(true);
    await openRowMenu(user, 'Bargaining Committee');
    await user.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    await waitFor(() => expect(writesOf(calls)).toEqual([expect.objectContaining({ url: '/api/committees/com-1', method: 'DELETE' })]));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Committee archived' }));
    confirm.mockRestore();
  });

  it('reports a refused archive with the route\'s reason and leaves the list alone', async () => {
    respond = ({ method }) =>
      method === 'DELETE' ? { status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'admin' role" } } : undefined;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<CommitteeManagement organizationId="org-1" />);
    await openRowMenu(user, 'Bargaining Committee');
    await user.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: "Requires at least 'admin' role" })),
    );
    expect(screen.getByText('Bargaining Committee')).toBeInTheDocument();
    confirm.mockRestore();
  });
});

describe('toCommitteePayload', () => {
  const values = {
    name: 'Safety',
    committeeType: 'health_safety',
    status: 'active',
    contactEmail: 'safety@union.test',
    isOrganizationWide: false,
    unitId: 'unit-1',
    worksiteId: 'ws-1',
    meetingFrequency: 'Monthly',
    meetingDay: 'First Monday',
    meetingTime: '6:00 PM',
    meetingLocation: 'Hall',
    maxMembers: '9',
    currentMemberCount: '4',
    requiresAppointment: true,
    requiresElection: false,
    termLength: '12',
    mandate: 'Keep people safe',
    description: 'd',
    notes: 'internal',
  };

  it('carries only columns of the committees table, never the tenant, the chair or the secretary', () => {
    const columns = Object.keys(getTableColumns(committees));
    for (const editing of [true, false]) {
      const body = toCommitteePayload(values, editing);
      for (const key of Object.keys(body)) expect(columns).toContain(key);
      for (const key of ['organizationId', 'chairId', 'secretaryId', 'customFields', 'createdBy', 'updatedAt', 'archivedAt', 'id']) {
        expect(body).not.toHaveProperty(key);
      }
    }
  });

  it('sends the notes with a new committee only, because an edit cannot show them', () => {
    expect(toCommitteePayload(values, false)).toHaveProperty('notes', 'internal');
    expect(toCommitteePayload(values, true)).not.toHaveProperty('notes');
  });
});
