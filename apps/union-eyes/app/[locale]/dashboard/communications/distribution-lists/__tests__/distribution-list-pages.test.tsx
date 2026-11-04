// @vitest-environment jsdom
// The distribution list detail and creation pages against a mocked fetch. They prove each reads the record from the shape the item route answers
// (a list used to arrive as a wrapper and show blank), that a subscriber read that fails is an error in the subscribers card and not an empty list
// or a count of zero, that a save keeps the form populated, and that a refusal shows the message the API gave. They prove nothing about the routes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const translate = vi.hoisted(() => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key));
const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
const router = vi.hoisted(() => ({ push: vi.fn() }));
const logError = vi.hoisted(() => vi.fn());
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => intl.locale }));
vi.mock('next/navigation', () => ({ useRouter: () => router, useParams: () => ({ id: 'l1' }) }));
vi.mock('@/lib/logger', () => ({ logger: { error: logError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import ListDetailPage from '../[id]/page';
import NewListPage from '../new/page';

const row = { id: 'l1', name: 'Stewards', description: 'All stewards', listType: 'manual', subscriberCount: 2, isActive: true, createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-01-05T10:00:00Z' };
const subscriber = { id: 's1', listId: 'l1', profileId: 'p1', email: 'ana@example.org', status: 'subscribed', subscribedAt: '2026-01-05T10:00:00Z', metadata: {} };
const item = (record: unknown) => ({ success: true, data: { data: record }, timestamp: 'now' });
const subscribers = (rows: unknown[]) => ({ success: true, data: { subscribers: rows }, timestamp: 'now' });

type Reply = { status?: number; body?: unknown };
function mockServer(routes: Record<string, () => Reply>) {
  const calls: Array<{ key: string; body: unknown }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url}`;
      calls.push({ key, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      const { status = 200, body = {} } = routes[key]?.() ?? { status: 404, body: { code: 'NOT_FOUND', message: `no route ${key}` } };
      return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    }),
  );
  return calls;
}

const ITEM = 'GET /api/communications/distribution-lists/l1';
const SUBSCRIBERS = 'GET /api/communications/distribution-lists/l1/subscribers';

beforeEach(() => {
  intl.locale = 'en-CA';
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('distribution list detail page (jsdom, mocked server)', () => {
  it('shows the list and its subscribers from the shapes the routes answer', async () => {
    mockServer({ [ITEM]: () => ({ body: item(row) }), [SUBSCRIBERS]: () => ({ body: subscribers([subscriber]) }) });
    render(<ListDetailPage />);

    expect(await screen.findByRole('heading', { name: 'Stewards' })).toBeInTheDocument();
    expect(screen.getByLabelText('nameLabel')).toHaveValue('Stewards');
    expect(screen.getByLabelText('descriptionLabel')).toHaveValue('All stewards');
    expect(await screen.findByText('ana@example.org')).toBeInTheDocument();
    expect(screen.getByText('subscribersDescription {"count":1}')).toBeInTheDocument();
  });

  it('says there are no subscribers only when the route returned none', async () => {
    mockServer({ [ITEM]: () => ({ body: item(row) }), [SUBSCRIBERS]: () => ({ body: subscribers([]) }) });
    render(<ListDetailPage />);

    expect(await screen.findByText('noSubscribers')).toBeInTheDocument();
    expect(screen.getByText('subscribersDescription {"count":0}')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows an error, not "no subscribers" or a count of zero, when the subscribers cannot be read, and reads them again on refresh', async () => {
    let answer: Reply = { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Internal error' } };
    mockServer({ [ITEM]: () => ({ body: item(row) }), [SUBSCRIBERS]: () => answer });
    const { container } = render(<ListDetailPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The subscribers could not be loaded.');
    expect(screen.getByRole('heading', { name: 'Stewards' })).toBeInTheDocument();
    expect(screen.queryByText('noSubscribers')).not.toBeInTheDocument();
    expect(screen.queryByText(/subscribersDescription/)).not.toBeInTheDocument();
    expect(logError).toHaveBeenCalledWith('Failed to load distribution list subscribers', expect.any(Error), { listId: 'l1' });

    answer = { body: subscribers([subscriber]) };
    const refresh = container.querySelector('svg.lucide-refresh-cw')?.closest('button');
    expect(refresh).toBeTruthy();
    fireEvent.click(refresh as HTMLElement);

    expect(await screen.findByText('ana@example.org')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['a bare array', [subscriber]],
    ['a list under another name', { success: true, data: { rows: [subscriber] } }],
    ['subscribers that are not records', subscribers(['x'])],
  ])('treats %s as an unreadable answer, not as an empty list', async (_what, body) => {
    mockServer({ [ITEM]: () => ({ body: item(row) }), [SUBSCRIBERS]: () => ({ body }) });
    render(<ListDetailPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The subscribers could not be loaded.');
    expect(screen.queryByText('noSubscribers')).not.toBeInTheDocument();
  });

  it('says so in French', async () => {
    intl.locale = 'fr-CA';
    mockServer({ [ITEM]: () => ({ body: item(row) }), [SUBSCRIBERS]: () => ({ status: 500, body: {} }) });
    render(<ListDetailPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Les abonnés n’ont pas pu être chargés.');
  });

  it('shows an error, not a blank page, when the list answer is not a list', async () => {
    mockServer({ [ITEM]: () => ({ body: { success: true, data: {} } }), [SUBSCRIBERS]: () => ({ body: subscribers([]) }) });
    render(<ListDetailPage />);

    expect(await screen.findByText('failedToFetch')).toBeInTheDocument();
    expect(screen.queryByLabelText('nameLabel')).not.toBeInTheDocument();
  });

  it('keeps the form populated after a save, from the record the route answers, and sends only the fields it edits', async () => {
    const calls = mockServer({
      [ITEM]: () => ({ body: item(row) }),
      [SUBSCRIBERS]: () => ({ body: subscribers([]) }),
      'PATCH /api/communications/distribution-lists/l1': () => ({ body: item({ ...row, name: 'Stewards 2026' }) }),
    });
    render(<ListDetailPage />);

    fireEvent.change(await screen.findByLabelText('nameLabel'), { target: { value: 'Stewards 2026' } });
    fireEvent.click(screen.getByRole('button', { name: /saveButton/ }));

    expect(await screen.findByText('successMessage')).toBeInTheDocument();
    expect(screen.getByLabelText('nameLabel')).toHaveValue('Stewards 2026');
    expect(screen.getByRole('heading', { name: 'Stewards 2026' })).toBeInTheDocument();
    expect(calls.find((call) => call.key.startsWith('PATCH'))?.body).toEqual({ name: 'Stewards 2026', description: 'All stewards', isActive: true });
  });

  it('shows the message the API gave when a save is refused', async () => {
    mockServer({
      [ITEM]: () => ({ body: item(row) }),
      [SUBSCRIBERS]: () => ({ body: subscribers([]) }),
      'PATCH /api/communications/distribution-lists/l1': () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'steward' role" } }),
    });
    render(<ListDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: /saveButton/ }));

    expect(await screen.findByText("Requires at least 'steward' role")).toBeInTheDocument();
    expect(screen.queryByText('successMessage')).not.toBeInTheDocument();
  });
});

describe('new distribution list page (jsdom, mocked server)', () => {
  const fill = () => fireEvent.change(screen.getByLabelText('form.nameLabel'), { target: { value: 'Delegates' } });

  it('opens the list it created by the id the route gave it', async () => {
    const calls = mockServer({ 'POST /api/communications/distribution-lists': () => ({ status: 201, body: item({ ...row, id: 'l-new', name: 'Delegates' }) }) });
    render(<NewListPage />);

    fill();
    fireEvent.click(screen.getByRole('button', { name: /actions.create/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/en-CA/dashboard/communications/distribution-lists/l-new'));
    expect(calls[0].body).toEqual({ name: 'Delegates', description: '', listType: 'manual', isActive: true });
  });

  it('shows the message the API gave and goes nowhere when the create is refused', async () => {
    mockServer({ 'POST /api/communications/distribution-lists': () => ({ status: 400, body: { code: 'BAD_REQUEST', message: 'Field foo cannot be assigned' } }) });
    render(<NewListPage />);

    fill();
    fireEvent.click(screen.getByRole('button', { name: /actions.create/ }));

    expect(await screen.findByText('Field foo cannot be assigned')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows an error and does not open /undefined when the answer carries no id', async () => {
    mockServer({ 'POST /api/communications/distribution-lists': () => ({ status: 201, body: { success: true, data: { data: {} } } }) });
    render(<NewListPage />);

    fill();
    fireEvent.click(screen.getByRole('button', { name: /actions.create/ }));

    expect(await screen.findByText('errors.createFailed')).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('asks for a name before it sends anything', async () => {
    const calls = mockServer({});
    render(<NewListPage />);

    fireEvent.click(screen.getByRole('button', { name: /actions.create/ }));

    expect(await screen.findByText('errors.nameRequired')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});
