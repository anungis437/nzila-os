import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = 'Finance and dues persistence are not available in this release.';
const refused = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL };

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
const audit = vi.hoisted(() => ({
  op: vi.fn(async (_op: unknown, fn: () => Promise<unknown>) => fn()),
  tx: vi.fn(),
}));
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: audit.op, operationAuditResponse: () => null }));
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
    audit.op.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn());
  });

  const nothingRan = () => {
    expect(m.db.select).not.toHaveBeenCalled();
    expect(m.getNotificationService).not.toHaveBeenCalled();
    expect(m.notifySend).not.toHaveBeenCalled();
    expect(audit.op).not.toHaveBeenCalled();
    expect(m.logger.info).not.toHaveBeenCalled();
  };

  it('throws 400 before the boundary when organization or user context is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ params: { id: 'member_1' }, organizationId: '', userId: 'u1' })).rejects.toMatchObject({ status: 400 });
    expect(m.db.select).not.toHaveBeenCalled();
  });

  it('refuses with 501 NOT_IMPLEMENTED, not 404, when the arrears record does not exist: nothing is looked up', async () => {
    m.db.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) });
    const { POST } = await loadRoute();
    await expect(POST({ params: { id: 'member_1' }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject(refused);
    nothingRan();
  });

  it('refuses with 501 NOT_IMPLEMENTED, not 400, when the member has no email: nothing is looked up', async () => {
    const from = vi.fn()
      .mockReturnValueOnce({ where: vi.fn().mockResolvedValue([{ id: 'ar_1', totalOwed: '150.50' }]) })
      .mockReturnValueOnce({ where: vi.fn().mockResolvedValue([{ name: 'No Email', email: '' }]) });
    m.db.select.mockReturnValue({ from });
    const { POST } = await loadRoute();
    await expect(POST({ params: { id: 'member_1' }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject(refused);
    nothingRan();
  });

  it('refuses with 501 NOT_IMPLEMENTED for a member who could be reminded: no reminder is sent, audited or logged as sent', async () => {
    const from = vi.fn()
      .mockReturnValueOnce({ where: vi.fn().mockResolvedValue([{ id: 'ar_1', totalOwed: '200.00' }]) })
      .mockReturnValueOnce({ where: vi.fn().mockResolvedValue([{ name: 'Alex', email: 'alex@example.com' }]) });
    m.db.select.mockReturnValue({ from });

    const { POST } = await loadRoute();
    await expect(POST({ params: { id: 'member_1' }, organizationId: 'org_1', userId: 'treasurer' })).rejects.toMatchObject(refused);
    nothingRan();
  });
});
