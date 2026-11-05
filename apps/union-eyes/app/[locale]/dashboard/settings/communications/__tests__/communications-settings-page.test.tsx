// @vitest-environment jsdom
// jsdom tests of the communication preferences page against a mocked fetch: which route it reads and saves through, what it sends, and what
// it shows when the server refuses. They prove nothing about the real route.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// The translator is one stable function, as next-intl's is: the page refetches whenever it changes.
vi.mock('next-intl', () => {
  const translate = (key: string) => key;
  return { useLocale: () => 'en-CA', useTranslations: () => translate };
});

import CommunicationPreferencesPage from '../page';

const defaults = {
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  inAppEnabled: true,
  digestFrequency: 'daily',
  quietHoursStart: null,
  quietHoursEnd: null,
  claimUpdates: true,
  documentUpdates: true,
  deadlineAlerts: true,
  systemAnnouncements: true,
  securityAlerts: true,
  saved: false,
};
const saved = { ...defaults, id: 'p1', userId: 'user-1', organizationId: 'org-1', saved: true, updatedAt: '2026-10-03T12:00:00.000Z' };

type Reply = { status?: number; body?: unknown };
type Routes = Record<string, (init?: RequestInit) => Reply>;

function mockServer(overrides: Routes = {}) {
  const calls: Array<{ key: string; body: unknown }> = [];
  const routes: Routes = { 'GET /api/notifications/preferences': () => ({ body: { success: true, data: defaults } }), ...overrides };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const { status = 200, body = {} } = routes[key]?.(init) ?? { status: 404, body: { code: 'NOT_FOUND', message: `no route ${key}` } };
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    }),
  );
  return { calls, called: (key: string) => calls.filter((call) => call.key === key) };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('CommunicationPreferencesPage (jsdom, mocked server)', () => {
  it('reads the canonical notification preferences, not the deprecated messaging alias, and says when they are only defaults', async () => {
    const server = mockServer();
    render(<CommunicationPreferencesPage />);
    expect(await screen.findByLabelText('channels.email.title')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('channels.sms.title')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByLabelText('channels.push.title')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('preferences-defaults')).toHaveTextContent('Nothing has been saved yet.');
    expect(server.calls.map((call) => call.key)).toEqual(['GET /api/notifications/preferences']);
  });

  it('saves with PUT /api/notifications/preferences, sending the three channel switches and nothing the route does not take', async () => {
    const server = mockServer({ 'PUT /api/notifications/preferences': () => ({ body: { success: true, data: { ...saved, smsEnabled: true } } }) });
    render(<CommunicationPreferencesPage />);
    fireEvent.click(await screen.findByLabelText('channels.sms.title'));
    fireEvent.click(screen.getByRole('button', { name: /saveButton\.idle/ }));

    await waitFor(() => expect(server.called('PUT /api/notifications/preferences')).toHaveLength(1));
    expect(server.called('PUT /api/notifications/preferences')[0].body).toEqual({ emailEnabled: true, smsEnabled: true, pushEnabled: true });
    expect(await screen.findByText('success.saved')).toBeInTheDocument();
    expect(screen.getByLabelText('channels.sms.title')).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('preferences-defaults')).not.toBeInTheDocument();
    expect(server.calls.some((call) => call.key.includes('/api/messaging/preferences'))).toBe(false);
  });

  it('says what the server said when a save is refused, and does not claim it was saved', async () => {
    mockServer({
      'PUT /api/notifications/preferences': () => ({ status: 400, body: { code: 'BAD_REQUEST', message: 'email is required for new preferences' } }),
    });
    render(<CommunicationPreferencesPage />);
    fireEvent.click(await screen.findByLabelText('channels.email.title'));
    fireEvent.click(screen.getByRole('button', { name: /saveButton\.idle/ }));
    expect(await screen.findByText('email is required for new preferences')).toBeInTheDocument();
    expect(screen.queryByText('success.saved')).not.toBeInTheDocument();
    expect(screen.getByTestId('preferences-defaults')).toBeInTheDocument();
  });

  it('offers only what the route stores: no content categories, delivery frequency, quiet hours, time zone or unsubscribed notice', async () => {
    mockServer();
    render(<CommunicationPreferencesPage />);
    await screen.findByLabelText('channels.email.title');
    for (const key of ['content.title', 'frequency.title', 'quietHours.title', 'quietHours.timezoneLabel', 'compliance.consentTrackingTitle']) {
      expect(screen.queryByText(key)).not.toBeInTheDocument();
    }
    expect(screen.getAllByRole('switch')).toHaveLength(3);
  });

  it('shows a retryable error when the preferences cannot be read, instead of an empty form', async () => {
    mockServer({ 'GET /api/notifications/preferences': () => ({ status: 500, body: { code: 'INTERNAL_ERROR', message: 'Internal error' } }) });
    render(<CommunicationPreferencesPage />);
    expect(await screen.findByText('Internal error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'retryButton' })).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('does not render a form from a body that lacks the switches', async () => {
    mockServer({ 'GET /api/notifications/preferences': () => ({ body: { success: true, data: { data: [] } } }) });
    render(<CommunicationPreferencesPage />);
    expect(await screen.findByText('errors.fetchFailed')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });
});
