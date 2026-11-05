// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import '@testing-library/jest-dom/vitest';

const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
vi.mock('next-intl', () => ({
  useLocale: () => intl.locale,
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}));
vi.mock('@/lib/hooks/use-organization', () => ({
  useOrganization: () => ({ organizationId: 'org-1', userOrganizations: [{ id: 'org-1' }], isLoading: false }),
}));
// The entrance animations are not what is tested, and exiting nodes stay in the tree under jsdom.
vi.mock('framer-motion', () => {
  const Plain = ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>;
  Plain.displayName = 'Plain';
  const Presence = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  Presence.displayName = 'Presence';
  return { motion: { div: Plain }, AnimatePresence: Presence };
});

import MembersConsole from '../members-console';

interface Answer {
  status: number;
  body: unknown;
}

const member = (overrides: Record<string, unknown> = {}) => ({
  id: 'm-1',
  userId: 'u-1',
  name: 'Ada Lovelace',
  email: 'ada@union.example',
  phone: '555-0101',
  role: 'member',
  status: 'active',
  department: null,
  position: null,
  hireDate: null,
  seniority: null,
  membershipNumber: '',
  unionJoinDate: null,
  createdAt: '2020-05-01T00:00:00.000Z',
  metadata: {},
  ...overrides,
});

// What GET /api/members sends inside withApi's envelope: `total` is how many members the caller may see, which can be more than the page.
const directory = (members: unknown[], total = members.length): Answer => ({
  status: 200,
  body: { success: true, data: { members, total }, timestamp: '2026-03-04T00:00:00.000Z' },
});

const calls: string[] = [];
let answer: (url: string) => Answer | Promise<Answer>;

function renderConsole(props: { organizationId?: string } = {}) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <MembersConsole {...props} />
    </SWRConfig>,
  );
}

