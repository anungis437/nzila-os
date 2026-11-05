// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import { getTableColumns } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { claims } from '@/db/schema/claims-schema';
import { inAppNotifications } from '@/db/schema/domains/communications/notifications';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';
import enCA from '../../../messages/en-CA.json';
import frCA from '../../../messages/fr-CA.json';
import { MemberHome } from '../member-home';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement('a', { href, ...props }, children),
}));

/** A row as a route sends it: every column of the table by its property name, null unless the test gives a value. */
function rowOf(table: PgTable, name: string, values: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(getTableColumns(table))) row[key] = null;
  for (const key of Object.keys(values)) {
    if (!(key in row)) throw new Error(`${key} is not a column of ${name}`);
  }
  return { ...row, ...values };
}

const claimRow = (values: Record<string, unknown>) =>
  rowOf(claims, 'claims', {
    id: 'claim-row-1',
    claimId: '8d3f6a52-1b0c-4a47-9f0e-0c5a3b7d1e01',
    claimNumber: 'CLM-20260301-0001',
    organizationId: '5b0e1a70-2c43-4a53-8b8d-4d1d7a9d0a11',
    memberId: 'user_alex',
    claimType: 'grievance_pay',
    status: 'under_review',
    priority: 'medium',
    createdAt: '2026-03-01T15:00:00.000Z',
    ...values,
  });

const noticeRow = (values: Record<string, unknown>) =>
  rowOf(inAppNotifications, 'in_app_notifications', {
    id: 'a1f0c2d4-3b5e-4f67-8a9b-0c1d2e3f4a50',
    userId: 'user_alex',
    organizationId: '5b0e1a70-2c43-4a53-8b8d-4d1d7a9d0a11',
    title: 'Your case moved to review',
    message: 'A steward is looking at CLM-20260301-0001.',
    type: 'info',
    read: false,
    createdAt: '2026-03-04T12:00:00.000Z',
    ...values,
  });

const STAMP = '2026-03-04T00:00:00.000Z';
const wrapped = (data: unknown): Answer => ({ status: 200, body: { success: true, data, timestamp: STAMP } });
/** What a CRUD-factory list sends: { data: rows, pagination } inside withApi's envelope. */
const claimPage = (rows: unknown[], page = 1, totalPages = 1): Answer => wrapped({ data: rows, pagination: { page, limit: 100, total: rows.length, totalPages } });
/** What listNotifications returns: { notifications, unreadCount, pagination } inside withApi's envelope. */
const inbox = (rows: unknown[], unreadCount = rows.length): Answer => wrapped({ notifications: rows, unreadCount, pagination: { page: 1, limit: 5, total: unreadCount, totalPages: 1 } });
const failed = (status: number, message: string): Answer => ({ status, body: { code: 'ERROR', message } });

// /api/auth/me is a plain NextResponse: { user }.
const signedIn: Answer = { status: 200, body: { user: { id: 'user_alex', email: 'alex@example.test', firstName: 'Alex' } } };

let me: Answer;
let claimPages: Answer[];
let inboxAnswer: Answer;
let markRead: Answer;
let calls: Call[];

