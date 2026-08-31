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
  payrollDeductions: { organizationId: 'organizationId', userId: 'userId' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...conds: unknown[]) => ({ and: conds }),
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ parts, values }),
}));

async function loadRoute() {
  return import('../dues/deductions/route');
}

describe('/api/dues/deductions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
  });

  it('scopes the query by the authenticated context userId, not a client-supplied query param (IDOR fix)', async () => {
    let capturedWhere: any;
    m.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn((cond: unknown) => {
          capturedWhere = cond;
          return Promise.resolve([{ id: 'd1' }]);
        }),
      })),
    }));

    const { GET } = await loadRoute();
    // Context userId is 'user_real'; a route callable from a request whose
    // query string tried to impersonate 'user_other' must be ignored,
    // because the handler no longer reads request.nextUrl at all.
    const result = await GET({ organizationId: 'org_1', userId: 'user_real' });

    expect(result).toEqual({ data: [{ id: 'd1' }] });
    // Both filter clauses reference the context-derived values.
    const values = capturedWhere.and.flatMap((c: any) => c.values);
    expect(values).toContain('org_1');
    expect(values).toContain('user_real');
    expect(values).not.toContain('user_other');
  });

  it('returns empty data when organization/user context is missing', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: null, userId: null });
    expect(result).toEqual({ data: [] });
    expect(m.select).not.toHaveBeenCalled();
  });
});
