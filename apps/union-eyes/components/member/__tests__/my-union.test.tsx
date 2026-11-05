// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import { installFetch, type Answer } from '@/components/union-structure/__tests__/fetch-harness';
import enCA from '../../../messages/en-CA.json';
import frCA from '../../../messages/fr-CA.json';
import { MyUnion } from '../my-union';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => createElement('a', { href, ...props }, children),
}));

const STAMP = '2026-03-04T00:00:00.000Z';
const wrapped = (data: unknown): Answer => ({ status: 200, body: { success: true, data, timestamp: STAMP } });
const failed = (status: number, message: string): Answer => ({ status, body: { code: 'ERROR', message } });

/** The record /api/members/me builds: exactly these seven fields, each null when the column holds nothing. */
const membership = (values: Record<string, unknown> = {}) => ({
  organizationName: 'Local 42',
  status: 'active',
  membershipNumber: 'M-1042',
  category: 'full_time',
  joinedAt: '2020-03-01T00:00:00.000Z',
  department: 'Operations',
  position: 'Welder',
  ...values,
});

let answer: Answer;

beforeEach(() => {
  answer = wrapped({ membership: membership() });
  installFetch(({ url }) => {
    if (url === '/api/members/me') return answer;
    throw new Error(`unexpected request ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderUnion(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'fr-CA' ? frCA : enCA}
      onError={(error) => {
        throw error;
      }}
    >
      <MyUnion />
    </NextIntlClientProvider>,
  );
}

const t = enCA.myUnion;
const termOf = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;

describe('MyUnion: the record the route sends', () => {
  it('shows each field of the membership record', async () => {
    renderUnion();

    const details = await screen.findByTestId('membership-details');
    expect(within(details).getByText('Local 42')).toBeInTheDocument();
    expect(termOf(t.statusLabel)).toHaveTextContent('Active');
    expect(termOf(t.membershipNumber)).toHaveTextContent('M-1042');
    expect(termOf(t.category)).toHaveTextContent('full time');
    expect(termOf(t.department)).toHaveTextContent('Operations');
    expect(termOf(t.position)).toHaveTextContent('Welder');
  });

  it('shows the recorded join date as the day that was recorded, not the day before in a western time zone', async () => {
    renderUnion();

    await screen.findByTestId('membership-details');
    expect(termOf(t.memberSince)).toHaveTextContent('March 1, 2020');
  });

  it('says "not recorded" for a field the record leaves empty, and invents nothing', async () => {
    answer = wrapped({ membership: membership({ membershipNumber: null, joinedAt: null, department: null, position: null, category: null }) });
    renderUnion();

    await screen.findByTestId('membership-details');
    for (const label of [t.membershipNumber, t.memberSince, t.department, t.position, t.category]) {
      expect(termOf(label)).toHaveTextContent(t.notRecorded);
    }
  });

  it('shows a status the page has no wording for as it is stored', async () => {
    answer = wrapped({ membership: membership({ status: 'on_leave' }) });
    renderUnion();

    await screen.findByTestId('membership-details');
    expect(termOf(t.statusLabel)).toHaveTextContent('on_leave');
  });

  it('says the organization holds no record only when the route says so', async () => {
    answer = wrapped({ membership: null });
    renderUnion();

    expect(await screen.findByTestId('membership-missing')).toHaveTextContent(t.missingTitle);
    expect(screen.queryByTestId('membership-details')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.contactUnion })).toHaveAttribute('href', '/en-CA/dashboard/messages');
  });

  it('lists the services that are not available as not available, never as links or balances', async () => {
    renderUnion();

    const services = await screen.findByTestId('union-services');
    expect(within(services).getAllByRole('listitem')).toHaveLength(6);
    expect(within(services).getAllByText(t.notAvailableYet)).toHaveLength(6);
    expect(within(services).queryByRole('link')).not.toBeInTheDocument();
  });

  it('words the page in French when the page is French', async () => {
    renderUnion('fr-CA');

    expect(await screen.findByTestId('membership-details')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(frCA.myUnion.title);
    expect(screen.getByText(/1 mars 2020|1er mars 2020/)).toBeInTheDocument();
  });
});

describe('MyUnion: when the read fails it does not say the member has no record', () => {
  it('shows the route’s message and recovers on retry', async () => {
    answer = failed(500, 'Membership lookup failed');
    const user = userEvent.setup();
    renderUnion();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.loadError);
    expect(alert).toHaveTextContent('Membership lookup failed');
    expect(screen.queryByTestId('membership-missing')).not.toBeInTheDocument();

    answer = wrapped({ membership: membership() });
    await user.click(screen.getByRole('button', { name: t.retry }));

    expect(await screen.findByTestId('membership-details')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['without a membership member', wrapped({})],
    ['with a membership that is not a record', wrapped({ membership: 'Local 42' })],
    ['with no data', { status: 200, body: { success: true } } as Answer],
    ['with a join date that is not a date', wrapped({ membership: membership({ joinedAt: 'last spring' }) })],
  ])('does not read an answer %s as "no record"', async (_what, malformed) => {
    answer = malformed;
    renderUnion();

    expect(await screen.findByRole('alert')).toHaveTextContent(t.loadError);
    expect(screen.queryByTestId('membership-missing')).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('Invalid Date');
  });

  it('shows a request that never reached the server as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    renderUnion();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
    expect(screen.queryByTestId('membership-missing')).not.toBeInTheDocument();
  });
});
