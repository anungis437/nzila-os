// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';

vi.mock('@/components/grievances/related-documents-panel', () => ({ RelatedDocumentsPanel: () => <div>related panel</div> }));
vi.mock('@/components/grievances/similar-cases-panel', () => ({ SimilarCasesPanel: () => <div>similar panel</div> }));
vi.mock('@/components/grievances/precedent-documents-panel', () => ({ PrecedentDocumentsPanel: () => <div>precedent panel</div> }));
vi.mock('@/components/grievances/case-graph-summary', () => ({ CaseGraphSummary: () => <div>graph panel</div> }));

import { CaseIntelligencePanel } from '../case-intelligence-panel';

const answer = { data: { graph: { nodes: [], edges: [] }, relatedDocuments: [], similarCases: [], precedentDocuments: [] } };

function mount(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr-CA' ? frCA : enCA}>
      <CaseIntelligencePanel caseId="case-1" />
    </NextIntlClientProvider>,
  );
}

describe('CaseIntelligencePanel', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the context panels for an answer that has the intelligence shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(answer)));
    mount();
    expect(await screen.findByText('related panel')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['a refusal', () => Response.json({ message: 'Forbidden' }, { status: 403 })],
    ['a server error', () => new Response('<html>oops</html>', { status: 500 })],
    ['an answer that is not the intelligence shape', () => Response.json({ data: { graph: null } })],
    ['an answer with no data', () => Response.json({})],
  ])('says the context could not be loaded for %s, instead of showing empty lists as if nothing were related', async (_name, respond) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond()));
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(enCA.caseIntelligence.loadFailed);
    expect(screen.queryByText('related panel')).toBeNull();
    expect(screen.queryByText('graph panel')).toBeNull();
  });

  it('says so when the request itself fails, without an unhandled rejection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent(enCA.caseIntelligence.loadFailed);
    expect(screen.queryByText(/Failed to fetch/)).toBeNull();
  });

  it('words the notice and the failure in French', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 503 })));
    mount('fr-CA');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(frCA.caseIntelligence.loadFailed));
    expect(screen.getByText(frCA.caseIntelligence.humanReviewNotice)).toBeInTheDocument();
    expect(screen.queryByText(/Continuity interpretation/)).toBeNull();
  });
});
