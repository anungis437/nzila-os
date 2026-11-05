// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import { getTableColumns } from 'drizzle-orm';
import { userNotificationPreferences } from '@/db/schema/domains/communications/notifications';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';
import enCA from '../../../messages/en-CA.json';
import frCA from '../../../messages/fr-CA.json';
import { MemberPreferences } from '../member-preferences';

const STAMP = '2026-03-04T00:00:00.000Z';
const wrapped = (data: unknown): Answer => ({ status: 200, body: { success: true, data, timestamp: STAMP } });
const failed = (status: number, message: string): Answer => ({ status, body: { code: 'ERROR', message } });

/** The row GET and PUT send once preferences are stored: every column of user_notification_preferences, plus `saved: true`. */
function storedRow(values: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(getTableColumns(userNotificationPreferences))) row[key] = null;
  for (const key of Object.keys(values)) {
    if (!(key in row) && key !== 'saved') throw new Error(`${key} is not a column of user_notification_preferences`);
  }
  return {
    ...row,
    id: '7c2b9d60-4a1e-4c3f-8d55-1f0a2b3c4d5e',
    userId: 'user_alex',
    organizationId: '5b0e1a70-2c43-4a53-8b8d-4d1d7a9d0a11',
    email: 'alex@example.test',
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    inAppEnabled: true,
    digestFrequency: 'daily',
    claimUpdates: true,
    documentUpdates: true,
    deadlineAlerts: true,
    systemAnnouncements: true,
    securityAlerts: true,
    createdAt: STAMP,
    updatedAt: STAMP,
    saved: true,
    ...values,
  };
}

/** What the route sends before anything is stored: the defaults and `saved: false` (no row, so no id or user). */
const defaults = wrapped({ emailEnabled: true, smsEnabled: false, pushEnabled: true, inAppEnabled: true, digestFrequency: 'daily', quietHoursStart: null, quietHoursEnd: null, claimUpdates: true, documentUpdates: true, deadlineAlerts: true, systemAnnouncements: true, securityAlerts: true, saved: false });

let getAnswer: Answer;
let putAnswer: (body: unknown) => Answer;
let calls: Call[];

