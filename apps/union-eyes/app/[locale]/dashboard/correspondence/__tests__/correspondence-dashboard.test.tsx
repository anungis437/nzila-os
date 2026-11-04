// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '../../../../../messages/en-CA.json';
import { CorrespondenceDashboard } from '../correspondence-dashboard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

// Radix dialog primitives measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);

const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  referenceNumber: `LTR-2026-${id}`,
  subject: `Letter ${id}`,
  body: 'Body',
  type: 'letter',
  priority: 'normal',
  status: 'draft',
  draftedBy: 'clerk-1',
  assignedSignerId: null,
  createdAt: '2026-03-02T15:04:00.000Z',
  updatedAt: '2026-03-03T09:30:00.000Z',
  ...overrides,
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const list = (rows: unknown[]) => json(200, { success: true, data: { data: rows, count: rows.length } });

const OPENED = '0f1e2d3c-4b5a-4968-8776-655443322110';

function mountDashboard(props: { userId?: string; canSign?: boolean } = {}) {
  render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      <CorrespondenceDashboard organizationId="org-1" userId={props.userId ?? 'clerk-1'} userRole="clerk" canSign={props.canSign ?? false} />
    </NextIntlClientProvider>,
  );
}

const openTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });
const figure = (status: string) => within(screen.getByTestId(`correspondence-stat-${status}`)).getByText(/^\d+$|—/);

beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

describe('CorrespondenceDashboard', () => {
  const rows = [
    row('1', { status: 'draft' }),
    row('2', { status: 'draft' }),
    row('3', { status: 'pending_review', assignedSignerId: 'officer-1' }),
    row('4', { status: 'signed', draftedBy: 'clerk-1' }),
    row('5', { status: 'dispatched' }),
  ];

  it('reads the letters once, and the counts do not change with the tab that is open', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(list(rows)));
    vi.stubGlobal('fetch', fetchMock);
    mountDashboard({ userId: 'someone-else' });
    expect(await screen.findByText('Letter 1')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('/api/correspondence?limit=200');
    expect(figure('draft')).toHaveTextContent('2');
    expect(figure('signed')).toHaveTextContent('1');

    openTab('Signed');
    expect(await screen.findByText('Letter 4')).toBeInTheDocument();
    expect(screen.queryByText('Letter 1')).not.toBeInTheDocument();
    expect(figure('draft')).toHaveTextContent('2');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('says the queue could not be loaded, shows no counts and no list, and offers to retry', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(500, { code: 'DATABASE_ERROR', message: 'Correspondence is temporarily unavailable' }))
      .mockResolvedValueOnce(list([row('1')]));
    vi.stubGlobal('fetch', fetchMock);
    mountDashboard();
    expect(await screen.findByRole('alert')).toHaveTextContent('Correspondence is temporarily unavailable');
    expect(screen.queryByText('No correspondence found')).not.toBeInTheDocument();
    expect(figure('draft')).toHaveTextContent('—');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Letter 1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses an answer that is not a list of letters', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json(200, { success: true, data: { letters: [] } }))));
    mountDashboard();
    expect(await screen.findByRole('alert')).toHaveTextContent('does not understand');
  });

  it('says so only when there really are no letters', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(list([]))));
    mountDashboard();
    expect(await screen.findByText('No correspondence found')).toBeInTheDocument();
  });

  it('opens a letter from its subject and from its view button, and reads that letter', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/correspondence?')) return Promise.resolve(list([row(OPENED, { subject: 'Notice of grievance' })]));
      if (url === `/api/correspondence/${OPENED}`) {
        return Promise.resolve(json(200, { success: true, data: { data: { ...row(OPENED, { subject: 'Notice of grievance' }), body: 'Dear Employer', internalNotes: null, approvedAt: null, signedAt: null, dispatchedAt: null, dispatchMethod: null, recipients: [], auditTrail: [] } } }));
      }
      return Promise.reject(new Error(`unplanned request: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    mountDashboard();
    fireEvent.click(await screen.findByRole('button', { name: 'Open letter: Notice of grievance' }));
    expect(await screen.findByText('Dear Employer')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input) === `/api/correspondence/${OPENED}`)).toBe(true);
  });

  it('tells an officer which letters wait for them, and opens one from there', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/correspondence?')) return Promise.resolve(list(rows));
      return Promise.resolve(json(404, { code: 'NOT_FOUND', message: 'Correspondence not found' }));
    }));
    mountDashboard({ userId: 'officer-1', canSign: true });
    expect(await screen.findByText('1 item needs your action')).toBeInTheDocument();
    const banner = screen.getByText('1 item needs your action').closest('div[class*="card"], div.rounded-lg') as HTMLElement;
    fireEvent.click(within(banner).getByRole('button', { name: 'Letter 3' }));
    expect(await screen.findByText('Correspondence not found')).toBeInTheDocument();
  });

  it('shows the clerk the signed letter they dispatch, and no banner to someone with nothing waiting', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(list(rows))));
    mountDashboard({ userId: 'clerk-1', canSign: false });
    expect(await screen.findByText('1 item needs your action')).toBeInTheDocument();
    cleanup();

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(list(rows))));
    mountDashboard({ userId: 'someone-else', canSign: false });
    await screen.findByText('Letter 1');
    expect(screen.queryByText(/needs? your action/)).not.toBeInTheDocument();
  });

  it('says when only the most recent letters were read', async () => {
    const many = Array.from({ length: 200 }, (_, index) => row(`n${index}`));
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(list(many))));
    mountDashboard();
    expect(await screen.findByText(/Only the 200 most recent letters are read/)).toBeInTheDocument();
  });
});
