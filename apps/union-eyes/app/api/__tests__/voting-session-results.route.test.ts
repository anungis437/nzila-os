import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getVotingSessionById: vi.fn(),
  calculateResults: vi.fn(),
  getSessionStatistics: vi.fn(),
  calculateRankedChoiceResults: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
}));
vi.mock('@/lib/services/voting-service', () => ({
  getVotingSessionById: m.getVotingSessionById,
  calculateResults: m.calculateResults,
  getSessionStatistics: m.getSessionStatistics,
  calculateRankedChoiceResults: m.calculateRankedChoiceResults,
}));
vi.mock('@/lib/api/errors', () => ({
  ApiError: {
    notFound: (resource: string) => new Error(`${resource} not found`),
  },
}));

async function loadRoute() {
  return import('../voting/sessions/[id]/results/route');
}

describe('voting/sessions/[id]/results route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withApi.mockImplementation(
      (_config: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (_req: NextRequest, context: any = { params: { id: 'sess_1' } }) => {
          try {
            const result = await handler({ params: context.params });
            return new Response(JSON.stringify(result), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            const status = message.includes('not found') ? 404 : 500;
            return new Response(JSON.stringify({ error: message }), { status });
          }
        },
    );

    m.getVotingSessionById.mockResolvedValue({
      id: 'sess_1',
      title: 'General Vote',
      status: 'closed',
      type: 'general',
    });
    m.calculateResults.mockResolvedValue({ winner: 'option_1', totalVotes: 100 });
    m.getSessionStatistics.mockResolvedValue({ turnout: 0.68, eligibleVoters: 150 });
    m.calculateRankedChoiceResults.mockResolvedValue({ rounds: [{ round: 1, eliminated: 'option_3' }] });
  });

  it('returns 404 when session does not exist', async () => {
    const { GET } = await loadRoute();
    m.getVotingSessionById.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest('http://localhost/api/voting/sessions/sess_1/results'), {
      params: { id: 'sess_1' },
    });

    expect(response.status).toBe(404);
  });

  it('returns results payload for non-convention sessions', async () => {
    const { GET } = await loadRoute();
    m.getVotingSessionById.mockResolvedValueOnce({
      id: 'sess_1',
      title: 'General Vote',
      status: 'closed',
      type: 'general',
    });

    const response = await GET(new NextRequest('http://localhost/api/voting/sessions/sess_1/results'), {
      params: { id: 'sess_1' },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rankedChoiceResults).toBeNull();
    expect(payload.results).toMatchObject({ winner: 'option_1' });
  });

  it('includes ranked-choice results for convention sessions', async () => {
    const { GET } = await loadRoute();
    m.getVotingSessionById.mockResolvedValueOnce({
      id: 'sess_1',
      title: 'Convention Vote',
      status: 'closed',
      type: 'convention',
    });

    const response = await GET(new NextRequest('http://localhost/api/voting/sessions/sess_1/results'), {
      params: { id: 'sess_1' },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rankedChoiceResults).toMatchObject({ rounds: [{ round: 1, eliminated: 'option_3' }] });
  });

  it('swallows ranked-choice calculation errors when data is insufficient', async () => {
    const { GET } = await loadRoute();
    m.getVotingSessionById.mockResolvedValueOnce({
      id: 'sess_1',
      title: 'Convention Vote',
      status: 'closed',
      type: 'convention',
    });
    m.calculateRankedChoiceResults.mockRejectedValueOnce(new Error('not enough ballots'));

    const response = await GET(new NextRequest('http://localhost/api/voting/sessions/sess_1/results'), {
      params: { id: 'sess_1' },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rankedChoiceResults).toBeNull();
  });
});
