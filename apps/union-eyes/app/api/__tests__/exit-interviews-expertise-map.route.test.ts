import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({
  exitInterviews: {
    organizationId: 'organizationId',
    status: 'status',
    roleInUnion: 'roleInUnion',
    expertiseTags: 'expertiseTags',
    topics: 'topics',
    continuityRiskScore: 'continuityRiskScore',
  },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn(() => 'and'),
    eq: vi.fn(() => 'eq'),
  };
});

async function loadRoute() {
  return import('../exit-interviews/expertise-map/route');
}

describe('exit-interviews/expertise-map route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx),
    );
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(async () => [
          {
            id: 'i1',
            roleInUnion: 'steward',
            expertiseTags: ['policy'],
            topics: ['policy'],
            continuityRiskScore: 4,
          },
        ]),
      })),
    } as any);
  });

  it('returns an expertise map as the handler payload, which withApi puts under data once', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });

    expect(result.organizationId).toBe('org_1');
    expect(result.domains).toHaveLength(1);
    // A `data` key of its own would reach the screen as json.data.data, one level below where it reads `domains`.
    expect(result).not.toHaveProperty('data');
  });

  // DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-OVER-TAG-COUNTS: averageRiskScore read 0 for a domain no interview ever
  // scored, indistinguishable from a domain genuinely scored 0. hasRiskData names which one it is.
  it('reports hasRiskData: true when a domain has a scored interview, false when none does', async () => {
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(async () => [
          { id: 'i1', roleInUnion: 'steward', expertiseTags: ['payroll'], topics: [], continuityRiskScore: 60 },
          { id: 'i2', roleInUnion: 'officer', expertiseTags: ['scheduling'], topics: [], continuityRiskScore: null },
        ]),
      })),
    } as any);
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });

    const payroll = result.domains.find((d: { domain: string }) => d.domain === 'payroll');
    const scheduling = result.domains.find((d: { domain: string }) => d.domain === 'scheduling');
    expect(payroll).toMatchObject({ hasRiskData: true, averageRiskScore: 60 });
    expect(scheduling).toMatchObject({ hasRiskData: false, averageRiskScore: 0 });
  });

  // DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-OVER-TAG-COUNTS: "returns the roles of the one interview behind a
  // single-source tag" - below the minimum cohort, roles are withheld rather than naming specific departing people.
  it('withholds roles for a domain below the minimum cohort size, and reports them once it is reached', async () => {
    m.db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(async () => [
          { id: 'i1', roleInUnion: 'steward', expertiseTags: ['payroll'], topics: [], continuityRiskScore: 60 },
          { id: 'i2', roleInUnion: 'officer', expertiseTags: ['scheduling'], topics: [], continuityRiskScore: null },
          { id: 'i3', roleInUnion: 'admin', expertiseTags: ['scheduling'], topics: [], continuityRiskScore: null },
          { id: 'i4', roleInUnion: 'chief_steward', expertiseTags: ['scheduling'], topics: [], continuityRiskScore: null },
          { id: 'i5', roleInUnion: 'member', expertiseTags: ['scheduling'], topics: [], continuityRiskScore: null },
          { id: 'i6', roleInUnion: 'steward', expertiseTags: ['scheduling'], topics: [], continuityRiskScore: null },
        ]),
      })),
    } as any);
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });

    const payroll = result.domains.find((d: { domain: string }) => d.domain === 'payroll');
    const scheduling = result.domains.find((d: { domain: string }) => d.domain === 'scheduling');
    expect(payroll.coverageCount).toBe(1);
    expect(payroll.rolesSuppressed).toBe(true);
    expect(payroll.roles).toEqual([]);
    expect(scheduling.coverageCount).toBe(5);
    expect(scheduling.rolesSuppressed).toBe(false);
    expect(scheduling.roles.length).toBeGreaterThan(0);
  });
});
