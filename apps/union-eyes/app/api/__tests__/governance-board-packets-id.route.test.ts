import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
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
    const result = await DELETE({ request: { url: 'http://localhost/api/governance/board-packets/bp_1' }, organizationId: 'org_1' });

    expect(result).toEqual({ id: 'bp_1', status: 'archived' });
  });
});