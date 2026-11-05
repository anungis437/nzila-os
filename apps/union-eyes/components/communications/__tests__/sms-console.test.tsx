// @vitest-environment jsdom
// jsdom tests of the SMS console against a mocked fetch. They prove it lists the stored campaigns with real sums, that it offers no way to send,
// schedule or template a text (nothing can), that no fabricated figure remains, and that a list it cannot read is an error, not zeros.
// They prove nothing about the real routes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
vi.mock('next-intl', () => ({ useLocale: () => intl.locale }));

import { SmsConsole } from '../sms-console';

const campaign = (over: Record<string, unknown> = {}) => ({
  id: 'k1',
  organizationId: 'org-1',
  name: 'Strike vote reminder',
  description: 'Vote on Friday',
  message: 'Vote Friday',
  status: 'completed',
  recipientCount: 100,
  sentCount: 100,
  deliveredCount: 90,
  failedCount: 10,
  totalCost: '7.50',
  ...over,
});

type Reply = { status?: number; body?: unknown };
type Routes = Record<string, () => Reply>;

function mockServer(routes: Routes) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push(key);
      const { status = 200, body = {} } = routes[key]?.() ?? { status: 404, body: { code: 'NOT_FOUND', message: `no route ${key}` } };
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    }),
  );
  return calls;
}
const list = (...rows: unknown[]): Reply => ({ body: { success: true, data: { data: rows, pagination: { page: 1, limit: 50, total: rows.length, totalPages: 1 } } } });

beforeEach(() => {
  intl.locale = 'en-CA';
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SmsConsole (jsdom, mocked server)', () => {
  it('lists the stored campaigns and sums their stored counts, with rates worked out from them', async () => {
    mockServer({
      'GET /api/communications/sms/campaigns': () =>
        list(campaign(), campaign({ id: 'k2', name: 'Meeting notice', status: 'scheduled', sentCount: 50, deliveredCount: 40, failedCount: 10, recipientCount: 50, totalCost: '3.75' })),
    });
    render(<SmsConsole />);
    expect(await screen.findByText('Strike vote reminder')).toBeInTheDocument();
    expect(screen.getByText('Meeting notice')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('130')).toBeInTheDocument();
    expect(screen.getByText('$11.25')).toBeInTheDocument();
    expect(screen.getByText('86.7% success rate')).toBeInTheDocument();
    expect(screen.getByText('90% delivered')).toBeInTheDocument();
    expect(screen.getByText('Across the 2 campaigns listed')).toBeInTheDocument();
  });

  it('says plainly that no text can be sent, and offers no way to send, schedule or template one', async () => {
    const calls = mockServer({ 'GET /api/communications/sms/campaigns': () => list() });
    render(<SmsConsole />);
    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Sending texts is not available in this release');
    expect(screen.getByRole('status')).toHaveTextContent('UE-ACTION-SMS-SEND');
    for (const label of [/new campaign/i, /create template/i, /create first campaign/i, /view all campaigns/i, /create new template/i]) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Template Library')).not.toBeInTheDocument();
    expect(screen.queryByText('Quick Actions')).not.toBeInTheDocument();
    expect(calls).toEqual(['GET /api/communications/sms/campaigns']);
  });

  it('shows no fabricated figure: not a template count and not an unread count', async () => {
    mockServer({ 'GET /api/communications/sms/campaigns': () => list() });
    render(<SmsConsole />);
    await screen.findByText('No campaigns yet');
    expect(screen.queryByText(/15 templates/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Inbox' })).toBeInTheDocument();
    expect(screen.queryByText(/View Inbox \(/)).not.toBeInTheDocument();
    expect(screen.queryByText('This month')).not.toBeInTheDocument();
  });

  it('says the campaigns could not be loaded, with a retry, instead of showing zero figures', async () => {
    const calls = mockServer({ 'GET /api/communications/sms/campaigns': () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'officer' role" } }) });
    render(<SmsConsole />);
    expect(await screen.findByRole('alert')).toHaveTextContent("Requires at least 'officer' role");
    expect(screen.queryByText('Messages Sent')).not.toBeInTheDocument();
    expect(screen.queryByText('No campaigns yet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(calls).toHaveLength(2));
  });

  it('refuses a body that is not a list of campaigns', async () => {
    mockServer({ 'GET /api/communications/sms/campaigns': () => ({ body: { success: true, data: { campaigns: [] } } }) });
    render(<SmsConsole />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The campaigns could not be loaded.');
    expect(screen.queryByText('Messages Sent')).not.toBeInTheDocument();
  });

  it('opens the read-only inbox and comes back', async () => {
    mockServer({
      'GET /api/communications/sms/campaigns': () => list(),
      'GET /api/communications/sms/conversations': () => list(),
    });
    render(<SmsConsole />);
    fireEvent.click(await screen.findByRole('button', { name: 'View Inbox' }));
    expect(await screen.findByText('No conversations found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Dashboard' }));
    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument();
  });

  it('speaks French when the locale is French', async () => {
    intl.locale = 'fr-CA';
    mockServer({ 'GET /api/communications/sms/campaigns': () => list() });
    render(<SmsConsole />);
    expect(await screen.findByText('Aucune campagne pour l’instant')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('L’envoi de textos n’est pas disponible dans cette version');
  });
});
