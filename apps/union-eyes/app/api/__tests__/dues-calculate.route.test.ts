import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => {
  // The member lookup of the own-record decision: select().from().where().limit() answers the queued memberships
  const memberships: unknown[][] = [];
  const chain: Record<string, unknown> = {};
  for (const name of ['from', 'where']) chain[name] = vi.fn(() => chain);
  chain.limit = vi.fn(async () => memberships.shift() ?? []);
  const db = { select: vi.fn(() => chain) };
  return {
    hasRole: vi.fn(),
    requireEntitlement: vi.fn(),
    checkRateLimit: vi.fn(),
    createRateLimitHeaders: vi.fn(),
    DuesCalculationEngine: { calculateMemberDues: vi.fn() },
    logApiAuditEvent: vi.fn(),
    db,
    memberships,
  };
});

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: { id: 'id', userId: 'userId', organizationId: 'organizationId' } }));
vi.mock('@/lib/api-auth-guard', () => ({ hasRole: m.hasRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { FINANCIAL_READ: { limit: 100 } },
  createRateLimitHeaders: m.createRateLimitHeaders,
}));
vi.mock('@/lib/dues-calculation-engine', () => ({ DuesCalculationEngine: m.DuesCalculationEngine }));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));

async function loadRoute() {
  return import('../dues/calculate/route');
}

const MEMBER = '11111111-1111-1111-1111-111111111111';
const valid = { memberId: MEMBER, periodStart: '2026-01-01', periodEnd: '2026-01-31' };
const post = (body: unknown) => new NextRequest('http://localhost/api/dues/calculate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const ctx = { userId: 'u1', organizationId: 'org_1' };

describe('dues/calculate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.memberships.length = 0;
    m.hasRole.mockResolvedValue(true);
    m.requireEntitlement.mockResolvedValue(undefined);
    m.checkRateLimit.mockResolvedValue({ allowed: true });
    m.createRateLimitHeaders.mockReturnValue({});
    m.DuesCalculationEngine.calculateMemberDues.mockResolvedValue({ amount: 500, period: '2026-01' });
  });

  it('asks the wrapper for the financial intelligence entitlement and the organization\'s own tenant transaction, and leaves the role to the handler', async () => {
    const { POST } = await loadRoute();
    const options = declaredOptions(POST);
    expect(options).toMatchObject({ entitlement: 'financial_intelligence_suite', rlsOrgContext: true });
    expect(options.auth?.minRole).toBeUndefined();
  });

  it('returns 400 for invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post('{bad-json'), ctx);

    expect(response.status).toBe(400);
  });

  it('returns 400 for missing required fields', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ memberId: 'x' }), ctx);

    expect(response.status).toBe(400);
  });

  it('returns 400 for a period that is not a real date or ends before it starts, never handing it to the engine', async () => {
    const { POST } = await loadRoute();
    for (const period of [
      { periodStart: '2026-13-45', periodEnd: '2026-01-31' },
      { periodStart: '2026-02-30', periodEnd: '2026-03-31' },
      { periodStart: '2026-02-01', periodEnd: '2026-01-31' },
    ]) {
      const response = await POST(post({ ...valid, ...period }), ctx);
      expect(response.status, JSON.stringify(period)).toBe(400);
    }
    expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
  });

  it('returns 401 when context is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post(valid), { userId: null, organizationId: null });

    expect(response.status).toBe(401);
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });

    const response = await POST(post(valid), ctx);

    expect(response.status).toBe(429);
  });

  it('calculates dues for the caller organization, on the caller organization\'s transaction, from the member and period alone', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ ...valid, memberData: { grossWages: 1 } }), ctx);

    expect(response.status).toBe(200);
    expect(m.DuesCalculationEngine.calculateMemberDues).toHaveBeenCalledWith(
      { organizationId: 'org_1', memberId: MEMBER, periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31') },
      m.db,
    );
    expect(m.logApiAuditEvent).toHaveBeenCalled();
  });

  it('is refused without the entitlement, and calculates nothing', async () => {
    const { POST } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('no module'));
    const response = await POST(post(valid), ctx);

    expect(response.status).toBe(403);
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'financial_intelligence_suite', 'u1');
    expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
  });

  it('refuses a body that names another organization, as it was sent', async () => {
    const { POST } = await loadRoute();
    for (const key of ['organizationId', 'orgId', 'organization_id', 'org_id', 'unionId', 'union_id', 'localId', 'local_id']) {
      const response = await POST(post({ ...valid, [key]: 'org_other' }), ctx);
      expect(response.status, key).toBe(403);
    }
    expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
  });

  it('accepts a body that names the caller organization', async () => {
    const { POST } = await loadRoute();
    const response = await POST(post({ ...valid, organizationId: 'org_1' }), ctx);

    expect(response.status).toBe(200);
  });

  it('reports a calculation that failed as a 500, and one that has no result as not found', async () => {
    const { POST } = await loadRoute();
    m.DuesCalculationEngine.calculateMemberDues.mockRejectedValueOnce(new Error('engine down'));
    expect((await POST(post(valid), ctx)).status).toBe(500);

    m.DuesCalculationEngine.calculateMemberDues.mockResolvedValueOnce(null);
    expect((await POST(post(valid), ctx)).status).toBe(404);
  });

  describe('financial data of a member', () => {
    const OTHER = '22222222-2222-2222-2222-222222222222';
    const call = async (memberId: string, userId = 'u1') => {
      const { POST } = await loadRoute();
      return POST(post({ memberId, periodStart: '2026-01-01', periodEnd: '2026-01-31' }), { userId, organizationId: 'org_1' });
    };

    it("refuses someone else's dues to a caller without the financial authority, whatever their rank", async () => {
      m.hasRole.mockResolvedValue(false);
      const response = await call(OTHER);
      expect(response.status).toBe(403);
      expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
    });

    it('lets the financial authority calculate any member, without looking the membership up', async () => {
      const response = await call(OTHER);
      expect(response.status).toBe(200);
      expect(m.hasRole).toHaveBeenCalledWith('secretary_treasurer');
      expect(m.db.select).not.toHaveBeenCalled();
    });

    it("lets a member calculate their own dues without the financial authority: the member id is a membership of the caller's user", async () => {
      m.hasRole.mockResolvedValue(false);
      m.memberships.push([{ userId: 'u1' }]);
      const response = await call(OTHER, 'u1');
      expect(response.status).toBe(200);
      expect(m.db.select).toHaveBeenCalledTimes(1);
    });

    it("refuses a member the dues of another member's membership, and of a membership that is not in the organization", async () => {
      m.hasRole.mockResolvedValue(false);
      m.memberships.push([{ userId: 'someone-else' }]);
      expect((await call(OTHER, 'u1')).status).toBe(403);

      m.memberships.push([]);
      expect((await call(OTHER, 'u1')).status).toBe(403);
      expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
    });

    it("does not take a member id equal to the caller's user id for the caller's own record: a member id is not a user id", async () => {
      m.hasRole.mockResolvedValue(false);
      m.memberships.push([{ userId: 'someone-else' }]);
      const response = await call(OTHER, OTHER);
      expect(response.status).toBe(403);
    });
  });
});
