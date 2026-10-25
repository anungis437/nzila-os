import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  returned: [] as unknown[],
  recipient: [] as unknown[],
  persistAtomicAudit: vi.fn(),
  ops: [] as string[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx),
  ApiError: {
    notFound: (what: string) => Object.assign(new Error(`${what} not found`), { status: 404 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
}));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({
  inAppNotifications: { id: 'id', userId: 'userId', organizationId: 'organizationId', read: 'read' },
  organizationMembers: { userId: 'userId', organizationId: 'organizationId', deletedAt: 'deletedAt' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  and: vi.fn(() => 'and'),
  desc: vi.fn(),
  count: vi.fn(),
  isNull: vi.fn(),
  or: vi.fn(),
  gte: vi.fn(),
}));

const chain = (rows: () => unknown[], op: string) => {
  const c: Record<string, unknown> = {};
  for (const name of ['set', 'values', 'from', 'where', 'limit']) c[name] = () => c;
  c.returning = async () => {
    m.ops.push(op);
    return rows();
  };
  c.then = (resolve: (v: unknown) => unknown) => {
    m.ops.push(op);
    return Promise.resolve(rows()).then(resolve);
  };
  return c;
};
const tx = {
  select: () => chain(() => m.recipient, 'select'),
  insert: () => chain(() => m.returned, 'insert'),
  update: () => chain(() => m.returned, 'update'),
  delete: () => chain(() => m.returned, 'delete'),
};
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

const caller = { organizationId: 'org_1', userId: 'u1' };

describe('notifications routes — every write is audited on the same transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.ops.length = 0;
    m.returned = [{ id: 'n1' }];
    m.recipient = [{ userId: 'u2' }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  describe('POST /api/notifications', () => {
    const body = { userId: 'u2', title: 't', message: 'hello' };

    it('creates a notification for a member of the organization and audits it', async () => {
      const { POST } = await import('../notifications/route');
      const result = await POST({ ...caller, body });

      expect(result).toEqual({ id: 'n1' });
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'notification.create', resourceId: 'n1', details: expect.objectContaining({ recipientUserId: 'u2' }) }),
      );
    });

    it('refuses a recipient who is not a member of the organization: nothing is written, nothing audited', async () => {
      const { POST } = await import('../notifications/route');
      m.recipient = [];

      await expect(POST({ ...caller, body })).rejects.toMatchObject({ status: 404 });
      expect(m.ops).not.toContain('insert');
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('fails the creation when its audit cannot be written', async () => {
      const { POST } = await import('../notifications/route');
      m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

      await expect(POST({ ...caller, body })).rejects.toThrow('audit unavailable');
    });
  });

  describe('PATCH/DELETE /api/notifications/[id] (the caller\u2019s own notification)', () => {
    it('marks the caller\u2019s notification read and audits it', async () => {
      const { PATCH } = await import('../notifications/[id]/route');
      await PATCH({ ...caller, params: { id: 'n1' }, body: { read: true } });

      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ userId: 'u1', action: 'notification.update', resourceId: 'n1' }),
      );
    });

    it('answers 404 with no audit when the notification is another member\u2019s or another organization\u2019s', async () => {
      const { PATCH, DELETE } = await import('../notifications/[id]/route');
      m.returned = [];

      await expect(PATCH({ ...caller, params: { id: 'n-other' }, body: { read: true } })).rejects.toMatchObject({ status: 404 });
      await expect(DELETE({ ...caller, params: { id: 'n-other' } })).rejects.toMatchObject({ status: 404 });
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('deletes the caller\u2019s notification, audits it, and fails if the audit fails', async () => {
      const { DELETE } = await import('../notifications/[id]/route');
      await DELETE({ ...caller, params: { id: 'n1' } });
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'notification.delete', resourceId: 'n1' }));

      m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
      await expect(DELETE({ ...caller, params: { id: 'n1' } })).rejects.toThrow('audit unavailable');
    });
  });

  describe('POST /api/notifications/mark-all-read', () => {
    it('audits a mark-all-read that changed rows, with the count only', async () => {
      const { POST } = await import('../notifications/mark-all-read/route');
      m.returned = [{ id: 'a' }, { id: 'b' }];

      const result = await POST(caller);

      expect(result).toEqual({ success: true, updated: 2 });
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ action: 'notification.mark_all_read', details: { count: 2 } }),
      );
    });

    it('writes no audit when there was nothing unread', async () => {
      const { POST } = await import('../notifications/mark-all-read/route');
      m.returned = [];

      await POST(caller);

      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/notifications/test', () => {
    it('creates the caller\u2019s own test notification and audits it', async () => {
      const { POST } = await import('../notifications/test/route');
      await POST(caller);

      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action: 'notification.test_create', resourceId: 'n1' }),
      );
    });
  });

  describe('/api/notifications/device', () => {
    it('is retired: it neither registers a token nor reports that it did', async () => {
      vi.doMock('@/lib/api-auth-guard', () => ({ withApiAuth: (handler: unknown) => handler }));
      const route = await import('../notifications/device/route');

      for (const handler of [route.POST, route.DELETE]) {
        const response = await (handler as () => Promise<Response>)();
        expect(response.status).toBe(501);
        const json = await response.json();
        expect(json.error.code).toBe('NOT_IMPLEMENTED');
        expect(JSON.stringify(json)).not.toContain('success');
      }
    });
  });
});
