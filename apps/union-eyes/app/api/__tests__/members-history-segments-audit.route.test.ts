import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  returned: [] as unknown[],
  selected: [] as unknown[],
  ops: [] as string[],
  persistAtomicAudit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx),
  ApiError: {
    notFound: (what: string) => Object.assign(new Error(`${what} not found`), { status: 404 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
  },
}));
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({ memberSegments: { id: 'id', organizationId: 'organizationId', name: 'name' } }));
vi.mock('@/db/schema/member-profile-v2-schema', () => ({
  memberHistoryEvents: { id: 'id', userId: 'userId', organizationId: 'organizationId', eventCategory: 'c', eventDate: 'd' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), desc: vi.fn() }));

const chain = (rows: () => unknown[], op: string) => {
  const c: Record<string, unknown> = {};
  for (const name of ['set', 'values', 'from', 'where', 'limit', 'orderBy']) c[name] = () => c;
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
  select: () => chain(() => m.selected, 'select'),
  update: () => chain(() => m.returned, 'update'),
  delete: () => chain(() => m.returned, 'delete'),
};
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

const steward = { organizationId: 'org_1', userId: 'steward_1' };
const req = (body: unknown, url = 'http://localhost/api/members/m1/history') => ({
  url,
  json: async () => body,
});

describe('members/[id]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.ops.length = 0;
    m.returned = [{ id: 'e1', eventType: 'status_change', eventCategory: 'membership', eventDate: '2026-01-01', eventTitle: 'Joined' }];
    m.selected = [{ id: 'e1' }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('GET returns a member\u2019s history only to that member', async () => {
    const { GET } = await import('../members/[id]/history/route');

    await expect(GET({ ...steward, params: { id: 'someone_else' }, request: req(null) })).rejects.toMatchObject({ status: 403 });
    expect(m.ops).toEqual([]);

    const own = await GET({ organizationId: 'org_1', userId: 'm1', params: { id: 'm1' }, request: req(null) });
    expect(own).toEqual(m.selected);
  });

  it('PATCH changes visibility within the organization and audits it on the same transaction', async () => {
    const { PATCH } = await import('../members/[id]/history/route');
    await PATCH({ ...steward, params: { id: 'm1' }, request: req({ eventId: 'e1', visibleToMember: true }) });

    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ organizationId: 'org_1', userId: 'steward_1', action: 'member.history_event.update', resourceId: 'e1' }),
    );
  });

  it('PATCH and DELETE answer 404 with no audit for an event of another member or organization', async () => {
    const { PATCH, DELETE } = await import('../members/[id]/history/route');
    m.returned = [];

    await expect(PATCH({ ...steward, params: { id: 'm1' }, request: req({ eventId: 'e-other', isPublic: true }) })).rejects.toMatchObject({ status: 404 });
    await expect(DELETE({ ...steward, params: { id: 'm1' }, request: req({ eventId: 'e-other' }) })).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('DELETE preserves what was removed in the audit record and fails if the audit fails', async () => {
    const { DELETE } = await import('../members/[id]/history/route');
    await DELETE({ ...steward, params: { id: 'm1' }, request: req({ eventId: 'e1' }) });

    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'member.history_event.delete',
        details: expect.objectContaining({ memberId: 'm1', eventType: 'status_change', eventTitle: 'Joined' }),
      }),
    );

    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(DELETE({ ...steward, params: { id: 'm1' }, request: req({ eventId: 'e1' }) })).rejects.toThrow('audit unavailable');
  });
});

describe('members/segments/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.ops.length = 0;
    m.returned = [{ id: 'seg1', name: 'Stewards' }];
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('PATCH audits the update on the same transaction, and answers 404 without audit for another organization\u2019s segment', async () => {
    const { PATCH } = await import('../members/segments/[id]/route');
    await PATCH({ ...steward, params: { id: 'seg1' }, request: req({ name: 'Renamed' }) });
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'member.segment.update', resourceId: 'seg1', details: { fields: ['name'] } }),
    );

    m.persistAtomicAudit.mockClear();
    m.returned = [];
    await expect(PATCH({ ...steward, params: { id: 'seg-other' }, request: req({ name: 'x' }) })).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('DELETE audits the removal, 404s without audit, and fails when the audit fails', async () => {
    const { DELETE } = await import('../members/segments/[id]/route');
    const response = await DELETE({ ...steward, params: { id: 'seg1' } });
    expect(response.status).toBe(204);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'member.segment.delete', resourceId: 'seg1' }));

    m.persistAtomicAudit.mockClear();
    m.returned = [];
    await expect(DELETE({ ...steward, params: { id: 'seg-other' } })).rejects.toMatchObject({ status: 404 });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();

    m.returned = [{ id: 'seg1', name: 'Stewards' }];
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(DELETE({ ...steward, params: { id: 'seg1' } })).rejects.toThrow('audit unavailable');
  });
});
