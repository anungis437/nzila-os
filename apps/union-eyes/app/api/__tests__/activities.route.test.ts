import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { execute: vi.fn() },
  withSystemContext: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));

async function loadRoute() {
  return import('../activities/route');
}

describe('activities route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: any) => fn());
    m.db.execute.mockResolvedValue([
      { id: 'a1', action: 'create', resource_type: 'grievance', metadata: { description: 'Filed case' }, created_at: new Date() },
    ]);
  });

  it('returns empty list when no org context', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/activities'), organizationId: undefined });
    expect(result).toBeDefined();
  });

  it('returns activities for org', async () => {
    const { GET } = await loadRoute();
    const result = await GET({
      request: new Request('http://localhost/api/activities?page=1&limit=10'),
      organizationId: 'org_1',
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
