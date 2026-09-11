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
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (fn: (tx?: unknown) => Promise<unknown>) => fn(),
}));
vi.mock('@/lib/pilot/pilot-ownership', () => ({
  enforcePilotOwnership: vi.fn(async () => null),
  wrapPilotItemRoute: <T,>(handler: T) => handler,
  authorizePilotAccess: vi.fn(async () => ({ ok: true })),
  getPilotClaimedOrganizationId: vi.fn(() => 'test-org'),
}));
vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    hasMinRole: m.hasMinRole,
    withApiAuth: vi.fn(
      (handler: (req: NextRequest, ctx?: { params?: Promise<{ id: string }> | { id: string } }) => Promise<Response>) =>
        (req: NextRequest, ctx?: { params?: Promise<{ id: string }> | { id: string } }) => handler(req, ctx)
    ),
  };
});

async function loadRoute() {
  return import('../pilot/apply/[id]/commercialization-timeline/route');
}

describe('pilot/apply/[id]/commercialization-timeline route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.hasMinRole.mockResolvedValue(true);
  });

  it('returns 403 when caller lacks steward role', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/app-1/commercialization-timeline'), {
      params: { id: 'app-1' },
    });

    expect(response.status).toBe(403);
  });

  it('returns 400 when application id is missing', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/commercialization-timeline'), {});

    expect(response.status).toBe(400);
  });

  it('returns 404 when pilot application is not found', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([]);

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/app-1/commercialization-timeline'), {
      params: { id: 'app-1' },
    });

    expect(response.status).toBe(404);
  });

  it('returns normalized timeline events sorted by descending time', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([
      {
        id: 'app-1',
        organizationName: 'Union Eyes',
        responses: {
          commercialTransitionHistory: [
            { at: '2026-01-01T00:00:00.000Z', from: 'proposal_ready', to: 'contract_sent', source: 'agent' },
            { at: 'invalid-date', from: 'x', to: 'y' },
          ],
          pilotArtifactVersions: [
            { createdAt: '2026-01-02T00:00:00.000Z', versionId: 'v1', milestone: 'alpha', source: 'pipeline' },
          ],
          pilotReferenceVersions: [
            { createdAt: '2026-01-03T00:00:00.000Z', versionId: 'r1', milestone: 'beta', source: 'system' },
          ],
          pilotIntelligence: {
            interactionTimeline: [
              { at: '2026-01-04T00:00:00.000Z', type: 'meeting', source: 'crm' },
            ],
          },
        },
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/app-1/commercialization-timeline'), {
      params: Promise.resolve({ id: 'app-1' }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ pilotId: 'app-1', organizationName: 'Union Eyes', totalEvents: 4 });
    expect(payload.data.events[0].at >= payload.data.events[1].at).toBe(true);
  });

  it('returns 500 when an unexpected error occurs', async () => {
    const { GET } = await loadRoute();
    mockDb.select.mockImplementationOnce(() => {
      throw new Error('db explosion');
    });

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/app-1/commercialization-timeline'), {
      params: { id: 'app-1' },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: 'Failed to load commercialization timeline' });
  });
});
