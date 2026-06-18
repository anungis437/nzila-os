import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
  auditDataMutation: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/audit-logger', () => ({ auditDataMutation: m.auditDataMutation }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/council-elections/route');
}

describe('governance/council-elections route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.auditDataMutation.mockResolvedValue(undefined);
    m.db.execute.mockResolvedValueOnce([{ id: 'e1' }]).mockResolvedValueOnce(undefined as never);
  });

  it('lists council elections', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result).toEqual({ elections: [{ id: 'e1' }] });
  });

  it('creates a council election record', async () => {
    const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('uuid-1');
    const { POST } = await loadRoute();
    const result = await POST({ body: { electionYear: 2026, electionDate: '2026-01-01', positionsAvailable: 3, candidates: [], winners: [], totalVotes: 10 }, userId: 'u1', organizationId: 'org_1' });

    expect(result).toEqual({ id: 'uuid-1' });
    randomUuid.mockRestore();
  });
});