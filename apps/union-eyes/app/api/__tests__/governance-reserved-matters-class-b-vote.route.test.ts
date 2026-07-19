import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/reserved-matters/[id]/class-b-vote/route');
}

describe('governance/reserved-matters/[id]/class-b-vote route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute.mockResolvedValue(undefined);
  });

  it('records an approve vote', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ body: { vote: 'approve' }, params: { id: 'uuid-1' } });

    expect(result).toEqual({ updated: true, status: 'approved' });
  });

  it('records a veto vote', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ body: { vote: 'veto' }, params: { id: 'uuid-1' } });

    expect(result).toEqual({ updated: true, status: 'vetoed' });
  });
});