beforeEach(() => {
  me = signedIn;
  claimPages = [claimPage([claimRow({}), claimRow({ claimId: 'c-2', claimNumber: 'CLM-20260302-0002', claimType: 'workplace_safety', status: 'resolved' })])];
  inboxAnswer = inbox([noticeRow({})]);
  markRead = wrapped({ success: true, updated: 1 });
  calls = installFetch(({ url, method }) => {
    if (url === '/api/auth/me') return me;
    if (url.startsWith('/api/claims?')) return claimPages[Number(new URL(url, 'http://host').searchParams.get('page')) - 1];
    if (url.startsWith('/api/notifications?')) return inboxAnswer;
    if (url === '/api/notifications/mark-all-read' && method === 'POST') {
      if (markRead.status === 200) inboxAnswer = inbox([]);
      return markRead;
    }
    throw new Error(`unexpected request ${method} ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderHome(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'fr-CA' ? frCA : enCA}
      onError={(error) => {
        throw error;
      }}
    >
      <MemberHome />
    </NextIntlClientProvider>,
  );
}

describe('MemberHome: what the routes send', () => {
  it('greets by first name, lists the active cases only, and lists the unread notices', async () => {
    renderHome();

    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome, Alex' })).toBeInTheDocument();
    const cases = await screen.findByTestId('home-cases');
    expect(within(cases).getAllByRole('listitem')).toHaveLength(1);
    expect(within(cases).getByText('CLM-20260301-0001')).toBeInTheDocument();
    expect(within(cases).getByText(/Grievance – Pay/)).toBeInTheDocument();
    expect(within(cases).getByText('Under Review')).toBeInTheDocument();
    expect(within(cases).getByRole('link')).toHaveAttribute('href', '/en-CA/dashboard/claims/8d3f6a52-1b0c-4a47-9f0e-0c5a3b7d1e01');
    expect(within(cases).queryByText('CLM-20260302-0002')).not.toBeInTheDocument();

    const notices = await screen.findByTestId('home-notifications');
    expect(within(notices).getByText('Your case moved to review')).toBeInTheDocument();
    expect(within(notices).getByText('A steward is looking at CLM-20260301-0001.')).toBeInTheDocument();
    expect(within(notices).getByText(new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium' }).format(new Date('2026-03-04T12:00:00.000Z')))).toBeInTheDocument();
    expect(screen.queryByTestId('home-notifications-more')).not.toBeInTheDocument();

    expect(calls.map((call) => call.url)).toEqual(expect.arrayContaining(['/api/auth/me', '/api/claims?limit=100&page=1', '/api/notifications?unreadOnly=true&limit=5']));
  });

  it('reads every page of the claims, so an active case on a later page is not left out', async () => {
    claimPages = [
      claimPage([claimRow({ claimId: 'old-1', claimNumber: 'CLM-OLD-1', status: 'closed' })], 1, 2),
      claimPage([claimRow({ claimId: 'live-1', claimNumber: 'CLM-LIVE-1', status: 'assigned' })], 2, 2),
    ];
    renderHome();

    const cases = await screen.findByTestId('home-cases');
    expect(within(cases).getByText('CLM-LIVE-1')).toBeInTheDocument();
    expect(within(cases).queryByText('CLM-OLD-1')).not.toBeInTheDocument();
  });

  it('shows a case that has no number or type as it is: a dash, and no invented type', async () => {
    claimPages = [claimPage([claimRow({ claimNumber: null, claimType: null })])];
    renderHome();

    const cases = await screen.findByTestId('home-cases');
    expect(within(cases).getByText('—')).toBeInTheDocument();
    expect(within(cases).queryByText(/·/)).not.toBeInTheDocument();
  });

  it('says there is no active case only when the cases were read and none is active', async () => {
    claimPages = [claimPage([claimRow({ status: 'resolved' }), claimRow({ claimId: 'c-3', status: 'rejected' })])];
    renderHome();

    expect(await screen.findByTestId('home-no-cases')).toHaveTextContent(enCA.memberHome.noActiveCases);
    expect(screen.queryByTestId('home-cases')).not.toBeInTheDocument();
  });

  it('says there is no notice only when the inbox was read and holds none', async () => {
    inboxAnswer = inbox([]);
    renderHome();

    expect(await screen.findByTestId('home-no-notifications')).toHaveTextContent(enCA.memberHome.noNotifications);
    expect(screen.queryByRole('button', { name: enCA.memberHome.markAllRead })).not.toBeInTheDocument();
  });

  it('says how many unread notices there are when only some are shown', async () => {
    inboxAnswer = inbox([noticeRow({}), noticeRow({ id: 'n-2', title: 'Second notice' })], 12);
    renderHome();

    expect(await screen.findByTestId('home-notifications-more')).toHaveTextContent('Showing 2 of 12 unread notifications.');
  });

  it('links a notice that carries an in-app address, and does not link one without it', async () => {
    inboxAnswer = inbox([noticeRow({ actionUrl: '/dashboard/claims/abc' }), noticeRow({ id: 'n-2', title: 'No link', actionUrl: null })]);
    renderHome();

    const notices = await screen.findByTestId('home-notifications');
    const links = within(notices).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/en-CA/dashboard/claims/abc');
  });

  it('words the case status in the language of the page', async () => {
    renderHome('fr-CA');

    expect(await screen.findByText(frCA.claimTypes.underReview)).toBeInTheDocument();
    expect(screen.queryByText('under review')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bienvenue, Alex');
  });
});

describe('MemberHome: marking notices read', () => {
  it('posts to the route, then shows the inbox as the server now holds it', async () => {
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: enCA.memberHome.markAllRead }));

    expect(await screen.findByTestId('home-no-notifications')).toBeInTheDocument();
    expect(calls.filter((call) => call.method === 'POST').map((call) => call.url)).toEqual(['/api/notifications/mark-all-read']);
  });

  it('shows the reason when the route refuses, and keeps the notices that are still unread', async () => {
    markRead = failed(403, 'Organization context required');
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: enCA.memberHome.markAllRead }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(enCA.memberHome.markAllReadError);
    expect(alert).toHaveTextContent('Organization context required');
    expect(screen.getByTestId('home-notifications')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: enCA.memberHome.markAllRead })).toBeEnabled();
  });

  it('does not take an answer that is not the route’s confirmation for success', async () => {
    markRead = wrapped({ success: false });
    const user = userEvent.setup();
    renderHome();

    await user.click(await screen.findByRole('button', { name: enCA.memberHome.markAllRead }));

    expect(await screen.findByRole('alert')).toHaveTextContent('the request was not confirmed');
    expect(screen.getByTestId('home-notifications')).toBeInTheDocument();
  });

  it('shows a request that never reached the server as a failure', async () => {
    const user = userEvent.setup();
    renderHome();
    expect(await screen.findByTestId('home-notifications')).toBeInTheDocument();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    await user.click(screen.getByRole('button', { name: enCA.memberHome.markAllRead }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
  });
});

describe('MemberHome: when a read fails, it says so and does not report an empty or zero state', () => {
  it('shows the route’s message for the cases and recovers on retry', async () => {
    claimPages = [failed(503, 'Claims are unavailable')];
    const user = userEvent.setup();
    renderHome();

    const alert = await screen.findByText(enCA.memberHome.casesLoadError);
    expect(alert.closest('[role="alert"]')).toHaveTextContent('Claims are unavailable');
    expect(screen.queryByTestId('home-no-cases')).not.toBeInTheDocument();

    claimPages = [claimPage([claimRow({})])];
    await user.click(screen.getByRole('button', { name: enCA.memberHome.retry }));

    expect(await screen.findByTestId('home-cases')).toBeInTheDocument();
    expect(screen.queryByText(enCA.memberHome.casesLoadError)).not.toBeInTheDocument();
  });

  it('shows the route’s message for the notices and recovers on retry', async () => {
    inboxAnswer = failed(500, 'Inbox is down');
    const user = userEvent.setup();
    renderHome();

    const alert = await screen.findByText(enCA.memberHome.notificationsLoadError);
    expect(alert.closest('[role="alert"]')).toHaveTextContent('Inbox is down');
    expect(screen.queryByTestId('home-no-notifications')).not.toBeInTheDocument();

    inboxAnswer = inbox([noticeRow({})]);
    await user.click(screen.getByRole('button', { name: enCA.memberHome.retry }));

    expect(await screen.findByTestId('home-notifications')).toBeInTheDocument();
  });

  it.each([
    ['a list that is not a list', wrapped({ data: 'none', pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } })],
    ['a list without its pages', wrapped({ data: [] })],
    ['an answer with no data', { status: 200, body: { success: true } } as Answer],
  ])('does not read %s as "no active case"', async (_what, answer) => {
    claimPages = [answer];
    renderHome();

    expect(await screen.findByText(enCA.memberHome.casesLoadError)).toBeInTheDocument();
    expect(screen.queryByTestId('home-no-cases')).not.toBeInTheDocument();
  });

  it('does not show a case that lacks the fields the route always sends', async () => {
    claimPages = [claimPage([{ claimNumber: 'CLM-1', status: 'assigned' }])];
    renderHome();

    expect(await screen.findByText(enCA.memberHome.casesLoadError)).toBeInTheDocument();
    expect(screen.queryByTestId('home-cases')).not.toBeInTheDocument();
  });

  it.each([
    ['without the notifications', wrapped({ unreadCount: 0 })],
    ['without the unread count', wrapped({ notifications: [] })],
    ['with a notice that has no date', inbox([noticeRow({ createdAt: null })])],
    ['with a notice whose date is not a date', inbox([noticeRow({ createdAt: 'yesterday' })])],
    ['with a notice that has no title', inbox([noticeRow({ title: null })])],
  ])('does not read an inbox %s as "no new notifications"', async (_what, answer) => {
    inboxAnswer = answer;
    renderHome();

    expect(await screen.findByText(enCA.memberHome.notificationsLoadError)).toBeInTheDocument();
    expect(screen.queryByTestId('home-no-notifications')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Invalid Date');
  });

  it('shows a request that never reached the server, for both lists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    renderHome();

    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) expect(alert).toHaveTextContent('Failed to fetch');
    expect(screen.queryByTestId('home-no-cases')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-no-notifications')).not.toBeInTheDocument();
  });

  it('shows an answer that is not JSON as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } })));
    renderHome();

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(document.body).toHaveTextContent('Unexpected API response');
  });
});

describe('MemberHome: the greeting', () => {
  it.each([
    ['no signed-in user', { status: 200, body: { user: null } } as Answer],
    ['a user without a first name', { status: 200, body: { user: { id: 'user_alex', email: 'alex@example.test', firstName: null } } } as Answer],
    ['a failing request', failed(500, 'Internal server error')],
  ])('is the neutral greeting, and the rest of the page still loads, for %s', async (_what, answer) => {
    me = answer;
    renderHome();

    expect(await screen.findByTestId('home-cases')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Welcome$/));
  });
});
