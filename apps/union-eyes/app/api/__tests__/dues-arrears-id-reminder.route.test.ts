import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  badRequest: vi.fn(),
  notFound: vi.fn(),
  db: { select: vi.fn() },
  memberArrears: { userId: 'userId', organizationId: 'organizationId', totalOwed: 'totalOwed' },
  organizationMembers: { userId: 'userId', organizationId: 'organizationId', name: 'name', email: 'email' },
  eq: vi.fn(),
  and: vi.fn(),
  getNotificationService: vi.fn(),
  notifySend: vi.fn(),
  logger: { info: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: m.badRequest, notFound: m.notFound },
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema/dues-finance-schema', () => ({ memberArrears: m.memberArrears }));
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: m.organizationMembers }));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and }));
vi.mock('@/lib/services/notification-service', () => ({ getNotificationService: m.getNotificationService }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../dues/arrears/[id]/reminder/route');
}

describe('dues/arrears/[id]/reminder route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => handler(ctx));
    m.badRequest.mockImplementation((message: string) => Object.assign(new Error(message), { status: 400 }));
    m.notFound.mockImplementation((message: string) => Object.assign(new Error(message), { status: 404 }));
    m.eq.mockImplementation((a: unknown, b: unknown) => ({ a, b }));
    m.and.mockImplementation((...clauses: unknown[]) => clauses);
    m.notifySend.mockResolvedValue(undefined);
    m.getNotificationService.mockReturnValue({ send: m.notifySend });
  });

  it('throws 404 when arrears record does not exist', async () => {
    const where1 = vi.fn().mockResolvedValue([]);
    const from1 = vi.fn().mockReturnValue({ where: where1 });
    m.db.select.mockReturnValueOnce({ from: from1 });

    const { POST } = await loadRoute();

    await expect(
      POST({ params: { id: 'member_1' }, organizationId: 'org_1', userId: 'u1' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 when member email is missing', async () => {
    const where1 = vi.fn().mockResolvedValue([{ id: 'ar_1', totalOwed: '150.50' }]);
    const where2 = vi.fn().mockResolvedValue([{ name: 'No Email', email: '' }]);
    const from = vi.fn()
      .mockReturnValueOnce({ where: where1 })
      .mockReturnValueOnce({ where: where2 });
    m.db.select.mockReturnValue({ from });

    const { POST } = await loadRoute();

    await expect(
      POST({ params: { id: 'member_1' }, organizationId: 'org_1', userId: 'u1' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('sends reminder and returns sent=true', async () => {
    const where1 = vi.fn().mockResolvedValue([{ id: 'ar_1', totalOwed: '200.00' }]);
    const where2 = vi.fn().mockResolvedValue([{ name: 'Alex', email: 'alex@example.com' }]);
    const from = vi.fn()
      .mockReturnValueOnce({ where: where1 })
      .mockReturnValueOnce({ where: where2 });
    m.db.select.mockReturnValue({ from });

    const { POST } = await loadRoute();
    const result = await POST({ params: { id: 'member_1' }, organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ sent: true });
    expect(m.notifySend).toHaveBeenCalledTimes(1);
    expect(m.logger.info).toHaveBeenCalledWith('Arrears reminder sent', { memberId: 'member_1', amountOwed: '200.00' });
  });
});