import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  withApi: vi.fn(),
  badRequest: vi.fn(),
  withSystemRLSContext: vi.fn(),
  claims: { table: 'claims' },
  sql: vi.fn(),
}));

vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: m.crudRoutes,
}));
vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { badRequest: m.badRequest } }));
vi.mock('@/db/schema', () => ({ claims: m.claims }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemRLSContext: m.withSystemRLSContext }));
vi.mock('drizzle-orm', () => ({ sql: m.sql }));

async function loadRoute() {
  return import('../claims/route');
}

describe('claims route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.crudRoutes.mockReturnValue({
      GET: vi.fn(async () => ({ data: [] })),
      POST: vi.fn(async () => ({ data: { claimId: 'c1' } })),
    });
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.badRequest.mockImplementation((message: string) => {
      const error = new Error(message);
      (error as Error & { status: number }).status = 400;
      throw error;
    });
    m.sql.mockImplementation((parts: TemplateStringsArray, ...values: unknown[]) => ({ parts, values }));
    m.withSystemRLSContext.mockImplementation(async (_label: string, fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        execute: vi.fn(async () => [{ max_num: null }]),
        insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ claimId: 'claim_1' }]) })) })),
      };
      return fn(tx);
    });
  });

  it('exports GET and POST handlers', async () => {
    const route = await loadRoute();
    expect(typeof route.GET).toBe('function');
    expect(typeof route.POST).toBe('function');
    expect(m.crudRoutes).toHaveBeenCalledWith(expect.objectContaining({ pk: 'claimId', tags: ['Claims'] }));
  });

  it('POST returns 400 for invalid payload', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ body: { description: 'short' }, organizationId: 'org_1', userId: 'u1' })).rejects.toMatchObject({ status: 400 });
  });

  it('POST returns 400 when organization context is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ body: { description: 'A valid description', claimType: 'other' }, userId: 'u1' })).rejects.toMatchObject({ status: 400 });
  });

  it('POST creates a claim and auto-generates claim number', async () => {
    const { POST } = await loadRoute();
    const result = await POST({
      body: {
        description: 'A valid description for a claim',
        claimType: 'other',
        incidentDate: '2026-01-02',
        priority: 'high',
      },
      organizationId: 'org_1',
      userId: 'u1',
    });

    expect(result).toEqual({ data: { claimId: 'claim_1' } });
    expect(m.withSystemRLSContext).toHaveBeenCalledWith('system-query: create-claim', expect.any(Function));
  });
});
