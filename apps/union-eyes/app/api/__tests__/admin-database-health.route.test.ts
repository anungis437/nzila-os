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
      // tenantPrincipal (outside withSystemContext): identity, then attrs
      .mockResolvedValueOnce([{ u: 'union_eyes_runtime', app_name: 'union-claims-app' }])
      .mockResolvedValueOnce([{ rolsuper: false, rolbypassrls: false }])
      // systemPrincipal (inside withSystemContext): identity, then attrs
      .mockResolvedValueOnce([{ u: 'union_eyes_system', app_name: 'union-eyes-system' }])
      .mockResolvedValueOnce([{ rolsuper: false, rolbypassrls: false }])
      // health metrics
      .mockResolvedValueOnce([{ db_size: '1048576' }])
      .mockResolvedValueOnce([{ active_connections: '7' }])
      .mockResolvedValueOnce([{ table_count: '12' }]);
  });

  it('returns database health metrics and effective DB principals for both connections', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result).toMatchObject({
      success: true,
      dbSizeBytes: 1048576,
      activeConnections: 7,
      tableCount: 12,
      status: 'healthy',
      tenantPrincipal: {
        currentUser: 'union_eyes_runtime',
        rolsuper: false,
        rolbypassrls: false,
      },
      systemPrincipal: {
        currentUser: 'union_eyes_system',
        rolsuper: false,
        rolbypassrls: false,
      },
    });
  });

  it('flags a bypassrls tenant principal (regression guard for the RLS foundation)', async () => {
    m.db.execute.mockReset();
    m.db.execute
      .mockResolvedValueOnce([{ u: 'nzilaadmin', app_name: null }])
      .mockResolvedValueOnce([{ rolsuper: false, rolbypassrls: true }])
      .mockResolvedValueOnce([{ u: 'union_eyes_system', app_name: null }])
      .mockResolvedValueOnce([{ rolsuper: false, rolbypassrls: false }])
      .mockResolvedValueOnce([{ db_size: '0' }])
      .mockResolvedValueOnce([{ active_connections: '0' }])
      .mockResolvedValueOnce([{ table_count: '0' }]);

    const { GET } = await loadRoute();
    const result = (await GET()) as { tenantPrincipal: { currentUser: string; rolbypassrls: boolean } };

    expect(result.tenantPrincipal.currentUser).toBe('nzilaadmin');
    expect(result.tenantPrincipal.rolbypassrls).toBe(true);
  });
});