import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
  audit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
  },
  z: require('zod'),
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/db/schema/board-packet-schema', () => ({ boardPackets: { id: 'id' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/board-packets/[id]/route');
}

describe('governance/board-packets/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    // Routes now use the tx parameter explicitly (PR #752 round 16) — pass
    // the mocked db object as tx so tx.select/tx.update resolve.
    m.audit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(m.db));
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(async () => [{ id: 'bp_1', status: 'draft' }]) })) } as any);
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'bp_1', status: 'archived' }]) })) })) } as any);
  });

  it('returns a board packet', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: { url: 'http://localhost/api/governance/board-packets/bp_1' }, organizationId: 'org_1' });

    expect(result).toEqual({ id: 'bp_1', status: 'draft' });
  });

  it('archives a board packet on delete', async () => {
    const { DELETE } = await loadRoute();
    const result = await DELETE({ request: { url: 'http://localhost/api/governance/board-packets/bp_1' }, organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ id: 'bp_1', status: 'archived' });
    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'board_packet.archive', resourceId: 'bp_1', userId: 'u1' }));
  });

  it('audits an update on the same transaction', async () => {
    const { PATCH } = await loadRoute();
    await PATCH({ request: { url: 'http://localhost/api/governance/board-packets/bp_1' }, body: { title: 'Q3 packet' }, organizationId: 'org_1', userId: 'u1' });

    expect(m.audit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'board_packet.update', details: expect.objectContaining({ fields: ['title'] }) }));
  });

  it('refuses to set the distributed status directly: distribution records its recipients and has its own route', async () => {
    const { PATCH } = await loadRoute();
    await expect(PATCH({ request: { url: 'http://localhost/api/governance/board-packets/bp_1' }, body: { status: 'distributed' }, organizationId: 'org_1', userId: 'u1' })).rejects.toThrow();
    expect(m.db.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('does not audit an update that matches no packet', async () => {
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })) } as any);
    const { PATCH } = await loadRoute();
    await expect(PATCH({ request: { url: 'http://localhost/api/governance/board-packets/missing' }, body: { title: 'x' }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject({ status: 404 });
    expect(m.audit).not.toHaveBeenCalled();
  });
});