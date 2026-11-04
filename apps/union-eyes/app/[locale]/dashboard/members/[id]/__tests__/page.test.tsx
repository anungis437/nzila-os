// @vitest-environment jsdom
import { createElement, type ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { getTableColumns } from 'drizzle-orm';
import { SWRConfig } from 'swr';
import { organizationMembers } from '@/db/schema-organizations';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';

const ids = vi.hoisted(() => ({ member: '3f2b1c9e-7d4a-4e1b-9c55-0a6b8d2f1e33' }));
const push = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useParams: () => ({ id: ids.member }), useRouter: () => ({ push }) }));
vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        function Motion({ initial: _initial, animate: _animate, ...props }: Record<string, unknown>) {
          return createElement(tag as unknown as ComponentType, props);
        },
    },
  ),
}));
// Text comes from the real en-CA messages, so that a key the page asks for that the file lacks fails here.
vi.mock('next-intl', async () => {
  const messages = (await import('@/messages/en-CA.json')).default as unknown as Record<string, unknown>;
  return {
    useLocale: () => 'en-CA',
    useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
      const text = `${namespace}.${key}`.split('.').reduce<unknown>((node, part) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages);
      if (typeof text !== 'string') throw new Error(`missing message ${namespace}.${key}`);
      return text.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name]));
    },
  };
});

import MemberDetailPage from '../page';

/** A row as the CRUD item route sends it: every column of organization_members, null unless the test gives a value. */
function memberRow(values: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(getTableColumns(organizationMembers))) row[key] = null;
  for (const key of Object.keys(values)) {
    if (!(key in row)) throw new Error(`${key} is not a column of organization_members`);
  }
  return {
    ...row,
    id: ids.member,
    userId: 'user_pat',
    organizationId: 'org-1',
    name: 'Pat Morin',
    email: 'pat.morin@example.test',
    role: 'steward',
    status: 'active',
    createdAt: '2024-01-10T09:00:00.000Z',
    ...values,
  };
}

const full = memberRow({
  phone: '555-0142',
  department: 'Operations',
  position: 'Welder',
  hireDate: '2012-03-05T00:00:00.000Z',
  seniority: 12,
  membershipNumber: 'M-1042',
  unionJoinDate: '2013-01-01T00:00:00.000Z',
});

/** What GET /api/members/{id}/claims lists: the columns the route selects. */
const claimRow = (values: Record<string, unknown> = {}) => ({
  id: 'claim-row-1',
  claimId: 'claim-uuid-1',
  claimNumber: 'CLM-20260301-0001',
  claimType: 'grievance_pay',
  status: 'under_review',
  priority: 'high',
  createdAt: '2026-03-01T15:00:00.000Z',
  updatedAt: '2026-03-02T15:00:00.000Z',
  ...values,
});

const STAMP = '2026-03-04T00:00:00.000Z';
const item = (row: unknown) => ({ success: true, data: { data: row }, timestamp: STAMP });
const plain = (rows: unknown) => ({ success: true, data: rows, timestamp: STAMP });
const ok = (body: unknown): Answer => ({ status: 200, body });
const failed = (status: number, message: string): Answer => ({ status, body: { code: 'ERROR', message } });

let member: Answer;
let claims: Answer;
let calls: Call[];

