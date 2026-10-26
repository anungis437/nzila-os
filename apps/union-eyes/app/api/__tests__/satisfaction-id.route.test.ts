import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getOwnSatisfactionSurvey: vi.fn(),
  submitSatisfactionRatings: vi.fn(),
  declineSurvey: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
    static notFound = (what: string) => new ApiError(404, `${what} not found`);
    static badRequest = (message: string) => new ApiError(400, message);
    static conflict = (message: string) => new ApiError(409, message);
  }
  return { withApi: m.withApi, ApiError, z: require('zod') };
});
vi.mock('@/lib/services/satisfaction-service', () => ({
  getOwnSatisfactionSurvey: m.getOwnSatisfactionSurvey,
  submitSatisfactionRatings: m.submitSatisfactionRatings,
  declineSurvey: m.declineSurvey,
}));

async function loadRoute() {
  return import('../satisfaction/[id]/route');
}

const ratings = {
  action: 'submit',
  communicationRating: 5,
  responsivenessRating: 5,
  knowledgeRating: 5,
  advocacyRating: 5,
  professionalismRating: 5,
  outcomeRating: 5,
};

describe('satisfaction/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.getOwnSatisfactionSurvey.mockResolvedValue({ id: 's1', title: 'Survey' });
    m.submitSatisfactionRatings.mockResolvedValue({ id: 's1', status: 'submitted' });
    m.declineSurvey.mockResolvedValue({ id: 's1', status: 'declined' });
  });

  it('returns the caller\u2019s own survey, looked up by member and organization', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { id: 's1' }, userId: 'u1', organizationId: 'org1' });

    expect(result).toEqual({ id: 's1', title: 'Survey' });
    expect(m.getOwnSatisfactionSurvey).toHaveBeenCalledWith('s1', 'u1', 'org1');
  });

  it('answers not found for a survey that is not the caller\u2019s own (another member or organization)', async () => {
    const { GET } = await loadRoute();
    m.getOwnSatisfactionSurvey.mockResolvedValueOnce(null);

    await expect(GET({ params: { id: 's-other' }, userId: 'u1', organizationId: 'org1' })).rejects.toMatchObject({ status: 404 });
  });

  it('submits survey ratings scoped to the caller and organization', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ params: { id: 's1' }, userId: 'u1', organizationId: 'org1', body: ratings });

    expect(result).toEqual({ id: 's1', status: 'submitted' });
    expect(m.submitSatisfactionRatings).toHaveBeenCalledWith('s1', 'u1', expect.objectContaining({ outcomeRating: 5 }), 'org1');
  });

  it('declines a survey scoped to the caller and organization', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ params: { id: 's1' }, userId: 'u1', organizationId: 'org1', body: { action: 'decline' } });

    expect(result).toEqual({ id: 's1', status: 'declined' });
    expect(m.declineSurvey).toHaveBeenCalledWith('s1', 'u1', 'org1');
  });

  it('answers another member\u2019s survey as not found', async () => {
    const { POST } = await loadRoute();
    m.submitSatisfactionRatings.mockRejectedValueOnce(new Error('Not authorized to submit this survey'));

    await expect(
      POST({ params: { id: 's1' }, userId: 'u2', organizationId: 'org1', body: ratings }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('answers a completed survey as a conflict', async () => {
    const { POST } = await loadRoute();
    m.submitSatisfactionRatings.mockRejectedValueOnce(new Error('Survey already completed'));

    await expect(
      POST({ params: { id: 's1' }, userId: 'u1', organizationId: 'org1', body: ratings }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('refuses a request with no organization context', async () => {
    const { POST } = await loadRoute();

    await expect(POST({ params: { id: 's1' }, userId: 'u1', body: ratings })).rejects.toMatchObject({ status: 400 });
    expect(m.submitSatisfactionRatings).not.toHaveBeenCalled();
  });
});
