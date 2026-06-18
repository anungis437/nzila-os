import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { select: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@nzila/db/schema', () => ({ policyGovernanceSnapshots: { generatedAt: 'generatedAt' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, lte: vi.fn(() => 'lte'), desc: vi.fn(() => 'desc'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../governance/lifecycle/snapshots/[at]/route');
}

describe('governance/lifecycle/snapshots/[at] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 's1' }]) })) })) })) } as any);
  });

  it('returns the snapshot at or before the requested time', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ params: { at: '2026-01-02T00:00:00.000Z' } });

    expect(result.snapshot).toEqual({ id: 's1' });
    expect(result.resolvedVia).toBe('exact_or_before');
  });
});