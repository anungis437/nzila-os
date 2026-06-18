import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getSatisfactionSurvey: vi.fn(),
  submitSatisfactionRatings: vi.fn(),
  declineSurvey: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/lib/services/satisfaction-service', () => ({
  getSatisfactionSurvey: m.getSatisfactionSurvey,
  submitSatisfactionRatings: m.submitSatisfactionRatings,
  declineSurvey: m.declineSurvey,
}));

async function loadRoute() {
  return import('../satisfaction/[id]/route');
}

describe('satisfaction/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.getSatisfactionSurvey.mockResolvedValue({ id: 's1', title: 'Survey' });
    m.submitSatisfactionRatings.mockResolvedValue({ id: 's1', status: 'submitted' });
    m.declineSurvey.mockResolvedValue({ id: 's1', status: 'declined' });
  });

  it('returns a satisfaction survey', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { id: 's1' } });

    expect(result).toEqual({ id: 's1', title: 'Survey' });
  });

  it('submits survey ratings', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      params: { id: 's1' },
      userId: 'u1',
      body: { action: 'submit', communicationRating: 5, responsivenessRating: 5, knowledgeRating: 5, advocacyRating: 5, professionalismRating: 5, outcomeRating: 5 },
    });

    expect(result).toEqual({ id: 's1', status: 'submitted' });
  });

  it('declines a survey', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ params: { id: 's1' }, userId: 'u1', body: { action: 'decline' } });

    expect(result).toEqual({ id: 's1', status: 'declined' });
  });
});