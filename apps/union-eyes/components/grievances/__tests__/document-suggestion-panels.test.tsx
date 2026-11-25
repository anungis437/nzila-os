// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import type { RelatedDocumentRankResult } from '@/services/case-intelligence/types';
import { RelatedDocumentsPanel } from '../related-documents-panel';
import { PrecedentDocumentsPanel } from '../precedent-documents-panel';

const DOC = '99999999-9999-4999-8999-999999999999';
const suggestion = {
  documentId: DOC,
  title: 'Award 2019',
  privacyLabel: 'team_confidential',
  finalScore: 80,
  baseScore: 80,
  mlScore: 0,
  reasons: ['Same agreement'],
  scoreBreakdown: {},
  documentType: 'award',
  linkedEntities: [],
  updatedAt: '2026-02-01T00:00:00.000Z',
} satisfies RelatedDocumentRankResult;

let download: () => Response;
const fetchMock = vi.fn(async (url: string) => {
  if (url === `/api/documents/${DOC}/download`) return download();
  return Response.json({ message: `unexpected ${url}` }, { status: 404 });
});
const open = vi.fn();

beforeEach(() => {
  download = () => standardSuccessResponse({ id: DOC, title: 'Award 2019', mimeType: 'application/pdf', downloadUrl: `/api/documents/${DOC}/content?lease=signed` });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('open', open);
});
afterEach(() => {
  cleanup();
  fetchMock.mockClear();
  open.mockReset();
  vi.unstubAllGlobals();
});

const shell = (locale: 'en-CA' | 'fr-CA', ui: React.ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      {ui}
    </NextIntlClientProvider>,
  );

const panels = {
  related: (locale: 'en-CA' | 'fr-CA') => shell(locale, <RelatedDocumentsPanel documents={[suggestion]} />),
  precedent: (locale: 'en-CA' | 'fr-CA') => shell(locale, <PrecedentDocumentsPanel documents={[suggestion]} />),
};

describe.each(['related', 'precedent'] as const)('%s documents panel: opening a suggested document', (kind) => {
  it('has no link to a stored address and opens only the audited, time-limited link', async () => {
    panels[kind]('en-CA');

    expect(document.querySelectorAll('a[href^="http"]')).toHaveLength(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Download: Award 2019|View: Award 2019/ })[0]);

    await waitFor(() => expect(open).toHaveBeenCalledWith(`/api/documents/${DOC}/content?lease=signed`, '_blank', 'noopener,noreferrer'));
    expect(fetchMock).toHaveBeenCalledWith(`/api/documents/${DOC}/download`, expect.anything());
  });

  it('says the document is not available to the person, in English, and opens nothing', async () => {
    download = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'No access');
    panels[kind]('en-CA');

    fireEvent.click(screen.getAllByRole('button', { name: /Award 2019/ })[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to open this document.');
    expect(open).not.toHaveBeenCalled();
  });

  it('says it in French when the service is unavailable, without the server text', async () => {
    download = () => standardErrorResponse(ErrorCode.EXTERNAL_SERVICE_ERROR, 'Bucket nzila-private is down');
    panels[kind]('fr-CA');

    fireEvent.click(screen.getAllByRole('button', { name: /Award 2019/ })[0]);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/Bucket|nzila-private/);
    expect(alert.textContent).toMatch(/[éèà]|document/i);
    expect(open).not.toHaveBeenCalled();
  });
});
