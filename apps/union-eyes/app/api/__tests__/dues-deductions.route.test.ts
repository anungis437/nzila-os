import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = 'Finance and dues persistence are not available in this release.';
const refused = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL };

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

  it('refuses an authenticated member with 501 NOT_IMPLEMENTED and reads no payroll deductions', async () => {
    stubSelect();
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1', userId: 'user_real' })).rejects.toMatchObject(refused);
    expect(m.select).not.toHaveBeenCalled();
  });

  it('refuses with 501 whatever the read would have returned, so no deduction rows can leak', async () => {
    stubSelect([{ id: 'd1' }, { id: 'd2' }]);
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1', userId: 'user_other' }).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    expect(result).not.toHaveProperty('value');
    expect((result as { error: unknown }).error).toMatchObject(refused);
    expect(m.select).not.toHaveBeenCalled();
  });

  it('returns empty data when organization/user context is missing', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: null, userId: null });
    expect(result).toEqual({ data: [] });
    expect(m.select).not.toHaveBeenCalled();
  });
});