beforeEach(() => {
  calls.length = 0;
  intl.locale = 'en-CA';
  answer = () => directory([member()]);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    const { status, body } = await answer(url);
    return new Response(JSON.stringify(body), { status });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const card = (name: string) => screen.getByText(name).closest('.border') as HTMLElement;

describe('MembersConsole: what it reads and shows', () => {
  it('asks for the directory with the most members one request gives, and shows each member from data.members', async () => {
    answer = () => directory([
      member(),
      member({ id: 'm-2', name: 'Grace Hopper', email: 'grace@union.example', role: 'steward', status: 'active' }),
      member({ id: 'm-3', name: 'Alan Turing', email: 'alan@union.example', role: 'member', status: 'inactive' }),
    ]);
    renderConsole();
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
    expect(calls).toEqual(['/api/members?organizationId=org-1&limit=200']);
    // Total members, active members and stewards, counted from the loaded members.
    expect(within(card('members.totalMembers')).getByText('3')).toBeInTheDocument();
    expect(within(card('members.activeMembers')).getByText('2')).toBeInTheDocument();
    expect(within(card('members.stewards')).getByText('1')).toBeInTheDocument();
    expect(screen.getByText('members.showingResults {"filtered":3,"total":"3"}')).toBeInTheDocument();
  });

  it('asks for the organization the page wrapper gives it', async () => {
    renderConsole({ organizationId: 'org-9' });
    await screen.findByText('Ada Lovelace');
    expect(calls).toEqual(['/api/members?organizationId=org-9&limit=200']);
  });

  it('shows no department, position, seniority or years that the record does not have', async () => {
    renderConsole();
    await screen.findByText('Ada Lovelace');
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('Administration');
    expect(text).not.toContain('Union Member');
    expect(text).not.toContain('Unknown Member');
    expect(text).not.toContain('years seniority');
    expect(text).not.toMatch(/Seniority/);
    expect(text).not.toContain('Invalid Date');
    expect(screen.queryByText('0y')).toBeNull();
    // No average-seniority card: nothing measures it.
    expect(screen.queryByText('members.avgSeniority')).toBeNull();
  });

  it('shows the department, position and seniority a record does have, without inventing a unit', async () => {
    answer = () => directory([member({ department: 'Operations', position: 'Welder', seniority: 9, membershipNumber: 'M-200' })]);
    renderConsole();
    expect(await screen.findByText('Welder')).toBeInTheDocument();
    // The department is also an option of the department filter, so look in the member's own card.
    const own = screen.getByRole('heading', { name: 'Ada Lovelace' }).closest('.border') as HTMLElement;
    expect(within(own).getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Seniority: 9')).toBeInTheDocument();
    expect(screen.queryByText(/years/)).toBeNull();
  });

  it('uses the email for a member with no name, a dash for one with neither, and only links what exists', async () => {
    answer = () => directory([
      member({ id: 'm-2', name: null, email: 'nameless@union.example', phone: null }),
      member({ id: 'm-3', name: null, email: null, phone: null }),
    ]);
    renderConsole();
    expect(await screen.findByRole('heading', { name: 'nameless@union.example' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '—' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'nameless@union.example' })).toHaveLength(1);
    expect(document.querySelectorAll('a[href^="tel:"]')).toHaveLength(0);
    expect(document.querySelectorAll('a[href^="mailto:"]')).toHaveLength(1);
  });

  it('shows the employment dates an officer may see, as the days they are, when a member is opened', async () => {
    const user = userEvent.setup();
    answer = () => directory([member({ hireDate: '2020-01-01T00:00:00.000Z', unionJoinDate: '2019-05-10T00:00:00.000Z', membershipNumber: 'M-200' })]);
    renderConsole();
    await user.click(await screen.findByText('Ada Lovelace'));
    const hired = new Date('2020-01-01T00:00:00.000Z').toLocaleDateString('en-CA', { timeZone: 'UTC' });
    const joined = new Date('2019-05-10T00:00:00.000Z').toLocaleDateString('en-CA', { timeZone: 'UTC' });
    expect(within(screen.getByText(/members.hireDate/).parentElement as HTMLElement).getByText(hired)).toBeInTheDocument();
    expect(within(screen.getByText(/members.joinDate/).parentElement as HTMLElement).getByText(joined)).toBeInTheDocument();
    expect(screen.getByText('M-200')).toBeInTheDocument();
  });

  it('shows no employment rows for a member whose dates the caller may not see', async () => {
    const user = userEvent.setup();
    renderConsole();
    await user.click(await screen.findByText('Ada Lovelace'));
    expect(screen.queryByText(/members.hireDate/)).toBeNull();
    expect(screen.queryByText(/members.joinDate/)).toBeNull();
    expect(screen.getByText(/members.status:/)).toBeInTheDocument();
  });
});

describe('MembersConsole: filters and search', () => {
  const several = () => directory([
    member({ id: 'm-1', name: 'Ada Lovelace', department: 'Operations', position: 'Welder', role: 'member', status: 'active', membershipNumber: 'M-100' }),
    member({ id: 'm-2', name: 'Grace Hopper', email: 'grace@union.example', department: 'Finance', position: 'Office administrator', role: 'steward', status: 'active', membershipNumber: 'M-200' }),
    member({ id: 'm-3', name: 'Alan Turing', email: 'alan@union.example', department: 'Operations', role: 'chief_steward', status: 'on_leave', membershipNumber: 'M-300' }),
  ]);

  it('offers the departments, roles and statuses the loaded members have, with names for the ones it does not know', async () => {
    answer = several;
    renderConsole();
    await screen.findByText('Ada Lovelace');
    const options = (label: string) => within(screen.getByLabelText(label)).getAllByRole('option').map((option) => option.textContent);
    expect(options('members.department')).toEqual(['members.allDepartments', 'Finance', 'Operations']);
    expect(options('members.role')).toEqual(['members.allRoles', 'members.roleMember', 'members.roleSteward', 'Chief Steward']);
    expect(options('members.status')).toEqual(['members.allStatus', 'members.statusActive', 'On Leave']);
  });

  it('filters by department, role and status', async () => {
    const user = userEvent.setup();
    answer = several;
    renderConsole();
    await screen.findByText('Ada Lovelace');

    await user.selectOptions(screen.getByLabelText('members.department'), 'Operations');
    expect(screen.queryByText('Grace Hopper')).toBeNull();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('members.status'), 'on_leave');
    expect(screen.queryByText('Ada Lovelace')).toBeNull();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('members.department'), 'all');
    await user.selectOptions(screen.getByLabelText('members.status'), 'all');
    await user.selectOptions(screen.getByLabelText('members.role'), 'steward');
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).toBeNull();
  });

  it('searches the name, the email, the position and the membership number', async () => {
    const user = userEvent.setup();
    answer = several;
    renderConsole();
    await screen.findByText('Ada Lovelace');
    const search = screen.getByPlaceholderText('members.searchPlaceholder');

    await user.type(search, 'administrator');
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).toBeNull();
    await user.clear(search);
    await user.type(search, 'M-300');
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
    expect(screen.queryByText('Grace Hopper')).toBeNull();
    await user.clear(search);
    await user.type(search, 'alan@union');
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
  });

  it('says nothing matched, with a way to clear the filters, when the filters exclude everyone', async () => {
    const user = userEvent.setup();
    answer = several;
    renderConsole();
    await screen.findByText('Ada Lovelace');
    await user.type(screen.getByPlaceholderText('members.searchPlaceholder'), 'nobody-by-this-name');
    expect(await screen.findByText('No members match your search or filters.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
  });

  it('says there are no members, with no filter to clear, when the directory is empty', async () => {
    answer = () => directory([]);
    renderConsole();
    expect(await screen.findByText('members.noMembers')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('MembersConsole: a directory longer than what was loaded', () => {
  const full = (count: number, total = count) => directory(Array.from({ length: count }, (_, index) => member({ id: `m-${index}`, name: `Member ${index}`, email: `m${index}@union.example` })), total);

  it('says how many of the real total were loaded, and counts the loaded members as "200+", when the directory is longer than one request', async () => {
    answer = () => full(200, 350);
    renderConsole();
    expect(await screen.findByRole('status')).toHaveTextContent('Only the first 200 of 350 members were loaded');
    expect(within(card('members.totalMembers')).getByText('200+')).toBeInTheDocument();
    expect(screen.getByText('members.showingResults {"filtered":200,"total":"200+"}')).toBeInTheDocument();
  });

  it('does not claim a longer directory when a full page is the whole directory', async () => {
    answer = () => full(200);
    renderConsole();
    await screen.findByText('Member 0');
    expect(screen.queryByRole('status')).toBeNull();
    expect(within(card('members.totalMembers')).getByText('200')).toBeInTheDocument();
  });

  it('says nothing of the kind when fewer than a full page came back', async () => {
    answer = () => full(199);
    renderConsole();
    await screen.findByText('Member 0');
    expect(screen.queryByRole('status')).toBeNull();
    expect(within(card('members.totalMembers')).getByText('199')).toBeInTheDocument();
  });

  it('says so in French on a French locale', async () => {
    intl.locale = 'fr-CA';
    answer = () => full(200, 350);
    renderConsole();
    expect(await screen.findByRole('status')).toHaveTextContent('Seuls les 200 premiers membres sur 350 ont été chargés');
    expect(screen.getByRole('button', { name: 'Exporter 200 membres (CSV)' })).toBeInTheDocument();
  });
});

describe('MembersConsole: exporting the directory', () => {
  const created: Array<{ parts: string[]; type: string }> = [];
  const downloads: string[] = [];

  beforeEach(() => {
    created.length = 0;
    downloads.length = 0;
    vi.stubGlobal('Blob', class { parts: string[]; type: string; constructor(parts: string[], options: { type: string }) { this.parts = parts; this.type = options.type; created.push(this); } });
    URL.createObjectURL = vi.fn(() => 'blob:members');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
  });

  it('is named for what it exports, and downloads a CSV of the members listed, as filtered', async () => {
    const user = userEvent.setup();
    answer = () => directory([
      member({ id: 'm-1', name: 'Ada Lovelace', email: 'ada@union.example', department: 'Operations', position: 'Welder', role: 'steward', seniority: 9, membershipNumber: 'M-100', hireDate: '2020-01-01T00:00:00.000Z', unionJoinDate: '2019-05-10T00:00:00.000Z' }),
      member({ id: 'm-2', name: '=cmd|calc', email: 'x@union.example', phone: null }),
      member({ id: 'm-3', name: 'Alan Turing', email: 'alan@union.example', status: 'inactive' }),
    ]);
    renderConsole();
    await screen.findByText('Ada Lovelace');
    expect(screen.getByRole('button', { name: 'Export 3 members (CSV)' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('members.status'), 'active');
    await user.click(screen.getByRole('button', { name: 'Export 2 members (CSV)' }));

    expect(created).toHaveLength(1);
    expect(created[0].type).toBe('text/csv;charset=utf-8');
    const lines = created[0].parts[0].split('\n');
    expect(lines[0]).toBe('Name,Email,Phone,Role,Status,Department,Position,Membership number,Union join date,Hire date,Seniority');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('Ada Lovelace,ada@union.example,555-0101,steward,active,Operations,Welder,M-100,2019-05-10,2020-01-01,9');
    // A value that would run as a formula in a spreadsheet is neutralised, and an unknown value is empty rather than a placeholder.
    expect(lines[2]).toBe("'=cmd|calc,x@union.example,,member,active,,,,,,");
    expect(created[0].parts[0]).not.toContain('Alan Turing');
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatch(/^members-directory-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('cannot be used when the filters leave no member to export', async () => {
    const user = userEvent.setup();
    renderConsole();
    await screen.findByText('Ada Lovelace');
    await user.type(screen.getByPlaceholderText('members.searchPlaceholder'), 'nobody-by-this-name');
    const button = await screen.findByRole('button', { name: 'Export 0 members (CSV)' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(created).toHaveLength(0);
  });

  it('is a single member in the singular', async () => {
    renderConsole();
    expect(await screen.findByRole('button', { name: 'Export 1 member (CSV)' })).toBeInTheDocument();
  });
});

describe('MembersConsole: what it no longer pretends to do', () => {
  it('has no Print button, no Add member, no Edit Member, no View Cases, and no duplicate message button', async () => {
    const user = userEvent.setup();
    renderConsole();
    await user.click(await screen.findByText('Ada Lovelace'));
    expect(screen.queryByText('members.printDirectory')).toBeNull();
    expect(screen.queryByText('members.exportDirectory')).toBeNull();
    for (const label of [/print/i, /add member/i, /edit member/i, /view cases/i, /send message/i, /more options/i]) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it('links to the member’s profile, which exists, and to an email and a call only when the member has them', async () => {
    const user = userEvent.setup();
    renderConsole();
    await user.click(await screen.findByText('Ada Lovelace'));
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', '/en-CA/dashboard/members/m-1');
    expect(screen.getByRole('link', { name: 'Send email' })).toHaveAttribute('href', 'mailto:ada@union.example');
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:555-0101');
  });

  it('opens and closes a member from its chevron and from its header, and says which it is', async () => {
    const user = userEvent.setup();
    renderConsole();
    const chevron = await screen.findByRole('button', { name: 'Expand' });
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    await user.click(chevron);
    expect(screen.getByRole('button', { name: 'Collapse' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'View profile' })).toBeInTheDocument();
    await user.click(screen.getByText('Ada Lovelace'));
    expect(screen.queryByRole('link', { name: 'View profile' })).toBeNull();
  });

  it('every button does something: the only buttons of the list are Export and the chevrons', async () => {
    renderConsole();
    await screen.findByText('Ada Lovelace');
    const labels = screen.getAllByRole('button').map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim());
    expect(labels).toEqual(['Export 1 member (CSV)', 'Expand']);
  });
});

describe('MembersConsole: when the directory cannot be had', () => {
  it('shows the route’s own refusal, not an empty directory, and loads again from Retry', async () => {
    const user = userEvent.setup();
    answer = () => ({ status: 403, body: { error: 'Forbidden', message: 'Member directory access is not part of your current mandate.' } });
    renderConsole();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('members.errorLoadingMembers');
    expect(alert).toHaveTextContent('Member directory access is not part of your current mandate.');
    expect(screen.queryByText('members.noMembers')).toBeNull();
    expect(screen.queryByPlaceholderText('members.searchPlaceholder')).toBeNull();

    answer = () => directory([member()]);
    await user.click(within(alert).getByRole('button', { name: 'common.retry' }));
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the status when the refusal states no reason', async () => {
    answer = () => ({ status: 502, body: {} });
    renderConsole();
    expect(await screen.findByRole('alert')).toHaveTextContent('The directory could not be loaded (HTTP 502).');
  });

  it.each([
    ['members that are not under data', { success: true, data: [member()] }],
    ['the members of an older, unwrapped body', { members: [member()], total: 1 }],
    ['members that are not a list', { success: true, data: { members: { id: 'm-1' }, total: 1 } }],
    ['a directory without its total', { success: true, data: { members: [member()] } }],
    ['a total that is not a count', { success: true, data: { members: [member()], total: '1' } }],
    ['a member without its role', { success: true, data: { members: [member({ role: undefined })], total: 1 } }],
    ['a member without its status', { success: true, data: { members: [member({ status: '' })], total: 1 } }],
    ['a member without its id', { success: true, data: { members: [member({ id: undefined })], total: 1 } }],
    ['a seniority that is not a number', { success: true, data: { members: [member({ seniority: '9' })], total: 1 } }],
  ])('treats %s as an error, never as an empty or half-made directory', async (_label, body) => {
    answer = () => ({ status: 200, body });
    renderConsole();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('members.noMembers')).toBeNull();
    expect(screen.queryByText('Ada Lovelace')).toBeNull();
  });

  it('shows a network failure as an error', async () => {
    answer = () => { throw new Error('offline'); };
    renderConsole();
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
  });

  it('shows the loading state while the directory is on its way', async () => {
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    answer = async () => {
      await pending;
      return directory([member()]);
    };
    renderConsole();
    expect(screen.getByText('members.loadingMembers')).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.getByText('Ada Lovelace')).toBeInTheDocument());
  });
});
