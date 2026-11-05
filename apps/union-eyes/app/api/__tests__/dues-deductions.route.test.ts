import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
}));
vi.mock('@/db', () => ({ db: { select: m.select } }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  payrollDeductions: {
    id: 'id', organizationId: 'organizationId', userId: 'userId', payPeriodStart: 'payPeriodStart', payPeriodEnd: 'payPeriodEnd', grossPay: 'grossPay',
    netPay: 'netPay', unionDuesAmount: 'unionDuesAmount', source: 'source', verified: 'verified', verifiedAt: 'verifiedAt', createdAt: 'createdAt',
    verifiedBy: 'verifiedBy', metadata: 'metadata', otherDeductions: 'otherDeductions', remittanceLineItemId: 'remittanceLineItemId', employerId: 'employerId',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: (...conds: unknown[]) => ({ and: conds }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  desc: (column: unknown) => ({ desc: column }),
}));

async function loadRoute() {
  return import('../dues/deductions/route');
}

describe('/api/dues/deductions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
  });

  function stubSelect(rows: unknown[] = [{ id: 'd1' }]) {
    const seen: { fields?: Record<string, unknown>; where?: any; order?: unknown; limit?: number } = {};
    m.select.mockImplementation((fields: Record<string, unknown>) => {
      seen.fields = fields;
      return {
        from: vi.fn(() => ({
          where: vi.fn((cond: unknown) => {
            seen.where = cond;
            return {
              orderBy: vi.fn((order: unknown) => {
                seen.order = order;
                return { limit: vi.fn((n: number) => { seen.limit = n; return Promise.resolve(rows); }) };
              }),
            };
          }),
        })),
      };
    });
    return seen;
  }

  it('scopes the query by the authenticated context userId, not a client-supplied query param (IDOR fix)', async () => {
    const seen = stubSelect();

    const { GET } = await loadRoute();
    // Context userId is 'user_real'; a route callable from a request whose
    // query string tried to impersonate 'user_other' must be ignored,
    // because the handler no longer reads request.nextUrl at all.
    const result = await GET({ organizationId: 'org_1', userId: 'user_real' });

    expect(result).toEqual({ data: [{ id: 'd1' }] });
    // Both filter clauses reference the context-derived values.
    expect(seen.where.and).toEqual([{ eq: ['organizationId', 'org_1'] }, { eq: ['userId', 'user_real'] }]);
  });

  it('returns a member only what is theirs to see: no verifier, remittance line, employer, metadata or other deductions', async () => {
    const seen = stubSelect();
    const { GET } = await loadRoute();
    await GET({ organizationId: 'org_1', userId: 'user_real' });

    expect(Object.keys(seen.fields ?? {}).sort()).toEqual(
      ['createdAt', 'grossPay', 'id', 'netPay', 'payPeriodEnd', 'payPeriodStart', 'source', 'unionDuesAmount', 'verified', 'verifiedAt'].sort(),
    );
  });

  it('lists the newest pay period first, within a bound', async () => {
    const seen = stubSelect();
    const { GET } = await loadRoute();
    await GET({ organizationId: 'org_1', userId: 'user_real' });

    expect(seen.order).toEqual({ desc: 'payPeriodStart' });
    expect(seen.limit).toBe(1000);
  });

  it('returns empty data when organization/user context is missing', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: null, userId: null });
    expect(result).toEqual({ data: [] });
    expect(m.select).not.toHaveBeenCalled();
  });
});
