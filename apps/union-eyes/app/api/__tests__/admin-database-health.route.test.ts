import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../admin/database/health/route');
}

describe('admin/database/health route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: () => Promise<unknown>) =>
      () => handler());
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute
      .mockResolvedValueOnce([{ db_size: '1048576' }])
      .mockResolvedValueOnce([{ active_connections: '7' }])
      .mockResolvedValueOnce([{ table_count: '12' }]);
  });

  it('returns database health metrics', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result).toMatchObject({
      success: true,
      dbSizeBytes: 1048576,
      activeConnections: 7,
      tableCount: 12,
      status: 'healthy',
    });
  });
});