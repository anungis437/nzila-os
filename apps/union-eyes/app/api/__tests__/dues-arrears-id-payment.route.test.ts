import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  badRequest: vi.fn(),
  notFound: vi.fn(),
  withRLSContext: vi.fn(),
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  memberArrears: { id: 'id', userId: 'userId', organizationId: 'organizationId', arrearsStatus: 'arrearsStatus' },
  memberDuesLedger: { table: 'memberDuesLedger' },
  eq: vi.fn(),
  and: vi.fn(),
  logger: { info: vi.fn() },
  z: {
    number: vi.fn(),
    string: vi.fn(),
    object: vi.fn(),
  },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: m.badRequest, notFound: m.notFound },
  z: m.z,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema/dues-finance-schema', () => ({ memberArrears: m.memberArrears, memberDuesLedger: m.memberDuesLedger }));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../dues/arrears/[id]/payment/route');
}

describe('dues/arrears/[id]/payment route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.badRequest.mockImplementation((message: string) => Object.assign(new Error(message), { status: 400 }));
    m.notFound.mockImplementation((message: string) => Object.assign(new Error(message), { status: 404 }));
    m.eq.mockImplementation((a: unknown, b: unknown) => ({ a, b }));
    m.and.mockImplementation((...clauses: unknown[]) => clauses);
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());

    m.z.number.mockReturnValue({ positive: () => ({}) });
    m.z.string.mockReturnValue({ max: () => ({ optional: () => ({}) }) });
    m.z.object.mockReturnValue({
      safeParse: (body: any) => {
        const validAmount = typeof body?.amount === 'number' && body.amount > 0;
        const validNotes = body?.notes === undefined || (typeof body.notes === 'string' && body.notes.length <= 500);
        return validAmount && validNotes
          ? { success: true, data: body }
          : { success: false, error: { issues: [{ message: 'invalid' }] } };
      },
    });
  });

  it('throws 400 for invalid request body', async () => {
    const { POST } = await loadRoute();

    await expect(
      POST({
        request: { json: vi.fn().mockResolvedValue({ amount: 0 }) },
        params: { id: 'member_1' },
        organizationId: 'org_1',
        userId: 'u1',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('throws 404 when arrears record does not exist', async () => {
    const where = vi.fn().mockResolvedValue([]);
    const from = vi.fn().mockReturnValue({ where });
    m.db.select.mockReturnValue({ from });

    const { POST } = await loadRoute();

    await expect(
      POST({
        request: { json: vi.fn().mockResolvedValue({ amount: 50 }) },
        params: { id: 'member_1' },
        organizationId: 'org_1',
        userId: 'u1',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('records payment and updates arrears balance', async () => {
    const where = vi.fn().mockResolvedValue([{ id: 'ar_1', totalOwed: '100', arrearsStatus: 'warning' }]);
    const from = vi.fn().mockReturnValue({ where });
    m.db.select.mockReturnValue({ from });

    const values = vi.fn().mockResolvedValue(undefined);
    m.db.insert.mockReturnValue({ values });

    const returning = vi.fn().mockResolvedValue([{ id: 'ar_1', totalOwed: '0', arrearsStatus: 'current' }]);
    const whereUpdate = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where: whereUpdate });
    m.db.update.mockReturnValue({ set });

    const { POST } = await loadRoute();
    const result = await POST({
      request: { json: vi.fn().mockResolvedValue({ amount: 100, notes: 'Paid in full' }) },
      params: { id: 'member_1' },
      organizationId: 'org_1',
      userId: 'u1',
    });

    expect(result).toEqual({
      success: true,
      newBalance: 0,
      arrears: { id: 'ar_1', totalOwed: '0', arrearsStatus: 'current' },
    });
    expect(values).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ totalOwed: '0', arrearsStatus: 'current' }));
    expect(m.logger.info).toHaveBeenCalledWith('Arrears payment recorded', { memberId: 'member_1', amount: 100, balanceAfter: 0 });
  });
});