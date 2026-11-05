// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('next-intl', () => ({
  useLocale: () => 'en-CA',
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('@/components/mobile/MobileHeader', () => {
  const MobileHeader = ({ title, rightContent }: { title: string; rightContent?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {rightContent}
    </header>
  );
  MobileHeader.displayName = 'MobileHeader';
  return { MobileHeader };
});

import MobileMembersPage from '../members/page';
import { projectDirectoryMember } from '@/lib/members/directory-access';

// A member exactly as GET /api/members projects it, not as the page would like it to be.
const member = (overrides: Partial<Parameters<typeof projectDirectoryMember>[0]> = {}) =>
  projectDirectoryMember(
    {
      id: 'm-1',
      userId: 'u-1',
      name: 'Ada Lovelace',
      email: 'ada@union.example',
      phone: null,
      role: 'member',
      status: 'active',
      department: null,
      position: null,
      hireDate: null,
      seniority: null,
      membershipNumber: null,
      unionJoinDate: null,
      createdAt: new Date('2020-05-01T00:00:00.000Z'),
      metadata: {},
      ...overrides,
    },
    { scope: 'organization', includeSensitive: false },
  );

// What the route sends inside withApi's envelope.
const directory = (members: unknown[], total = members.length) => ({
  status: 200,
  body: { success: true, data: { members, total }, timestamp: '2026-03-04T00:00:00.000Z' },
});

interface Answer {
  status: number;
  body: unknown;
}

const calls: string[] = [];
let answer: (url: string) => Answer;

beforeEach(() => {
  calls.length = 0;
  answer = () => directory([member()]);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const { status, body } = answer(url);
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'onLine');
});

