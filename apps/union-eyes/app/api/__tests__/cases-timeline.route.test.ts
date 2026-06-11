import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db/schema', () => ({ claimUpdates: {}, grievanceTimeline: {} }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn(() => 'eq'),
    desc: vi.fn(() => 'desc'),
    sql: vi.fn(() => 'sql'),
  };
});

async function loadRoute() {
  return import('../cases/[caseId]/timeline/route');
}

describe('cases/[caseId]/timeline route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withApi.mockImplementation((_cfg: unknown, handler: any) => {
      return (ctx: any = {}) => handler(ctx);
    });

    let call = 0;
    m.withRLSContext.mockImplementation(async (fn: any) => {
      call += 1;
      if (call === 1) {
        return [{ claim_id: 'claim_1' }];
      }
      if (call === 2) {
        const tx = {
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(async () => [
                  { updateId: 'u1', createdAt: new Date(), updateType: 'status_change', message: 'Updated', createdBy: 'u1' },
                ]),
              })),
            })),
          })),
        };
        return fn(tx);
      }
      if (call === 3) {
        return [{ grievance_id: 'g1' }];
      }
      const tx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(async () => []),
            })),
          })),
        })),
      };
      return fn(tx);
    });
  });

  it('returns empty data when caseId is missing', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: {} });
    expect(result.data).toEqual([]);
  });

  it('returns timeline data for resolved case id', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { caseId: 'case_1' } });

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });
});
