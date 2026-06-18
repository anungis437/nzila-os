import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
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
  };
});

async function loadRoute() {
  return import('../exit-interviews/governance-timeline/route');
}

describe('exit-interviews/governance-timeline route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx),
    );
    m.db.select
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  id: 'e1',
                  eventType: 'published',
                  createdAt: new Date('2026-01-01T00:00:00.000Z'),
                },
              ]),
            })),
          })),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [
              {
                id: 'i1',
                status: 'published',
                sensitivityLevel: 'public_internal',
                consentGranted: true,
                continuityRiskScore: 0.1,
                indexingStatus: 'complete',
                createdAt: new Date('2026-01-01T00:00:00.000Z'),
              },
            ]),
          })),
        })),
      }));
  });

  it('returns the governance timeline', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });

    expect(result.data.organizationId).toBe('org_1');
    expect(result.data.timelineFeed).toHaveLength(1);
  });
});