describe('MobileMembersPage: what it reads and shows', () => {
  it('shows the members from data.members of the real envelope, linked to the member page that exists', async () => {
    answer = () =>
      directory([
        member(),
        member({ id: 'm-2', name: 'Grace Hopper', email: 'grace@union.example', role: 'chief_steward', status: 'inactive' }),
      ]);
    render(<MobileMembersPage />);

    const ada = (await screen.findByText('Ada Lovelace')).closest('a') as HTMLElement;
    expect(ada).toHaveAttribute('href', '/en-CA/dashboard/members/m-1');
    expect(within(ada).getByText('ada@union.example')).toBeInTheDocument();
    expect(within(ada).getByText('AL')).toBeInTheDocument();
    expect(within(ada).getByText('active')).toBeInTheDocument();

    const grace = screen.getByText('Grace Hopper').closest('a') as HTMLElement;
    expect(grace).toHaveAttribute('href', '/en-CA/dashboard/members/m-2');
    expect(within(grace).getByText('chief steward')).toBeInTheDocument();
    expect(within(grace).getByText('inactive')).toBeInTheDocument();
    expect(screen.queryByText('noResultsEmpty')).toBeNull();
  });

  it('asks for the first page of the directory and invents no sync state or cache', async () => {
    const read = vi.spyOn(Storage.prototype, 'getItem');
    render(<MobileMembersPage />);
    await screen.findByText('Ada Lovelace');
    expect(calls).toEqual(['/api/members?limit=50&offset=0']);
    // The route sends no sync state, so no member is flagged as unsynced; nothing is read from a cache nobody writes.
    expect(screen.queryByText(/unsynced/i)).toBeNull();
    expect(read).not.toHaveBeenCalledWith('cached_members');
  });

  it('shows a member without a name by their email, and one with neither by a dash', async () => {
    answer = () => directory([member({ name: null }), member({ id: 'm-2', name: null, email: null })]);
    render(<MobileMembersPage />);
    expect(await screen.findByText('ada@union.example')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('says there are no members only when the directory loaded and is empty', async () => {
    answer = () => directory([]);
    render(<MobileMembersPage />);
    expect(await screen.findByText('noResultsEmpty')).toBeInTheDocument();
  });

  it('has the server search and filter, because the page holds only part of a large directory', async () => {
    const user = userEvent.setup();
    render(<MobileMembersPage />);
    await screen.findByText('Ada Lovelace');

    await user.type(screen.getByRole('searchbox'), 'ada');
    await waitFor(() => expect(calls).toContain('/api/members?limit=50&offset=0&search=ada'), { timeout: 2000 });

    await user.click(screen.getByRole('button', { name: 'filterActive' }));
    await waitFor(() => expect(calls).toContain('/api/members?limit=50&offset=0&search=ada&status=active'));
  });

  it('says nothing matched a search only for a search', async () => {
    const user = userEvent.setup();
    render(<MobileMembersPage />);
    await screen.findByText('Ada Lovelace');
    answer = (url) => (url.includes('search=') ? directory([]) : directory([member()]));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(await screen.findByText('noResultsSearch', undefined, { timeout: 2000 })).toBeInTheDocument();
  });
});

describe('MobileMembersPage: when the directory cannot be read', () => {
  it('shows the failure with the route\'s reason, never an empty directory, and recovers on Retry', async () => {
    answer = () => ({ status: 403, body: { error: 'Forbidden', message: 'Member directory access is not part of your current mandate.' } });
    const user = userEvent.setup();
    render(<MobileMembersPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailed Member directory access is not part of your current mandate.');
    expect(screen.queryByText('noResultsEmpty')).toBeNull();

    answer = () => directory([member()]);
    await user.click(screen.getByRole('button', { name: 'retry' }));
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['members that are not under data', { success: true, data: [member()] }],
    ['members that are not a list', { success: true, data: { members: { id: 'm-1' }, total: 1 } }],
    ['no total', { success: true, data: { members: [member()] } }],
    ['a member without its id', { success: true, data: { members: [{ ...member(), id: '' }], total: 1 } }],
    ['a member without its role', { success: true, data: { members: [{ ...member(), role: undefined }], total: 1 } }],
  ])('treats %s as a failure instead of showing an empty or half-read list', async (_name, body) => {
    answer = () => ({ status: 200, body });
    render(<MobileMembersPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailed');
    expect(screen.queryByText('noResultsEmpty')).toBeNull();
  });

  it('says it is offline, and does not claim to show cached data', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    render(<MobileMembersPage />);
    expect(await screen.findByText('offlineBanner')).toBeInTheDocument();
  });
});

describe('MobileMembersPage: a directory longer than one page', () => {
  it('says how many it shows of the real total, and loads the next page on request without repeating a member', async () => {
    answer = (url) =>
      url.includes('offset=0')
        ? directory([member(), member({ id: 'm-2', name: 'Grace Hopper' })], 3)
        : directory([member({ id: 'm-2', name: 'Grace Hopper' }), member({ id: 'm-3', name: 'Alan Turing' })], 3);
    const user = userEvent.setup();
    render(<MobileMembersPage />);

    expect(await screen.findByText('showing {"shown":2,"total":3}')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'loadMore' }));

    expect(await screen.findByText('Alan Turing')).toBeInTheDocument();
    expect(calls).toContain('/api/members?limit=50&offset=2');
    expect(screen.getAllByText('Grace Hopper')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'loadMore' })).toBeNull();
  });

  it('shows a failed load-more as an error and keeps the members already shown', async () => {
    answer = (url) =>
      url.includes('offset=0') ? directory([member()], 2) : { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } };
    const user = userEvent.setup();
    render(<MobileMembersPage />);
    await user.click(await screen.findByRole('button', { name: 'loadMore' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('loadFailed Database unavailable');
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('does not offer more when everything was loaded', async () => {
    answer = () => directory([member()], 1);
    render(<MobileMembersPage />);
    await screen.findByText('Ada Lovelace');
    expect(screen.queryByRole('button', { name: 'loadMore' })).toBeNull();
  });
});
