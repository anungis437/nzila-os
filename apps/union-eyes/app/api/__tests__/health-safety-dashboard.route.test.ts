import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { execute: vi.fn(async () => [{ cnt: 0, training_due: 0, last_dt: null }]) },
  withRLSContext: vi.fn(),
  sqlCalls: [] as Array<{ strings: TemplateStringsArray; values: unknown[] }>,
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    internal: (msg: string) => Object.assign(new Error(msg), { status: 500 }),
  },
  z: require('zod'),
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    m.sqlCalls.push({ strings, values });
    return { strings, values };
  };
  return { ...actual, sql: Object.assign(sql, { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../health-safety/dashboard/route');
}

describe('health-safety/dashboard route (PR #752 round 17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.sqlCalls.length = 0;
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation(async (_scope: unknown, fn: (tx: typeof m.db) => Promise<unknown>) => fn(m.db));
    m.db.execute.mockImplementation(async () => [{ cnt: 0, training_due: 0, last_dt: null }]);
  });

  it('scopes every query to the auth-resolved organizationId, ignoring a client-supplied ?organizationId= query param', async () => {
    const { GET } = await loadRoute();

    await GET({
      request: {
        url: 'http://localhost/api/health-safety/dashboard?organizationId=org-attacker-supplied&period=30d',
      },
      organizationId: 'org-context-resolved',
    });

    const orgFilterCalls = m.sqlCalls.filter((c) => c.strings[0] === 'organization_id = ');
    expect(orgFilterCalls.length).toBeGreaterThan(0);
    for (const call of orgFilterCalls) {
      expect(call.values).toEqual(['org-context-resolved']);
    }
    expect(m.sqlCalls.some((c) => c.values.includes('org-attacker-supplied'))).toBe(false);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-context-resolved' }, expect.any(Function));
  });

  // DEF-0B8-HS-DASHBOARD-TRAINING-COMPLIANCE-IS-A-CONSTANT
  it('refuses a request with no organization context instead of reading every organization', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ request: { url: 'http://localhost/api/health-safety/dashboard' }, organizationId: null })).rejects.toThrow('Organization context required');
    expect(m.db.execute).not.toHaveBeenCalled();
  });

  it('reports training compliance as not measured, never as a constant', async () => {
    m.db.execute.mockImplementation(async () => [{ cnt: 7, last_dt: null }]);
    const { GET } = await loadRoute();
    const result = (await GET({ request: { url: 'http://localhost/api/health-safety/dashboard' }, organizationId: 'org-1' })) as { metrics: Record<string, unknown> };
    expect(result.metrics.trainingCompliance).toBeNull();
    expect(result.metrics.trainingCompliance).not.toBe(92);
  });

  it('reports no measurement, not an invented 100% or 90 days, when there are no inspections or incidents', async () => {
    m.db.execute.mockImplementation(async () => [{ cnt: 0, last_dt: null }]);
    const { GET } = await loadRoute();
    const result = (await GET({ request: { url: 'http://localhost/api/health-safety/dashboard' }, organizationId: 'org-1' })) as { metrics: Record<string, unknown> };
    expect(result.metrics.inspectionComplianceRate).toBeNull();
    expect(result.metrics.daysWithoutIncident).toBeNull();
  });

  describe('incident change against the previous period', () => {
    // The first two queries count the incidents of this period and of the one before it.
    async function changeFor(current: number, previous: number) {
      m.db.execute
        .mockImplementationOnce(async () => [{ cnt: current, training_due: 0, last_dt: null }])
        .mockImplementationOnce(async () => [{ cnt: previous, training_due: 0, last_dt: null }]);
      const { GET } = await loadRoute();
      const result = (await GET({ request: { url: 'http://localhost/api/health-safety/dashboard' }, organizationId: 'org-1' })) as { metrics: Record<string, unknown> };
      return result.metrics;
    }

    it('gives no percentage, not 0%, when the previous period had no incident, and still says the count went up', async () => {
      const metrics = await changeFor(5, 0);
      expect(metrics.totalIncidents).toBe(5);
      expect(metrics.incidentChange).toBeNull();
      expect(metrics.incidentTrend).toBe('up');
    });

    it('is stable, with nothing to compare, when neither period had an incident', async () => {
      const metrics = await changeFor(0, 0);
      expect(metrics.incidentChange).toBeNull();
      expect(metrics.incidentTrend).toBe('stable');
    });

    it('gives the percentage against the previous period, with its direction', async () => {
      expect(await changeFor(6, 4)).toMatchObject({ incidentChange: 50, incidentTrend: 'up' });
      expect(await changeFor(3, 4)).toMatchObject({ incidentChange: -25, incidentTrend: 'down' });
      expect(await changeFor(4, 4)).toMatchObject({ incidentChange: 0, incidentTrend: 'stable' });
    });
  });

  it('fails when a query fails, rather than answering success with zeros', async () => {
    m.db.execute.mockRejectedValue(new Error('db down'));
    const { GET } = await loadRoute();
    await expect(GET({ request: { url: 'http://localhost/api/health-safety/dashboard' }, organizationId: 'org-1' })).rejects.toThrow('Failed to load health and safety metrics');
  });
});
