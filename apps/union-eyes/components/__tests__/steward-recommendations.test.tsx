// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { StewardRecommendations } from '../steward-recommendations';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const candidate = {
  stewardId: 'steward-1',
  userId: 'user-12345678-abcd',
  region: 'Ontario',
  specialization: 'Discipline',
  currentCaseload: 2,
  maxCaseload: 10,
  score: 87,
};

type Answer = Pick<Response, 'ok' | 'status' | 'json'>;
const answer = (body: unknown, status = 200): Answer => ({ ok: status < 400, status, json: async () => body });

/**
 * The recommendation request answers as the route does, with the framework's own response builders (the route returns
 * standardSuccessResponse(candidates) and standardErrorResponse(...) as they are); the assignment request answers as given.
 */
function server(assign: () => Promise<Answer>, recommend: () => Answer = () => standardSuccessResponse([candidate])) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith('/recommend-steward')) return recommend();
    return assign();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mount(onAssign = vi.fn(), locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <StewardRecommendations grievanceId="grievance-1" onAssign={onAssign} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: locale === 'en-CA' ? 'Find Best Match' : 'Trouver la meilleure correspondance' }));
  return onAssign;
}

async function showCandidates(onAssign = vi.fn(), locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  mount(onAssign, locale);
  const assign = await screen.findByRole('button', { name: locale === 'en-CA' ? 'Assign' : 'Attribuer' });
  return { assign, onAssign };
}

describe('StewardRecommendations: the recommendation request', () => {
  it('asks with POST and lists the candidates the route answers with', async () => {
    const fetchMock = server(async () => answer({}));
    await showCandidates();

    expect(fetchMock).toHaveBeenCalledWith('/api/grievances/grievance-1/recommend-steward', expect.objectContaining({ method: 'POST' }));
    expect(screen.getByText('Steward user-123…')).toBeInTheDocument();
    expect(screen.getByText('Ontario')).toBeInTheDocument();
    expect(screen.getByText('Discipline')).toBeInTheDocument();
    expect(screen.getByText('Load: 2/10')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.queryByText(/No steward could be recommended/)).toBeNull();
  });

  it('shows the reason a refused recommendation gives, as the route states it, not a generic failure', async () => {
    server(
      async () => answer({}),
      () => standardErrorResponse(ErrorCode.FORBIDDEN, 'The authority kernel did not authorize this recommendation.'),
    );
    mount();

    expect(await screen.findByText('The authority kernel did not authorize this recommendation.')).toBeInTheDocument();
    expect(screen.queryByText(enCA.steward.recommendations.failedToGet)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Assign' })).toBeNull();
  });

  it('says nobody could be recommended when the route recommends nobody, not the first-use prompt', async () => {
    server(
      async () => answer({}),
      () => standardSuccessResponse([]),
    );
    mount();

    expect(await screen.findByText('No steward could be recommended for this grievance.')).toBeInTheDocument();
    expect(screen.queryByText(/to rank available stewards/)).toBeNull();
  });

  it('shows the first-use prompt only before a search has answered', () => {
    server(async () => answer({}));
    render(
      <NextIntlClientProvider locale="en-CA" messages={enCA}>
        <StewardRecommendations grievanceId="grievance-1" />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(/to rank available stewards/)).toBeInTheDocument();
    expect(screen.queryByText('No steward could be recommended for this grievance.')).toBeNull();
  });

  it('treats an answer that carries no candidate list, or a malformed candidate, as a failure instead of rendering it', async () => {
    server(
      async () => answer({}),
      () => standardSuccessResponse({ candidates: [] }),
    );
    mount();
    expect(await screen.findByText(enCA.steward.recommendations.failedToGet)).toBeInTheDocument();
    cleanup();

    server(
      async () => answer({}),
      () => standardSuccessResponse([{ stewardId: 'steward-1' }]),
    );
    mount();
    expect(await screen.findByText(enCA.steward.recommendations.failedToGet)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Assign' })).toBeNull();
  });

  it('says so when the request itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('connection reset');
    }));
    mount();

    expect(await screen.findByText(enCA.steward.recommendations.networkError)).toBeInTheDocument();
  });

  it('labels a candidate in French on a French locale', async () => {
    server(async () => answer({}));
    await showCandidates(vi.fn(), 'fr-CA');

    expect(screen.getByText('Représentant user-123…')).toBeInTheDocument();
    expect(screen.getByText('Charge: 2/10')).toBeInTheDocument();
  });

  it('says nobody could be recommended in French', async () => {
    server(
      async () => answer({}),
      () => standardSuccessResponse([]),
    );
    mount(vi.fn(), 'fr-CA');

    expect(await screen.findByText('Aucun représentant n’a pu être recommandé pour ce grief.')).toBeInTheDocument();
  });
});

describe('StewardRecommendations: assignment', () => {
  it('assigns with PATCH /api/grievances/:id/assign and the chosen steward, the method and body the route exports', async () => {
    const fetchMock = server(async () => standardSuccessResponse({}));
    const { assign, onAssign } = await showCandidates();

    fireEvent.click(assign);

    await waitFor(() => expect(onAssign).toHaveBeenCalledWith('steward-1'));
    const assignCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/grievances/grievance-1/assign');
    expect(assignCalls).toHaveLength(1);
    expect(assignCalls[0][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ stewardId: 'steward-1' }) });
  });

  it('shows the reason a refused assignment gives, and does not report it as assigned', async () => {
    server(async () => standardErrorResponse(ErrorCode.FORBIDDEN, 'The authority kernel did not authorize this assignment'));
    const { assign, onAssign } = await showCandidates();

    fireEvent.click(assign);

    expect(await screen.findByText('The authority kernel did not authorize this assignment')).toBeInTheDocument();
    expect(onAssign).not.toHaveBeenCalled();
  });

  it('says so when a refusal gives no reason, in the language of the page', async () => {
    server(async () => answer('nothing useful', 500));
    const english = await showCandidates();
    fireEvent.click(english.assign);
    expect(await screen.findByText('The steward could not be assigned.')).toBeInTheDocument();
    cleanup();

    server(async () => answer(null, 500));
    const french = await showCandidates(vi.fn(), 'fr-CA');
    fireEvent.click(french.assign);
    expect(await screen.findByText('Le représentant n’a pas pu être attribué.')).toBeInTheDocument();
    expect(french.onAssign).not.toHaveBeenCalled();
  });

  it('says so when the request itself fails, instead of ending silently', async () => {
    server(async () => {
      throw new Error('connection reset');
    });
    const { assign, onAssign } = await showCandidates();

    fireEvent.click(assign);

    expect(await screen.findByText(enCA.steward.recommendations.networkError)).toBeInTheDocument();
    expect(onAssign).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Assign' })).toBeEnabled();
  });
});
