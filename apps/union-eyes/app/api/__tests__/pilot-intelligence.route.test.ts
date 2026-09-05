import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn((_n: number) => ({
        for: vi.fn((_mode: string) => nextSelect()),
      })),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  return {
    state,
    hasMinRole: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    queueSelect: (...rows: unknown[][]) => state.selectQueue.push(...rows),
    resetQueues: () => {
      state.selectQueue = [];
    },
    createSelectChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
  })),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (fn: (tx?: unknown) => Promise<unknown>) => fn(mockDb),
}));
vi.mock('@/lib/pilot/pilot-ownership', () => ({
  enforcePilotOwnership: vi.fn(async () => null),
  wrapPilotItemRoute: <T,>(handler: T) => handler,
  authorizePilotAccess: vi.fn(async () => ({ ok: true, reason: 'platform', actorOrganizationId: null })),
  getPilotClaimedOrganizationId: vi.fn(() => 'test-org'),
  getPilotEffectiveOrganizationId: vi.fn(() => 'test-org'),
}));
vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: m.hasMinRole,
  withApiAuth: vi.fn(
    (handler: (req: NextRequest, ctx?: { params?: Promise<{ id: string }> | { id: string } }) => Promise<Response>) =>
      (req: NextRequest, ctx?: { params?: Promise<{ id: string }> | { id: string } }) => handler(req, ctx)
  ),
}));

async function loadRoute() {
  return import('../pilot/apply/[id]/intelligence/route');
}

describe('pilot/apply/[id]/intelligence route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.hasMinRole.mockResolvedValue(true);
  });

  it('GET returns 403 when caller lacks role', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/app-1/intelligence'), { params: { id: 'app-1' } });

    expect(response.status).toBe(403);
  }, 60000);

  it('GET returns 400 when id is missing', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/intelligence'), {});

    expect(response.status).toBe(400);
  });

  it('GET returns normalized intelligence data and counts', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([
      {
        id: 'app-1',
        responses: {
          pilotIntelligence: {
            lessonsLearned: ['lesson-1', 7],
            objectionsRaised: ['obj-1'],
            requestedFeatures: ['feat-1'],
            deploymentBlockers: ['block-1'],
            stakeholderSentiment: [{ stakeholder: 'board', sentiment: 'positive' }],
          },
        },
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/app-1/intelligence'), {
      params: Promise.resolve({ id: 'app-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.counts).toMatchObject({
      lessonsLearned: 1,
      objectionsRaised: 1,
      requestedFeatures: 1,
      deploymentBlockers: 1,
      stakeholderSentiment: 1,
    });
  });

  it('POST returns 404 when pilot application is missing', async () => {
    const { POST } = await loadRoute();
    m.queueSelect([]);

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/app-2/intelligence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lessonLearned: 'x' }),
      }),
      { params: { id: 'app-2' } },
    );

    expect(response.status).toBe(404);
  });

  it('POST appends intelligence signals and returns updated payload', async () => {
    const { POST } = await loadRoute();
    m.queueSelect([
      {
        id: 'app-3',
        responses: {
          pilotIntelligence: {
            lessonsLearned: ['existing'],
            interactionTimeline: [{ at: '2026-01-01T00:00:00.000Z', type: 'existing' }],
          },
        },
      },
    ]);

    const response = await POST(
      new NextRequest('http://localhost/api/pilot/apply/app-3/intelligence', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lessonLearned: '  new lesson  ',
          objectionRaised: 'price concern',
          requestedFeature: 'mobile app',
          deploymentBlocker: 'security review',
          stakeholderSentiment: { stakeholder: 'exec', sentiment: 'neutral', note: 'watching closely' },
          source: 'test',
        }),
      }),
      { params: { id: 'app-3' } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe('app-3');
    expect(payload.data.pilotIntelligence.lessonsLearned).toEqual(expect.arrayContaining(['existing', 'new lesson']));
    expect(payload.data.pilotIntelligence.interactionTimeline.length).toBeGreaterThan(1);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('returns 500 when route throws unexpectedly', async () => {
    const { GET } = await loadRoute();
    mockDb.select.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/app-4/intelligence'), { params: { id: 'app-4' } });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: 'Failed to load pilot intelligence' });
  });
});
