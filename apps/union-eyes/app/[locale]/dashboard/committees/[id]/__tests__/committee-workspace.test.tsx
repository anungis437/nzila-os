// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { committeeActionItems, committeeDocuments, committeeMeetings } from '@/db/schema/committee-workspace-schema';
import { committeeRow, item } from '@/lib/__tests__/support/union-structure-route-rows';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }));

import { CommitteeWorkspace } from '../committee-workspace';

/** A row as the committee sub-routes send it: they select whole rows, so every column is present, null unless the test gives a value. */
function tableRow(table: PgTable, values: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(getTableColumns(table))) row[key] = null;
  for (const key of Object.keys(values)) {
    if (!(key in row)) throw new Error(`${key} is not a column of the table`);
  }
  return { ...row, ...values };
}

const STAMPS = { createdAt: '2026-03-04T10:00:00.000Z', updatedAt: '2026-03-04T10:00:00.000Z' };

const meeting = (values: Record<string, unknown> = {}) =>
  tableRow(committeeMeetings, {
    id: 'mtg-1',
    committeeId: 'com-1',
    organizationId: 'org-1',
    title: 'March meeting',
    meetingDate: '2026-03-10T12:00:00.000Z',
    status: 'completed',
    attendeeCount: 0,
    ...STAMPS,
    ...values,
  });

const actionItem = (values: Record<string, unknown> = {}) =>
  tableRow(committeeActionItems, {
    id: 'ai-1',
    committeeId: 'com-1',
    organizationId: 'org-1',
    title: 'Draft the proposal',
    status: 'pending',
    priority: 'medium',
    carryCount: 0,
    ...STAMPS,
    ...values,
  });

const document = (values: Record<string, unknown> = {}) =>
  tableRow(committeeDocuments, {
    id: 'doc-1',
    committeeId: 'com-1',
    organizationId: 'org-1',
    title: 'Terms of reference',
    createdAt: '2026-03-04T10:00:00.000Z',
    ...values,
  });

/** What withApi sends for a handler that returns a plain list: { success, data: [rows], timestamp }. */
const plain = (rows: unknown[]) => ({ success: true, data: rows, timestamp: '2026-03-04T00:00:00.000Z' });

const ok = (body: unknown): Answer => ({ status: 200, body });
const failed = (status: number, message: string): Answer => ({ status, body: { code: 'INTERNAL_ERROR', message } });

const bargaining = committeeRow({
  mandate: 'Negotiate the 2026 agreement',
  meetingFrequency: 'Monthly',
  meetingDay: 'First Monday',
  meetingTime: '6:00 PM',
  meetingLocation: 'Union Hall',
  maxMembers: 12,
  currentMemberCount: 7,
});

interface World {
  committee: Answer;
  meetings: Answer;
  actionItems: Answer;
  documents: Answer;
}

let world: World;
let calls: Call[];

const PATHS = {
  committee: '/api/committees/com-1',
  meetings: '/api/committees/com-1/meetings',
  actionItems: '/api/committees/com-1/action-items',
  documents: '/api/committees/com-1/documents',
};

function answer({ url, method }: Call): Answer {
  if (method !== 'GET') throw new Error(`the workspace only reads: ${method} ${url}`);
  const entry = Object.entries(PATHS).find(([, path]) => path === url);
  if (!entry) throw new Error(`unexpected request ${url}`);
  return world[entry[0] as keyof World];
}

const sections = (): World => ({
  committee: ok(item(bargaining)),
  meetings: ok(plain([meeting(), meeting({ id: 'mtg-2', title: 'February meeting', meetingDate: '2026-02-10T12:00:00.000Z' })])),
  actionItems: ok(plain([actionItem(), actionItem({ id: 'ai-2', title: 'Book the hall', status: 'in_progress' })])),
  documents: ok(plain([document()])),
});

