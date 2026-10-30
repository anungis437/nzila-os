import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withOrgOwnedContext: vi.fn(),
  currentStateContextEnabled: vi.fn(),
  db: { execute: vi.fn() },
  sqlCalls: [] as Array<{ text: string; values: unknown[] }>,
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { forbidden: (message: string) => new Error(message) },
}));
vi.mock('@/lib/db/org-owned-context', () => ({ withOrgOwnedContext: m.withOrgOwnedContext }));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: m.currentStateContextEnabled }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/api/standardized-responses', () => ({
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    m.sqlCalls.push({ text: strings.join('?'), values });
    return 'sql';
  };
  return { ...actual, sql: Object.assign(sql, { mapWith: vi.fn() }) };
});

describe('admin/ai-usage tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.sqlCalls.length = 0;
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
      (ctx: any = {}) => handler(ctx));
    m.withOrgOwnedContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.db.execute
      .mockResolvedValueOnce([{ id: 'a1', model: 'gpt-4o-mini' }])
      .mockResolvedValueOnce([{ total: 1 }]);
  });

  for (const canonical of [false, true]) {
    it(`scopes both audit rows and count to the active organization (canonical=${canonical})`, async () => {
      m.currentStateContextEnabled.mockReturnValue(canonical);
      const { GET } = await import('../admin/ai-usage/route');
      const organizationId = '11111111-1111-4111-8111-111111111111';
      const response = await GET({
        request: new Request('http://localhost/api/admin/ai-usage?page=2&limit=25'),
        organizationId,
      } as never);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.page).toBe(2);
      expect(json.limit).toBe(25);
      expect(json.total).toBe(1);
      expect(m.sqlCalls).toHaveLength(2);
      for (const call of m.sqlCalls) {
        expect(call.text).toContain('WHERE organization_id =');
        expect(call.values).toContain(organizationId);
        expect(call.text).toContain(canonical ? "details->>'eventType'" : "metadata->>'eventType'");
      }
    });
  }

  it('fails closed when the caller has no verified organization', async () => {
    const { GET } = await import('../admin/ai-usage/route');
    await expect(GET({
      request: new Request('http://localhost/api/admin/ai-usage'),
    } as never)).rejects.toThrow('Organization context required');
    expect(m.db.execute).not.toHaveBeenCalled();
  });
});
