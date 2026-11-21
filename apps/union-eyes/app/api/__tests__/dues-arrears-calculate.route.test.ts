import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

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

const REFUSAL = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' };

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

  it('GET is refused with 501 and reads nothing, even for a valid organization', async () => {
    const { GET } = await loadRoute();

    await expect(GET({ organizationId: 'org_1' })).rejects.toMatchObject(REFUSAL);
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('POST throws 400 when organizationId is missing', async () => {
    const { POST } = await loadRoute();

    await expect(POST({ organizationId: null, userId: 'u1' })).rejects.toMatchObject({ status: 400 });
  });

  it('POST is refused with 501, reads nothing and logs no completion', async () => {
    const { POST } = await loadRoute();

    await expect(POST({ organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject(REFUSAL);
    expect(m.db.select).not.toHaveBeenCalled();
    expect(m.logger.info).not.toHaveBeenCalled();
  });
});
