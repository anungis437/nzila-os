import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  hasSupervisoryCaseRead: vi.fn(),
  rows: [] as unknown[],
  where: vi.fn(),
  eq: vi.fn(),
  scope: vi.fn(),
}));

class TestApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
  static badRequest(message: string) { return new TestApiError(message, 400); }
}

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => (ctx: unknown) => handler(ctx),
  ApiError: TestApiError,
}));
vi.mock('@/db', () => ({
  db: { select: () => ({ from: () => ({ where: async (condition: unknown) => { m.where(condition); return m.rows; } }) }) },
}));
vi.mock('@/db/schema/domains/claims/grievances', () => ({ grievances: { organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', () => ({ eq: (a: unknown, b: unknown) => { m.eq(a, b); return { eq: [a, b] }; } }));
vi.mock('@/lib/cases/supervisory-case-read', () => ({ hasSupervisoryCaseRead: m.hasSupervisoryCaseRead }));
vi.mock('@/lib/cases/grievance-list-scope', () => ({
  grievanceCaseAuthorityScope: (organizationId: string, userId: string) => { m.scope(organizationId, userId); return 'ACTOR_SCOPE'; },
}));

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

describe('GET /api/grievances/workload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.hasSupervisoryCaseRead.mockResolvedValue(false);
    m.rows = [
      { status: 'filed', createdAt: iso(40) },
      { status: 'filed', createdAt: iso(2) },
      { status: 'closed', createdAt: iso(1) },
    ];
  });

  it('requires organization and actor context', async () => {
    const { GET } = await import('../grievances/workload/route');
    await expect(GET({ userId: 'u1' })).rejects.toMatchObject({ status: 400 });
    await expect(GET({ organizationId: 'org-1' })).rejects.toMatchObject({ status: 400 });
  });

  it("scopes an ordinary steward's card to matters they hold authority over", async () => {
    const { GET } = await import('../grievances/workload/route');
    const result = await GET({ organizationId: 'org-1', userId: 'steward-1' }) as { data: Record<string, number> };
    expect(m.scope).toHaveBeenCalledWith('org-1', 'steward-1');
    expect(m.where).toHaveBeenCalledWith('ACTOR_SCOPE');
    expect(result.data).toMatchObject({ activeCases: 2, overdueCases: 1, casesThisWeek: 2 });
  });

  it('gives supervisory authority the organization-wide figure', async () => {
    m.hasSupervisoryCaseRead.mockResolvedValue(true);
    const { GET } = await import('../grievances/workload/route');
    await GET({ organizationId: 'org-1', userId: 'chief-1' });
    expect(m.scope).not.toHaveBeenCalled();
    expect(m.eq).toHaveBeenCalledWith(expect.anything(), 'org-1');
  });
});
