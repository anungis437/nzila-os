import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  badRequest: vi.fn(),
  db: { select: vi.fn() },
  memberArrears: { organizationId: 'organizationId', arrearsStatus: 'arrearsStatus', totalOwed: 'totalOwed', over30Days: 'over30Days', over60Days: 'over60Days', over90Days: 'over90Days' },
  eq: vi.fn(),
  sql: vi.fn(),
  logger: { info: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: m.badRequest },
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema/dues-finance-schema', () => ({ memberArrears: m.memberArrears }));
vi.mock('drizzle-orm', () => ({ eq: m.eq, sql: m.sql }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../dues/arrears/calculate/route');
}

describe('dues/arrears/calculate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.badRequest.mockImplementation((message: string) => Object.assign(new Error(message), { status: 400 }));
    m.eq.mockImplementation((a: unknown, b: unknown) => ({ a, b }));
    m.sql.mockImplementation((parts: TemplateStringsArray, ...values: unknown[]) => ({ parts, values }));
  });

  it('GET throws 400 when organizationId is missing', async () => {
    const { GET } = await loadRoute();

    await expect(GET({ organizationId: null })).rejects.toMatchObject({ status: 400 });
  });

  it('GET returns arrears rows', async () => {
    const rows = [{ id: 'a1', totalOwed: '150.00' }];
    const where = vi.fn().mockResolvedValue(rows);
    const from = vi.fn().mockReturnValue({ where });
    m.db.select.mockReturnValue({ from });

    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });

    expect(result).toEqual({ data: rows });
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('POST throws 400 when organizationId is missing', async () => {
    const { POST } = await loadRoute();

    await expect(POST({ organizationId: null, userId: 'u1' })).rejects.toMatchObject({ status: 400 });
  });

  it('POST returns arrears summary and logs completion', async () => {
    const summary = {
      totalMembers: 10,
      currentCount: 7,
      warningCount: 1,
      suspendedCount: 1,
      badDebtCount: 1,
      totalOwed: '1200.00',
      totalOver30: '800.00',
      totalOver60: '500.00',
      totalOver90: '250.00',
    };
    const where = vi.fn().mockResolvedValue([summary]);
    const from = vi.fn().mockReturnValue({ where });
    m.db.select.mockReturnValue({ from });

    const { POST } = await loadRoute();
    const result = await POST({ organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ data: summary });
    expect(m.logger.info).toHaveBeenCalledWith('Arrears summary calculated', { organizationId: 'org_1' });
  });
});