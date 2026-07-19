import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/api/standardized-responses', () => ({
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../admin/ai-usage/route');
}

describe('admin/ai-usage route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any = {}) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute
      .mockResolvedValueOnce([{ id: 'a1', model: 'gpt-4o-mini' }])
      .mockResolvedValueOnce([{ total: 1 }]);
  });

  it('returns paginated AI audit rows', async () => {
    const { GET } = await loadRoute();
    const response = await GET({ request: new Request('http://localhost/api/admin/ai-usage?page=2&limit=25') });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.page).toBe(2);
    expect(json.limit).toBe(25);
    expect(json.total).toBe(1);
    expect(Array.isArray(json.entries)).toBe(true);
  });
});