beforeEach(() => {
  member = ok(item(full));
  claims = ok(plain([claimRow(), claimRow({ id: 'claim-row-2', claimId: 'claim-uuid-2', claimNumber: 'CLM-20260302-0002', claimType: 'workplace_safety', status: 'resolved', priority: 'low' })]));
  calls = installFetch(({ url }) => {
    if (url === `/api/members/${ids.member}`) return member;
    if (url === `/api/members/${ids.member}/claims`) return claims;
    throw new Error(`unexpected request ${url}`);
  });
  push.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MemberDetailPage />
    </SWRConfig>,
  );

const loaded = async () => {
  await screen.findByRole('heading', { name: 'Pat Morin' });
  await waitFor(() => expect(screen.queryByText('Loading claims...')).toBeNull());
};

/** The text under a label in a card: the label and its value are consecutive paragraphs. */
const valueOf = (label: string) => screen.getByText(label).nextElementSibling?.textContent ?? null;

describe('MemberDetailPage: what it reads', () => {
  it('reads the member and the claims from their routes, and only reads', async () => {
    renderPage();
    await loaded();

    expect(calls.map((call) => `${call.method} ${call.url}`).sort()).toEqual([`GET /api/members/${ids.member}`, `GET /api/members/${ids.member}/claims`].sort());
  });

  it('shows the member, as the record states it', async () => {
    renderPage();
    await loaded();

    expect(screen.getByText('Welder')).toBeInTheDocument();
    expect(screen.getByText('Steward')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'pat.morin@example.test' })).toHaveAttribute('href', 'mailto:pat.morin@example.test');
    expect(screen.getByRole('link', { name: '555-0142' })).toHaveAttribute('href', 'tel:555-0142');
    expect(valueOf('Department')).toBe('Operations');
    expect(valueOf('Seniority')).toBe('12 years');
    expect(valueOf('Membership Number')).toBe('M-1042');
  });

  it('shows the hire and union join dates as the days they were recorded, in any time zone', async () => {
    renderPage();
    await loaded();

    expect(valueOf('Hire Date')).toBe('2012-03-05');
    expect(valueOf('Union Join Date')).toBe('2013-01-01');
  });

  it('shows what the record does not hold as a dash: no date in 1970, no "null years", no blank', async () => {
    member = ok(item(memberRow({})));
    renderPage();
    await loaded();

    for (const label of ['Department', 'Hire Date', 'Seniority', 'Membership Number', 'Union Join Date']) expect(valueOf(label), label).toBe('—');
    expect(screen.queryByText(/1970|null|undefined|Invalid Date/)).toBeNull();
    expect(screen.queryByText('Phone')).toBeNull();
  });

  it('shows a seniority of zero years as zero, which is not unknown', async () => {
    member = ok(item(memberRow({ seniority: 0 })));
    renderPage();
    await loaded();

    expect(valueOf('Seniority')).toBe('0 years');
  });

  it('shows a role or status it has no words for as its own words', async () => {
    member = ok(item(memberRow({ role: 'chief_steward', status: 'on_leave' })));
    renderPage();
    await loaded();

    expect(screen.getByText('chief steward')).toBeInTheDocument();
    expect(screen.getByText('On Leave')).toBeInTheDocument();
  });

  it('offers no edit button, since nothing edits a member from this page', async () => {
    renderPage();
    await loaded();

    expect(screen.queryByText('Edit Profile')).toBeNull();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Back to Members']);
  });

  it('goes back to the members list of the locale', async () => {
    const user = userEvent.setup();
    renderPage();
    await loaded();

    await user.click(screen.getByRole('button', { name: 'Back to Members' }));

    expect(push).toHaveBeenCalledWith('/en-CA/dashboard/members');
  });

  it('shows it is loading while the member is on its way', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading member details...' })).toBeInTheDocument();
  });
});

