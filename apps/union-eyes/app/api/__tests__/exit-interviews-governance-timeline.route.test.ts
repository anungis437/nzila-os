import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn() },
  interviews: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { externalService: (service: string, message: string) => new Error(service + ': ' + message) },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({
  exitInterviews: {
    id: 'id',
    title: 'title',
    status: 'status',
    sensitivityLevel: 'sensitivityLevel',
    consentGranted: 'consentGranted',
    continuityRiskScore: 'continuityRiskScore',
    indexingStatus: 'indexingStatus',
    createdAt: 'createdAt',
    publishedAt: 'publishedAt',
    reviewedAt: 'reviewedAt',
    organizationId: 'organizationId',
  },
  exitInterviewEvents: {
    id: 'id',
    interviewId: 'interviewId',
    eventType: 'eventType',
    notes: 'notes',
    payload: 'payload',
    actorUserId: 'actorUserId',
    createdAt: 'createdAt',
    organizationId: 'organizationId',
  },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn(() => 'and'),
    eq: vi.fn(() => 'eq'),
    gte: vi.fn(() => 'gte'),
    desc: vi.fn(() => 'desc'),
    inArray: vi.fn(() => 'inArray'),
  };
});

async function loadRoute() {
  return import('../exit-interviews/governance-timeline/route');
}

describe('exit-interviews/governance-timeline route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.interviews = [
      { id: 'i1', status: 'published', sensitivityLevel: 'public_internal', consentGranted: true, continuityRiskScore: 0.1, indexingStatus: 'complete', createdAt: new Date('2026-01-01T00:00:00.000Z') },
    ];
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx),
    );
    // Call order: the visible-interview sub-select (inside the shared event scope), the event feed, the interview window,
    // the per-type event counts and the governance_updated count of the last 30 days.
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => 'visible-interviews') })) }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => [
                { id: 'e1', eventType: 'published', createdAt: new Date('2026-01-01T00:00:00.000Z') },
              ]),
            })),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => m.interviews),
            })),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({ where: vi.fn(() => ({ groupBy: vi.fn(async () => [{ eventType: 'published', total: 1 }, { eventType: 'governance_updated', total: 742 }]) })) })),
      }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ total: 31 }]) })) }));
  });

  it('returns the governance timeline', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });

    expect(result.data.organizationId).toBe('org_1');
    expect(result.data.timelineFeed).toHaveLength(1);
  });

  // DEF-0B7-COGA-TIMELINE-COUNTS-CAPPED-AND-INTERVIEW-WINDOW-UNBOUNDED
  it('counts every event in the window, not just the 500 of the feed', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });

    expect(result.data.eventTypeCounts).toEqual({ published: 1, governance_updated: 742 });
    expect(result.data.governanceUpdatesLast30Days).toBe(31);
  });

  it('refuses an interview window larger than the safe limit instead of cutting it silently', async () => {
    m.interviews = Array.from({ length: 5001 }, (_, i) => ({ id: `i${i}`, status: 'draft', sensitivityLevel: 'public_internal', indexingStatus: 'pending', createdAt: new Date('2026-01-01T00:00:00.000Z') }));
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1' })).rejects.toThrow(/safe limits/);
  });
});
