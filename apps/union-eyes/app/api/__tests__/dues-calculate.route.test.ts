import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL_MESSAGE = 'Finance and dues persistence are not available in this release.';
/** The wrapper turns the boundary's ApiError into a 501 with the NOT_IMPLEMENTED code and the decided message. */
async function expectRefusal(response: Response) {
  expect(response.status).toBe(501);
  expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL_MESSAGE });
}

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

  it('asks the wrapper for the organization\'s own tenant transaction, and leaves the role to the handler', async () => {
    const { POST } = await loadRoute();
    const options = declaredOptions(POST);
    expect(options).toMatchObject({ rlsOrgContext: true });
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

  it('refuses a valid calculation with 501 and never calls the engine or audits a calculation', async () => {
    const { POST } = await loadRoute();
    await expectRefusal(await POST(post({ ...valid, memberData: { grossWages: 1 } }), ctx));

    expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
    expect(m.logApiAuditEvent).not.toHaveBeenCalled();
  });

  it('refuses with 501 whether or not the organization holds the entitlement: no module grants it', async () => {
    const { POST } = await loadRoute();
    for (const entitled of [true, false]) {
      if (entitled) m.requireEntitlement.mockResolvedValue(undefined);
      else m.requireEntitlement.mockRejectedValue(new Error('no module'));
      await expectRefusal(await POST(post(valid), ctx));
    }
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

  it('lets a body that names the caller organization past the organization check, and refuses it with 501', async () => {
    const { POST } = await loadRoute();
    await expectRefusal(await POST(post({ ...valid, organizationId: 'org_1' }), ctx));
    expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
  });

  it.each([
    ['an engine that would fail', () => m.DuesCalculationEngine.calculateMemberDues.mockRejectedValue(new Error('engine down'))],
    ['an engine that would find no result', () => m.DuesCalculationEngine.calculateMemberDues.mockResolvedValue(null)],
  ])('answers 501 for %s: the engine is never reached', async (_label, arrange) => {
    arrange();
    const { POST } = await loadRoute();
    await expectRefusal(await POST(post(valid), ctx));
    expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
    expect(m.logApiAuditEvent).not.toHaveBeenCalled();
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

    it('lets the financial authority past the member check without looking the membership up, and then refuses with 501', async () => {
      await expectRefusal(await call(OTHER));
      expect(m.hasRole).toHaveBeenCalledWith('secretary_treasurer');
      expect(m.db.select).not.toHaveBeenCalled();
      expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
    });

    it("passes the own-record decision for a member without the financial authority, then is refused with 501: the member id is a membership of the caller's user", async () => {
      m.hasRole.mockResolvedValue(false);
      m.memberships.push([{ userId: 'u1' }]);
      await expectRefusal(await call(OTHER, 'u1'));
      expect(m.db.select).toHaveBeenCalledTimes(1);
      expect(m.DuesCalculationEngine.calculateMemberDues).not.toHaveBeenCalled();
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
