import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withSystemContext: vi.fn(),
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { forbidden: (message: string) => new Error(message) },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/api/standardized-responses', () => ({ standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }) }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: Object.assign(vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join('?'), values })), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../admin/ai-usage/route');
}

describe('admin/ai-usage route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute.mockResolvedValueOnce([{ id: 'ai_1', model: 'gpt-4o-mini' }]).mockResolvedValueOnce([{ total: 1 }]);
  });

  it('returns AI audit entries', async () => {
    const { GET } = await loadRoute();
    const response = await GET({ request: { url: 'http://localhost/api/admin/ai-usage?page=2&limit=25' }, organizationId: 'org-a' });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.total).toBe(1);
    expect(json.page).toBe(2);
    expect(json.limit).toBe(25);
  });
  it('requires authenticated tenant context and scopes both audit queries', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ request: { url: 'http://localhost/api/admin/ai-usage' }, organizationId: null })).rejects.toThrow('Organization context required');
    expect(m.db.execute).not.toHaveBeenCalled();
    const response = await GET({ request: { url: 'http://localhost/api/admin/ai-usage' }, organizationId: 'org-a' });
    expect(response.status).toBe(200);
    expect(m.db.execute).toHaveBeenCalledTimes(2);
    for (const call of m.db.execute.mock.calls) {
      const sqlQuery = call[0] as { text: string; values: unknown[] };
      expect(sqlQuery.text).toContain('organization_id =');
      expect(sqlQuery.values).toContain('org-a');
    }
  });

});