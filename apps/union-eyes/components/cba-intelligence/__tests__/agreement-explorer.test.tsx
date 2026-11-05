// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}));

import { AgreementExplorer } from '../agreement-explorer';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

// A row of cba_intel_agreements as GET /api/cba-intelligence/agreements answers with it: the normalized names, the decimals as text.
const agreement = {
  id: 'a1', documentId: 'd1', extractionRunId: null, title: 'Unit agreement 2026', employerNormalized: 'Hospital Board', unionNormalized: 'Nurses Local 12', localEntity: null,
  bargainingUnitDescription: null, jurisdiction: 'ON', sector: 'health', effectiveDate: '2026-04-01T00:00:00.000Z', expiryDate: '2028-03-31T00:00:00.000Z', ratificationDate: null, termMonths: 24,
  employeeCoverage: 1200, isSummaryOnly: false, hasFullText: true, extractionStatus: 'extracted', reviewStatus: 'approved', overallConfidence: '0.912', sourceId: null, sourceUrl: null,
  contentHash: null, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
};
const wage = { id: 'w1', agreementId: 'a1', findingId: null, effectiveDate: '2026-04-01T00:00:00.000Z', year: 2026, adjustmentType: 'general_increase', adjustmentPercent: '2.500', adjustmentFlat: null, description: null, classification: null, step: null, confidence: '0.850', isInferred: false, citationText: null, reviewStatus: 'approved', createdAt: '2026-10-01T00:00:00.000Z' };
const clause = { id: 'c1', agreementId: 'a1', findingId: null, clauseFamily: 'overtime', clauseNumber: '12.01', title: 'Overtime pay', summary: 'Overtime is paid at 1.5x.', rawText: null, confidence: '0.700', isInferred: false, contentHash: null, reviewStatus: 'approved', createdAt: '2026-10-01T00:00:00.000Z' };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn((url: string) => {
    if (url.includes('/agreements/a1')) return reply(200, { success: true, data: { agreement, wageAdjustments: [wage], clauses: [clause] } });
    return reply(200, { success: true, data: { items: [agreement], total: 1, page: 1, limit: 25 } });
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

function renderExplorer(props: { canCurate?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AgreementExplorer {...props} />
    </QueryClientProvider>,
  );
}

describe('AgreementExplorer', () => {
  it('lists an agreement by the normalized employer and union the table has, with its confidence and review status', async () => {
    renderExplorer();
    expect(await screen.findByText('Unit agreement 2026')).toBeInTheDocument();
    expect(screen.getByText('Hospital Board')).toBeInTheDocument();
    expect(screen.getByText('Nurses Local 12')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('reviewStatuses.approved')).toBeInTheDocument();
  });

  it('shows the agreement, its wage adjustments and its clauses by their own fields when one is opened', async () => {
    renderExplorer();
    fireEvent.click(await screen.findByText('Unit agreement 2026'));
    expect(await screen.findByText('2.500%')).toBeInTheDocument();
    expect(screen.getByText('§12.01 Overtime pay')).toBeInTheDocument();
    expect(screen.getByText('Overtime is paid at 1.5x.')).toBeInTheDocument();
    expect(screen.getAllByText('Hospital Board').length).toBeGreaterThan(0);
    expect(screen.getByText('Nurses Local 12')).toBeInTheDocument();
  });

  it('states why the list could not be read instead of showing it empty', async () => {
    fetchMock.mockImplementation(() => reply(403, { code: 'FORBIDDEN', message: 'Your plan does not include commercial reporting' }));
    renderExplorer();
    expect(await screen.findByText('Your plan does not include commercial reporting')).toBeInTheDocument();
  });

  it('offers the review status filter only to those who curate the dataset, and never asks for a status otherwise', async () => {
    renderExplorer();
    await screen.findByText('Unit agreement 2026');
    // the jurisdiction filter alone
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('reviewStatus='))).toBe(false);
    cleanup();

    renderExplorer({ canCurate: true });
    await screen.findByText('Unit agreement 2026');
    // the jurisdiction filter and the review status filter
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });
});