describe('MemberDetailPage: claims', () => {
  it('lists each claim with its number, type, status and priority, linked to its own page', async () => {
    renderPage();
    await loaded();

    expect(screen.getByText('2 claims')).toBeInTheDocument();
    const first = screen.getByRole('link', { name: /CLM-20260301-0001/ });
    expect(first).toHaveAttribute('href', '/en-CA/dashboard/claims/claim-uuid-1');
    expect(within(first).getByText('grievance pay')).toBeInTheDocument();
    expect(within(first).getByText('under review')).toBeInTheDocument();
    expect(within(first).getByText('high priority')).toBeInTheDocument();
    const second = screen.getByRole('link', { name: /CLM-20260302-0002/ });
    expect(second).toHaveAttribute('href', '/en-CA/dashboard/claims/claim-uuid-2');
    expect(within(second).getByText('resolved')).toBeInTheDocument();
  });

  it('counts one claim as one claim', async () => {
    claims = ok(plain([claimRow()]));
    renderPage();
    await loaded();

    expect(screen.getByText('1 claim')).toBeInTheDocument();
  });

  it('says a claim has no number, type or date, rather than inventing them', async () => {
    claims = ok(plain([claimRow({ claimNumber: null, claimType: null, createdAt: null })]));
    renderPage();
    await loaded();

    const link = screen.getByRole('link', { name: /No claim number/ });
    expect(within(link).queryByText(/Created/)).toBeNull();
    expect(link).not.toHaveTextContent(/Invalid Date|null|undefined/);
  });

  it('says there are no claims only when the route sent an empty list', async () => {
    claims = ok(plain([]));
    renderPage();
    await loaded();

    expect(screen.getByText('No claims found for this member')).toBeInTheDocument();
    expect(screen.getByText('0 claims')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows claims that could not be read as unreadable, with the route\'s reason, and not as no claims', async () => {
    claims = failed(500, 'Claims are unavailable');
    renderPage();
    await screen.findByRole('heading', { name: 'Pat Morin' });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Claims could not be loaded');
    expect(alert).toHaveTextContent('Claims are unavailable');
    expect(screen.queryByText('No claims found for this member')).toBeNull();
    expect(screen.queryByText(/\d+ claims?$/)).toBeNull();
  });

  it('reads only the claims again when their Retry is pressed', async () => {
    claims = failed(503, 'Claims are unavailable');
    const user = userEvent.setup();
    renderPage();
    const alert = await screen.findByRole('alert');

    claims = ok(plain([claimRow()]));
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: /CLM-20260301-0001/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(calls.filter((call) => call.url === `/api/members/${ids.member}`)).toHaveLength(1);
    expect(calls.filter((call) => call.url === `/api/members/${ids.member}/claims`)).toHaveLength(2);
  });

  it.each([
    ['a list in the wrong nesting', { success: true, data: { data: [claimRow()] } }, 'Unexpected API response: no list'],
    ['a body that is not an envelope', [claimRow()], 'Unexpected API response: no list'],
    ['a claim that is not a record', plain(['CLM-1']), 'Unexpected API response: claim is not a record'],
    ['a claim without a status', plain([claimRow({ status: null })]), 'Unexpected API response: status is missing'],
    ['a claim without an id to open it by', plain([claimRow({ claimId: undefined })]), 'Unexpected API response: claimId is missing'],
    ['a claim date that is not a date', plain([claimRow({ createdAt: 'last week' })]), 'Unexpected API response: createdAt is not a date'],
  ])('reports %s as unreadable, not as no claims', async (_what, body, message) => {
    claims = ok(body);
    renderPage();
    await screen.findByRole('heading', { name: 'Pat Morin' });

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('No claims found for this member')).toBeNull();
  });
});

describe('MemberDetailPage: a member that could not be shown', () => {
  it('says the member was not found when the route answers 404, with no retry', async () => {
    member = failed(404, "Member '3f2b' not found");
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Member Not Found' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to Members' })).toBeInTheDocument();
  });

  it.each([
    [500, 'Database unavailable'],
    [403, 'Insufficient permissions'],
  ])('says the member could not be loaded, with the reason, when the route answers %i, and does not call it not found', async (status, message) => {
    member = failed(status, message);
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { name: 'Member details could not be loaded' })).toBeInTheDocument();
    expect(alert).toHaveTextContent(message);
    expect(screen.queryByText('Member Not Found')).toBeNull();
  });

  it('reads the member again when Retry is pressed', async () => {
    member = failed(500, 'Database unavailable');
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('alert');

    member = ok(item(full));
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { name: 'Pat Morin' })).toBeInTheDocument();
    expect(calls.filter((call) => call.url === `/api/members/${ids.member}`)).toHaveLength(2);
  });

  it.each([
    ['a body with no data', { success: true }, 'Unexpected API response: no data'],
    ['a body with no record', { success: true, data: { data: null } }, 'Unexpected API response: no record'],
    ['a record in the wrong nesting', { success: true, data: full }, 'Unexpected API response: no record'],
    ['a member without a name', item(memberRow({ name: null })), 'Unexpected API response: name is missing'],
    ['a seniority that is not a number', item(memberRow({ seniority: 'long' })), 'Unexpected API response: seniority is not a number'],
    ['a hire date that is not a date', item(memberRow({ hireDate: 'soon' })), 'Unexpected API response: hireDate is not a date'],
  ])('reports %s instead of drawing a member', async (_what, body, message) => {
    member = ok(body);
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('Member Not Found')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Pat Morin' })).toBeNull();
  });
});