beforeEach(() => {
  world = sections();
  calls = installFetch(answer);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderWorkspace = (committeeId = 'com-1') =>
  render(<CommitteeWorkspace committeeId={committeeId} organizationId="org-1" userId="user-1" userRole="steward" />);

const figure = (label: string) => screen.getByRole('group', { name: label }).querySelector('p')?.textContent ?? null;

const loaded = async () => {
  await screen.findByRole('heading', { name: 'Bargaining Committee' });
  await waitFor(() => {
    for (const label of ['Meetings', 'Open Items', 'Documents']) expect(figure(label)).not.toBe('…');
  });
};

const day = (iso: string, options?: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-CA', options);

describe('CommitteeWorkspace: what it reads', () => {
  it('reads the committee and its meetings, action items and documents from the routes that serve them, and only reads', async () => {
    renderWorkspace();
    await loaded();

    expect(calls.map((call) => `${call.method} ${call.url}`).sort()).toEqual(
      ['GET /api/committees/com-1', 'GET /api/committees/com-1/action-items', 'GET /api/committees/com-1/documents', 'GET /api/committees/com-1/meetings'].sort(),
    );
    expect(figure('Meetings')).toBe('2');
    expect(figure('Open Items')).toBe('2');
    expect(figure('Documents')).toBe('1');
    expect(figure('Members')).toBe('7 / 12');
  });

  it('shows the committee, its mandate, schedule and location', async () => {
    renderWorkspace();
    await loaded();

    expect(screen.getByRole('heading', { name: 'Bargaining Committee' })).toBeInTheDocument();
    expect(screen.getByText('bargaining')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('Negotiate the 2026 agreement')).toBeInTheDocument();
    expect(screen.getByText('Monthly — First Monday at 6:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Union Hall')).toBeInTheDocument();
  });

  it('shows a member count nobody recorded as a dash, and says so when no mandate or schedule is recorded', async () => {
    world.committee = ok(item(committeeRow({ currentMemberCount: null, maxMembers: null })));
    renderWorkspace();
    await loaded();

    expect(figure('Members')).toBe('—');
    expect(screen.getByText('No mandate or meeting schedule is recorded.')).toBeInTheDocument();
  });

  it('encodes the committee id into every route path', async () => {
    calls = installFetch(() => failed(404, 'Committee not found'));
    renderWorkspace('a/b c');
    await screen.findByText('Committee not found.');

    expect(calls.map((call) => call.url).sort()).toEqual(
      ['/api/committees/a%2Fb%20c', '/api/committees/a%2Fb%20c/action-items', '/api/committees/a%2Fb%20c/documents', '/api/committees/a%2Fb%20c/meetings'].sort(),
    );
  });

  it('shows what was read for one committee only for that committee', async () => {
    const resolvers = new Map<string, (answer: Answer) => void>();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (url: string) =>
          new Promise((resolve) => {
            resolvers.set(url, ({ status, body }) => resolve({ ok: status < 300, status, json: async () => body }));
          }),
      ),
    );
    const { rerender } = renderWorkspace('com-1');
    rerender(<CommitteeWorkspace committeeId="com-2" organizationId="org-1" userId="user-1" userRole="steward" />);

    // The first committee answers late: its record must not be drawn for the second.
    await act(async () => {
      resolvers.get('/api/committees/com-1')?.(ok(item(bargaining)));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByText('Bargaining Committee')).toBeNull();
    expect(screen.getByRole('status', { name: 'Loading committee' })).toBeInTheDocument();

    resolvers.get('/api/committees/com-2')?.(ok(item(committeeRow({ id: 'com-2', name: 'Plant Safety', committeeType: 'health_safety' }))));
    expect(await screen.findByRole('heading', { name: 'Plant Safety' })).toBeInTheDocument();
    expect(screen.getByText('health safety')).toBeInTheDocument();
    expect(screen.queryByText('Bargaining Committee')).toBeNull();
  });
});

describe('CommitteeWorkspace: what it does not pretend', () => {
  it('says the committee was not found when the route answers 404, and draws no workspace', async () => {
    world.committee = failed(404, 'Committee not found');
    renderWorkspace();

    expect(await screen.findByText('Committee not found.')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reports a committee that could not be read with the route\'s reason, and Retry reads it again', async () => {
    world.committee = failed(500, 'Database unavailable');
    const user = userEvent.setup();
    renderWorkspace();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not be loaded: Database unavailable');
    expect(screen.queryByRole('tablist')).toBeNull();

    world.committee = ok(item(bargaining));
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));
    await loaded();

    expect(calls.filter((call) => call.url === PATHS.committee)).toHaveLength(2);
  });

  it.each([
    ['a body with no data', { success: true }, 'Unexpected API response: no data'],
    ['a body with no record', { success: true, data: { data: null } }, 'Unexpected API response: no record'],
    ['a record without a name', item(committeeRow({ name: null })), 'Unexpected API response: name is missing'],
    ['a member count that is not a number', item(committeeRow({ currentMemberCount: 'seven' })), 'Unexpected API response: currentMemberCount is not a number'],
  ])('reports %s instead of drawing a committee', async (_what, body, message) => {
    world.committee = ok(body);
    renderWorkspace();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it.each([
    ['meetings', 'Meetings'],
    ['actionItems', 'Open Items'],
    ['documents', 'Documents'],
  ] as const)('shows %s that could not be read as unreadable, with a dash for its figure and not a zero', async (section, label) => {
    world[section] = failed(500, 'That list is unavailable');
    renderWorkspace();
    await screen.findByRole('heading', { name: 'Bargaining Committee' });

    await waitFor(() => expect(figure(label)).toBe('—'));
    // The sections that were read are shown as read.
    for (const other of ['Meetings', 'Open Items', 'Documents'].filter((name) => name !== label)) {
      await waitFor(() => expect(figure(other)).toMatch(/^\d+$/));
    }
    expect(screen.queryByText('No meetings yet.')).toBeNull();
    expect(screen.queryByText('No action items.')).toBeNull();
  });

  it('names the reason in the section that failed, and Retry reads the whole workspace again', async () => {
    world.meetings = failed(503, 'Meetings are unavailable');
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole('heading', { name: 'Bargaining Committee' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not be loaded: Meetings are unavailable');
    expect(figure('Meetings')).toBe('—');

    world.meetings = ok(plain([meeting()]));
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(figure('Meetings')).toBe('1'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(calls.filter((call) => call.url === PATHS.meetings)).toHaveLength(2);
  });

  it('shows the failure on the Meetings tab too, not an empty history', async () => {
    world.meetings = failed(500, 'Meetings are unavailable');
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole('heading', { name: 'Bargaining Committee' });

    await user.click(screen.getByRole('tab', { name: 'Meetings' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Meetings are unavailable');
    expect(screen.queryByText('No meetings recorded yet.')).toBeNull();
  });

  it.each([
    ['meetings', 'Meetings', 'Meetings', { success: true, data: { data: [meeting()] } }, 'Unexpected API response: no list'],
    ['meetings', 'Meetings', 'Meetings', plain([meeting({ title: null })]), 'Unexpected API response: title is missing'],
    ['meetings', 'Meetings', 'Meetings', plain([meeting({ meetingDate: 'next week' })]), 'Unexpected API response: meetingDate is not a date'],
    ['meetings', 'Meetings', 'Meetings', plain([meeting({ decisions: 'carried' })]), 'Unexpected API response: decisions is not a list'],
    ['meetings', 'Meetings', 'Meetings', plain([meeting({ decisions: [{ outcome: 'carried' }] })]), 'Unexpected API response: description is missing'],
    ['actionItems', 'Open Items', 'Action Items', plain([actionItem({ priority: null })]), 'Unexpected API response: priority is missing'],
    ['actionItems', 'Open Items', 'Action Items', plain([actionItem({ carryCount: 'twice' })]), 'Unexpected API response: carryCount is not a number'],
    ['actionItems', 'Open Items', 'Action Items', plain(['not a row']), 'Unexpected API response: action item is not a record'],
    ['documents', 'Documents', 'Documents', plain([document({ title: null })]), 'Unexpected API response: title is missing'],
    ['documents', 'Documents', 'Documents', plain([document({ createdAt: 'whenever' })]), 'Unexpected API response: createdAt is not a date'],
  ] as const)('reports a %s list in the wrong shape (%#) as unreadable, not as empty', async (section, figureLabel, tab, body, message) => {
    world[section] = ok(body);
    const user = userEvent.setup();
    renderWorkspace();
    await screen.findByRole('heading', { name: 'Bargaining Committee' });

    await waitFor(() => expect(figure(figureLabel)).toBe('—'));
    await user.click(screen.getByRole('tab', { name: tab }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText(/^No (meetings|action items|documents)/)).toBeNull();
  });

  it('treats a list that is really empty as empty, with a figure of zero', async () => {
    world.meetings = ok(plain([]));
    world.actionItems = ok(plain([]));
    world.documents = ok(plain([]));
    const user = userEvent.setup();
    renderWorkspace();
    await loaded();

    expect(figure('Meetings')).toBe('0');
    expect(figure('Open Items')).toBe('0');
    expect(figure('Documents')).toBe('0');
    expect(screen.getByText('No meetings yet.')).toBeInTheDocument();
    expect(screen.getByText('No action items.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Meetings' }));
    expect(await screen.findByText('No meetings recorded yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Action Items' }));
    expect(await screen.findByText('No action items yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Documents' }));
    expect(await screen.findByText('No documents are linked to this committee yet.')).toBeInTheDocument();
  });

  it('offers nothing it cannot do: no scheduling, adding, uploading or report buttons, only Back', async () => {
    renderWorkspace();
    await loaded();

    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent)).toEqual(['Back']);
    expect(screen.queryByText(/schedule meeting|new item|upload|generate|intelligence/i)).toBeNull();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Meetings', 'Action Items', 'Documents']);
  });

  it('goes back with the browser history', async () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const user = userEvent.setup();
    renderWorkspace();
    await loaded();

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('CommitteeWorkspace: meetings', () => {
  const MANY = (count: number) => plain(Array.from({ length: count }, (_, index) => meeting({ id: `mtg-${index}`, title: `Meeting ${index}` })));

  it('shows a full page of meetings as "50+", since the route sends no more than that at a time', async () => {
    world.meetings = ok(MANY(50));
    renderWorkspace();
    await loaded();

    expect(figure('Meetings')).toBe('50+');
  });

  it('shows one meeting fewer than a page as its exact count', async () => {
    world.meetings = ok(MANY(49));
    renderWorkspace();
    await loaded();

    expect(figure('Meetings')).toBe('49');
  });

  it('lists the five most recent meetings on the overview, as the route sent them', async () => {
    world.meetings = ok(MANY(8));
    renderWorkspace();
    await loaded();

    expect(screen.getByText('Meeting 0')).toBeInTheDocument();
    expect(screen.getByText('Meeting 4')).toBeInTheDocument();
    expect(screen.queryByText('Meeting 5')).toBeNull();
  });

  it('shows each meeting with its date, status, minutes state, attendance and decisions', async () => {
    world.meetings = ok(
      plain([
        meeting({
          id: 'mtg-1',
          title: 'Ratification vote',
          status: 'in_progress',
          minutes: 'Called to order at 6:05.',
          minutesApprovedAt: '2026-03-12T10:00:00.000Z',
          attendeeCount: 12,
          decisions: [
            { description: 'Adopt the revised proposal', outcome: 'carried' },
            { description: 'Defer the safety motion', outcome: 'tabled' },
            { description: '', outcome: 'withdrawn' },
          ],
        }),
        meeting({ id: 'mtg-2', title: 'Draft review', minutes: 'Items listed.', attendeeCount: 1 }),
        meeting({ id: 'mtg-3', title: 'Planning call', status: 'scheduled', attendeeCount: null }),
      ]),
    );
    const user = userEvent.setup();
    renderWorkspace();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Meetings' }));

    const approved = (await screen.findByRole('heading', { name: 'Ratification vote' })).closest('.border') as HTMLElement;
    expect(within(approved).getByText(day('2026-03-10T12:00:00.000Z', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))).toBeInTheDocument();
    expect(within(approved).getByText('in progress')).toBeInTheDocument();
    expect(within(approved).getByText('Minutes Approved')).toBeInTheDocument();
    expect(within(approved).getByText('12 attendees')).toBeInTheDocument();
    expect(within(approved).getByText('Adopt the revised proposal')).toBeInTheDocument();
    expect(within(approved).getByText('carried')).toBeInTheDocument();
    expect(within(approved).getByText('tabled')).toBeInTheDocument();
    expect(within(approved).getByText('No description recorded')).toBeInTheDocument();
    expect(within(approved).getByText('Called to order at 6:05.')).toBeInTheDocument();

    const draft = screen.getByRole('heading', { name: 'Draft review' }).closest('.border') as HTMLElement;
    expect(within(draft).getByText('Minutes Draft')).toBeInTheDocument();
    expect(within(draft).getByText('1 attendee')).toBeInTheDocument();

    const planned = screen.getByRole('heading', { name: 'Planning call' }).closest('.border') as HTMLElement;
    expect(within(planned).getByText('No Minutes')).toBeInTheDocument();
    expect(within(planned).queryByText(/attendee/)).toBeNull();
    expect(within(planned).queryByText('Decisions')).toBeNull();
  });
});

describe('CommitteeWorkspace: action items', () => {
  const TODAY_LATE = new Date(2026, 5, 15, 23, 59, 0);

  it('counts an item overdue only when it is open and its due day is before today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY_LATE);
    world.actionItems = ok(
      plain([
        actionItem({ id: 'ai-yesterday', title: 'Due yesterday', dueDate: '2026-06-14' }),
        actionItem({ id: 'ai-today', title: 'Due today', dueDate: '2026-06-15', status: 'in_progress' }),
        actionItem({ id: 'ai-tomorrow', title: 'Due tomorrow', dueDate: '2026-06-16' }),
        actionItem({ id: 'ai-done', title: 'Long done', dueDate: '2020-01-01', status: 'completed' }),
        actionItem({ id: 'ai-undated', title: 'No due day' }),
      ]),
    );
    renderWorkspace();
    await loaded();

    expect(screen.getByText('1 overdue action item needs attention')).toBeInTheDocument();
    expect(screen.getByText('Due yesterday')).toHaveClass('text-destructive');
    expect(screen.getByText('Due today')).not.toHaveClass('text-destructive');
    expect(screen.getByText('Due tomorrow')).not.toHaveClass('text-destructive');
    // A finished item is not an open one.
    expect(figure('Open Items')).toBe('4');
    expect(screen.queryByText('Long done')).toBeNull();
  });

  it('counts the overdue items when there are several, and shows no alert when there are none', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(TODAY_LATE);
    world.actionItems = ok(plain([actionItem({ dueDate: '2026-06-01' }), actionItem({ id: 'ai-2', dueDate: '2026-06-02' })]));
    const { unmount } = renderWorkspace();
    await loaded();
    expect(screen.getByText('2 overdue action items need attention')).toBeInTheDocument();
    unmount();

    world.actionItems = ok(plain([actionItem({ dueDate: '2026-07-01' })]));
    renderWorkspace();
    await loaded();
    expect(screen.queryByText(/overdue/)).toBeNull();
  });

  it('does not claim anything is overdue, or open, when the action items could not be read', async () => {
    world.actionItems = failed(500, 'Action items are unavailable');
    renderWorkspace();
    await screen.findByRole('heading', { name: 'Bargaining Committee' });
    await waitFor(() => expect(figure('Open Items')).toBe('—'));

    expect(screen.queryByText(/overdue/)).toBeNull();
    expect(screen.queryByText(/\d+ open/)).toBeNull();
  });

  it('shows a due day as that calendar day, and a carried item with how often it was carried', async () => {
    world.actionItems = ok(plain([actionItem({ dueDate: '2026-12-31', carryCount: 2, description: 'Needs the budget numbers' })]));
    const user = userEvent.setup();
    renderWorkspace();
    await loaded();

    expect(screen.getByText(/Due: 2026-12-31/)).toBeInTheDocument();
    expect(screen.getByText('(carried 2x)')).toBeInTheDocument();
    expect(screen.getByText('1 open')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Action Items' }));
    expect(await screen.findByText('Carried 2x')).toBeInTheDocument();
    expect(screen.getByText('Needs the budget numbers')).toBeInTheDocument();
    expect(screen.getByText('2026-12-31')).toBeInTheDocument();
  });

  it('lists at most five open items on the overview and every item read on the Action Items tab', async () => {
    world.actionItems = ok(
      plain([...Array.from({ length: 6 }, (_, index) => actionItem({ id: `ai-${index}`, title: `Open item ${index}` })), actionItem({ id: 'ai-x', title: 'Parked item', status: 'deferred' })]),
    );
    const user = userEvent.setup();
    renderWorkspace();
    await loaded();

    expect(screen.getByText('6 open')).toBeInTheDocument();
    expect(screen.getByText('Open item 4')).toBeInTheDocument();
    expect(screen.queryByText('Open item 5')).toBeNull();
    expect(screen.queryByText('Parked item')).toBeNull();

    await user.click(screen.getByRole('tab', { name: 'Action Items' }));
    expect(await screen.findByText('Open item 5')).toBeInTheDocument();
    expect(screen.getByText('Parked item')).toBeInTheDocument();
    expect(screen.getByText('deferred')).toBeInTheDocument();
  });

  it('says there are no open action items when every item read is finished', async () => {
    world.actionItems = ok(plain([actionItem({ status: 'completed' })]));
    renderWorkspace();
    await loaded();

    expect(figure('Open Items')).toBe('0');
    expect(screen.getByText('No open action items.')).toBeInTheDocument();
  });
});

describe('CommitteeWorkspace: documents', () => {
  it('shows each document with its type, date and category, and a document nobody dated without a date', async () => {
    world.documents = ok(
      plain([
        document({ id: 'doc-1', title: 'Terms of reference', fileType: 'pdf', category: 'policy' }),
        document({ id: 'doc-2', title: 'Site map', fileType: null, createdAt: null }),
      ]),
    );
    const user = userEvent.setup();
    renderWorkspace();
    await loaded();
    await user.click(screen.getByRole('tab', { name: 'Documents' }));

    const dated = (await screen.findByText('Terms of reference')).closest('.border') as HTMLElement;
    expect(within(dated).getByText(`PDF · ${day('2026-03-04T10:00:00.000Z')}`)).toBeInTheDocument();
    expect(within(dated).getByText('policy')).toBeInTheDocument();

    const undated = screen.getByText('Site map').closest('.border') as HTMLElement;
    expect(within(undated).getByText('Document')).toBeInTheDocument();
  });
});
