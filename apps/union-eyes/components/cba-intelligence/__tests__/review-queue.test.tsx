// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { ReviewQueue } from '../review-queue';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

// What GET /api/cba-intelligence/review answers with: the service's page of queue items, wrapped by the framework as `data`.
const finding = { id: 'f1', targetType: 'finding', title: 'Wage increase 2.5%', employer: null, jurisdiction: null, clauseFamily: 'wages', confidence: 0.75, citationText: 'Wages rise 2.5% in 2026', isInferred: true, reviewStatus: 'needs_followup', createdAt: '2026-10-01T00:00:00.000Z' };
const agreement = { id: 'a1', targetType: 'agreement', title: 'Unit agreement 2026', employer: 'Hospital Board', jurisdiction: 'ON', clauseFamily: null, confidence: 0.9, citationText: null, isInferred: false, reviewStatus: 'pending_review', createdAt: '2026-10-02T00:00:00.000Z' };
const counts = { findings: 1, agreements: 1, wageAdjustments: 0, clauses: 0, total: 2 };
const health = { level: 'warning', generatedAt: '2026-10-03T00:00:00.000Z', throughput: { ingestionSuccessRate: 1, extractionSuccessRate: 1 }, quality: { reviewBacklog: 2, staleSources: 0, expiredSources: 0 }, checks: [{ name: 'review_backlog', level: 'warning', detail: 'Pending review items: 2' }] };

const page = (items: unknown[]) => ({ success: true, data: { items, total: items.length, page: 1, limit: 20 } });

let fetchMock: ReturnType<typeof vi.fn>;
const urls = () => fetchMock.mock.calls.map(([url]) => String(url));

beforeEach(() => {
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return reply(201, { success: true, data: { id: 'decision-1' } });
    if (url.includes('counts=true')) return reply(200, { success: true, data: counts });
    if (url.includes('/health')) return reply(200, { success: true, data: health });
    if (url.includes('targetType=agreement')) return reply(200, page([agreement]));
    return reply(200, page([finding]));
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

function renderQueue() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ReviewQueue />
    </QueryClientProvider>,
  );
}

const openTab = (name: string) => {
  const trigger = screen.getByRole('tab', { name: new RegExp(name) });
  fireEvent.mouseDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
};

describe('ReviewQueue', () => {
  it('lists the findings first, by what the service gives an item, with the number of rows that await review', async () => {
    renderQueue();
    expect(await screen.findByText('Wage increase 2.5%')).toBeInTheDocument();
    expect(screen.getByText(/Wages rise 2.5% in 2026/)).toBeInTheDocument();
    expect(screen.getByText('Inferred')).toBeInTheDocument();
    expect(screen.getByText('Needs Follow-up')).toBeInTheDocument();
    expect(await screen.findByText('2 pending')).toBeInTheDocument();
    expect(urls().some((url) => url.includes('targetType=finding'))).toBe(true);
  });

  it('asks for the queue of the kind of row a tab names, so each tab lists its own rows', async () => {
    renderQueue();
    await screen.findByText('Wage increase 2.5%');

    openTab('Agreements');

    expect(await screen.findByText('Unit agreement 2026')).toBeInTheDocument();
    expect(screen.getByText('Hospital Board')).toBeInTheDocument();
    expect(screen.getByText(/ON ·/)).toBeInTheDocument();
    expect(urls().some((url) => url.includes('targetType=agreement'))).toBe(true);
  });

  it('shows the backlog warning the health snapshot gives', async () => {
    renderQueue();
    expect(await screen.findByText(/Pending review items: 2\./)).toBeInTheDocument();
  });

  it('states the refusal of the route instead of an empty queue', async () => {
    fetchMock.mockImplementation((url: string) => (url.includes('counts=true') || url.includes('/health') ? reply(403, { code: 'FORBIDDEN', message: 'System administrator privileges required' }) : reply(403, { code: 'FORBIDDEN', message: 'System administrator privileges required' })));
    renderQueue();
    expect((await screen.findAllByText('System administrator privileges required')).length).toBeGreaterThan(0);
    expect(screen.queryByText('No items pending review')).not.toBeInTheDocument();
  });

  it('shows a decision the route refused, and keeps the form open, instead of taking it for a decision made', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return reply(409, { code: 'CONFLICT', message: 'Review target changed concurrently' });
      if (url.includes('counts=true')) return reply(200, { success: true, data: counts });
      if (url.includes('/health')) return reply(200, { success: true, data: health });
      return reply(200, page([finding]));
    });
    renderQueue();
    await screen.findByText('Wage increase 2.5%');

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.change(screen.getByPlaceholderText('Reason (required)'), { target: { value: 'checked against the source' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Review target changed concurrently')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Reason (required)')).toBeInTheDocument();
  });

  it('posts the decision for the tab it was made in, then reads the queue and its counts again', async () => {
    renderQueue();
    await screen.findByText('Wage increase 2.5%');
    const readsBefore = urls().filter((url) => url.includes('/review?')).length;

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.change(screen.getByPlaceholderText('Reason (required)'), { target: { value: 'checked against the source' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(screen.queryByPlaceholderText('Reason (required)')).not.toBeInTheDocument());
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toEqual({ targetType: 'finding', targetId: 'f1', decision: 'approved', reason: 'checked against the source' });
    // the queue that was shown is read again (its key was never the one that was invalidated), and so are the counts
    await waitFor(() => expect(urls().filter((url) => url.includes('/review?')).length).toBeGreaterThan(readsBefore));
    expect(urls().filter((url) => url.includes('counts=true')).length).toBeGreaterThan(1);
  });
});