beforeEach(() => {
  getAnswer = wrapped(storedRow({ inAppEnabled: true, claimUpdates: false }));
  putAnswer = (body) => wrapped(storedRow(body as Record<string, unknown>));
  calls = installFetch(({ url, method, body }) => {
    if (url === '/api/notifications/preferences' && method === 'GET') return getAnswer;
    if (url === '/api/notifications/preferences' && method === 'PUT') return putAnswer(body);
    throw new Error(`unexpected request ${method} ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPreferences(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'fr-CA' ? frCA : enCA}
      onError={(error) => {
        throw error;
      }}
    >
      <MemberPreferences />
    </NextIntlClientProvider>,
  );
}

const t = enCA.memberPreferences;
const inApp = () => screen.getByRole('checkbox', { name: new RegExp(t.inApp) });
const caseUpdates = () => screen.getByRole('checkbox', { name: new RegExp(t.caseUpdates) });

describe('MemberPreferences: what the route sends', () => {
  it('shows the stored choices, and no defaults note once preferences are stored', async () => {
    renderPreferences();

    await screen.findByRole('button', { name: t.save });
    expect(inApp()).toBeChecked();
    expect(caseUpdates()).not.toBeChecked();
    expect(screen.queryByTestId('prefs-defaults')).not.toBeInTheDocument();
  });

  it('shows the standard settings, with a note that they are not saved yet, when nothing is stored', async () => {
    getAnswer = defaults;
    renderPreferences();

    expect(await screen.findByTestId('prefs-defaults')).toHaveTextContent(t.defaultsNote);
    expect(inApp()).toBeChecked();
    expect(caseUpdates()).toBeChecked();
  });

  it('shows case updates as switched off and unavailable while in-app notices are off', async () => {
    getAnswer = wrapped(storedRow({ inAppEnabled: false, claimUpdates: true }));
    renderPreferences();

    await screen.findByRole('button', { name: t.save });
    expect(inApp()).not.toBeChecked();
    expect(caseUpdates()).toBeDisabled();
  });

  it('words the form in French when the page is French', async () => {
    renderPreferences('fr-CA');

    expect(await screen.findByRole('button', { name: frCA.memberPreferences.save })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(frCA.memberPreferences.title);
  });
});

describe('MemberPreferences: saving', () => {
  it('sends only the two choices the form offers, and shows what the route stored', async () => {
    getAnswer = defaults;
    const user = userEvent.setup();
    renderPreferences();
    await screen.findByTestId('prefs-defaults');

    await user.click(caseUpdates());
    await user.click(screen.getByRole('button', { name: t.save }));

    expect(await screen.findByTestId('prefs-saved')).toHaveTextContent(t.saved);
    const writes = calls.filter((call) => call.method === 'PUT');
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toEqual({ inAppEnabled: true, claimUpdates: false });
    // The answer says the preferences are now stored, so the defaults note is gone.
    expect(screen.queryByTestId('prefs-defaults')).not.toBeInTheDocument();
    expect(caseUpdates()).not.toBeChecked();
  });

  it('shows what the route stored, not what was typed, when the two differ', async () => {
    putAnswer = () => wrapped(storedRow({ inAppEnabled: true, claimUpdates: true }));
    const user = userEvent.setup();
    renderPreferences();
    await screen.findByRole('button', { name: t.save });

    await user.click(inApp());
    await user.click(screen.getByRole('button', { name: t.save }));

    await screen.findByTestId('prefs-saved');
    expect(inApp()).toBeChecked();
  });

  it('shows the route’s reason when the save is refused, and does not say it was saved', async () => {
    putAnswer = () => failed(400, 'inAppEnabled: Expected boolean');
    const user = userEvent.setup();
    renderPreferences();
    await screen.findByRole('button', { name: t.save });

    await user.click(inApp());
    await user.click(screen.getByRole('button', { name: t.save }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.saveError);
    expect(alert).toHaveTextContent('inAppEnabled: Expected boolean');
    expect(screen.queryByTestId('prefs-saved')).not.toBeInTheDocument();
    // What the member typed stays on screen to be corrected.
    expect(inApp()).not.toBeChecked();
    expect(screen.getByRole('button', { name: t.save })).toBeEnabled();
  });

  it('does not say it was saved when the answer is not the stored preferences', async () => {
    putAnswer = () => wrapped({ saved: true });
    const user = userEvent.setup();
    renderPreferences();
    await screen.findByRole('button', { name: t.save });

    await user.click(screen.getByRole('button', { name: t.save }));

    expect(await screen.findByRole('alert')).toHaveTextContent('the preferences are incomplete');
    expect(screen.queryByTestId('prefs-saved')).not.toBeInTheDocument();
  });

  it('shows a save that never reached the server as a failure', async () => {
    const user = userEvent.setup();
    renderPreferences();
    await screen.findByRole('button', { name: t.save });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));

    await user.click(screen.getByRole('button', { name: t.save }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
    expect(screen.queryByTestId('prefs-saved')).not.toBeInTheDocument();
  });
});

describe('MemberPreferences: when the read fails it does not show a form of made-up choices', () => {
  it('shows the route’s message and recovers on retry', async () => {
    getAnswer = failed(503, 'Preferences are unavailable');
    const user = userEvent.setup();
    renderPreferences();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.loadError);
    expect(alert).toHaveTextContent('Preferences are unavailable');
    expect(screen.queryByRole('button', { name: t.save })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    getAnswer = wrapped(storedRow({}));
    await user.click(screen.getByRole('button', { name: t.retry }));

    expect(await screen.findByRole('button', { name: t.save })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['without the choices', wrapped({ saved: true })],
    ['with a choice that is not yes or no', wrapped({ inAppEnabled: 'yes', claimUpdates: true, saved: true })],
    ['without the saved flag', wrapped({ inAppEnabled: true, claimUpdates: true })],
    ['with no data', { status: 200, body: { success: true } } as Answer],
  ])('does not read an answer %s as "everything off"', async (_what, answer) => {
    getAnswer = answer;
    renderPreferences();

    expect(await screen.findByRole('alert')).toHaveTextContent(t.loadError);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows a request that never reached the server as a failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    renderPreferences();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to fetch');
  });
});
