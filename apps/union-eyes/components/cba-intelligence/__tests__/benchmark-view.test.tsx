// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';

vi.mock('next-intl', () => ({
  useLocale: () => 'en-CA',
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}));
vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const Nothing = () => null;
  return { ResponsiveContainer: Passthrough, BarChart: Passthrough, Bar: Nothing, XAxis: Nothing, YAxis: Nothing, Tooltip: Nothing, CartesianGrid: Nothing };
});

import { BenchmarkView } from '../benchmark-view';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);

const AGREEMENT = '11111111-1111-4111-8111-111111111111';

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

// What GET /api/cba-intelligence/benchmark/[id] answers with: the service's result, wrapped by the framework as `data`.
const benchmark = {
  targetAgreementId: AGREEMENT,
  comparables: [{ agreementId: 'cmp-1', title: 'Agreement One', employer: 'Employer One', union: 'Union One', jurisdiction: 'ON', sector: 'public', latestWageIncreasePct: 3, termMonths: 24, clauseFamilies: ['wages'], comparability: 'exact' }],
  comparableCount: 1,
  medianWageIncrease: 3,
  wageIncreaseP25: 2.5,
  wageIncreaseP75: 3.5,
  avgTermMonths: 24,
  clauseFamilyCoverage: { wages: 100 },
  targetWageIncrease: 3,
  targetTermMonths: 24,
  targetWagePercentile: 50,
};

const snapshots = { items: [{ id: 'snap-1', snapshotVersion: 4, comparableCount: 1, medianWageIncrease: '3.000', createdAt: '2026-10-01T00:00:00.000Z' }], total: 1, page: 1, limit: 10 };

function renderView(props: { canSaveSnapshot?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BenchmarkView {...props} />
    </QueryClientProvider>,
  );
}

function enterAgreement() {
  fireEvent.change(screen.getByPlaceholderText('agreementIdPlaceholder'), { target: { value: AGREEMENT } });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return reply(201, { success: true, data: { ...benchmark, snapshotId: 'snap-9' } });
    if (url.includes('history=true')) return reply(200, { success: true, data: snapshots });
    return reply(200, { success: true, data: benchmark });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

describe('BenchmarkView', () => {
  it('shows the quartiles of the result and each comparable by the fields the service gives it', async () => {
    renderView();
    enterAgreement();
    expect(await screen.findByText('Agreement One')).toBeInTheDocument();
    expect(screen.getByText('2.50%')).toBeInTheDocument();
    expect(screen.getByText('3.00%')).toBeInTheDocument();
    expect(screen.getByText('3.50%')).toBeInTheDocument();
    expect(screen.getByText('Employer One')).toBeInTheDocument();
    expect(screen.getByText('Union One')).toBeInTheDocument();
    expect(screen.getByText('comparability.exact')).toBeInTheDocument();
  });

  it('states the refusal of the route instead of showing nothing', async () => {
    fetchMock.mockImplementation(() => reply(404, { code: 'NOT_FOUND', message: 'Agreement not found' }));
    renderView();
    enterAgreement();
    expect(await screen.findByText('Agreement not found')).toBeInTheDocument();
  });

  it('does not offer to save a snapshot to anyone without platform authority', async () => {
    renderView();
    enterAgreement();
    await screen.findByText('Agreement One');
    expect(screen.queryByText('actions.saveSnapshot')).not.toBeInTheDocument();
  });

  it('saves a snapshot with a POST of the filters, then shows the history from `items`', async () => {
    renderView({ canSaveSnapshot: true });
    enterAgreement();
    await screen.findByText('Agreement One');

    fireEvent.click(screen.getByText('actions.saveSnapshot'));

    await waitFor(() => expect(screen.getByText('history.versionShort {"version":4}')).toBeInTheDocument());
    const post = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(post?.[0]).toBe(`/api/cba-intelligence/benchmark/${AGREEMENT}`);
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toEqual({});
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('save=true'))).toBe(false);
  });

  it('says why a snapshot was not saved', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => (init?.method === 'POST' ? reply(403, { code: 'FORBIDDEN', message: 'System administrator privileges required' }) : reply(200, { success: true, data: benchmark })));
    renderView({ canSaveSnapshot: true });
    enterAgreement();
    await screen.findByText('Agreement One');
    fireEvent.click(screen.getByText('actions.saveSnapshot'));
    expect(await screen.findByText('System administrator privileges required')).toBeInTheDocument();
  });
});
