import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  executeQueue: [] as unknown[][],
}));

const mockDb = {
  execute: vi.fn(async () => (m.executeQueue.shift() ?? []) as unknown[]),
};

vi.mock('@/lib/api/framework', () => {
  const zEnum = { optional: () => zEnum } as any;
  return {
    withApi: m.withApi,
    z: { object: () => ({}), enum: () => zEnum },
    ApiError: {
      notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
      badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    },
  };
});
vi.mock('@/db/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));

async function loadRoute() {
  return import('../content/templates/[id]/status/route');
}

describe('content/templates/[id]/status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.executeQueue = [];
    m.withRLSContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (_request: NextRequest, ctx: any = { organizationId: 'org_1', userId: 'u1', params: { id: 'tpl_1' }, body: { status: 'review' } }) => {
          try {
            const data = await handler(ctx);
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err) {
            return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
          }
        },
    );
  });

  it('PATCH returns 404 when content item is missing', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([]);

    const response = await PATCH(new NextRequest('http://localhost/api/content/templates/tpl_1/status', { method: 'PATCH' }), {
      organizationId: 'org_1', userId: 'u1', params: { id: 'tpl_1' }, body: { status: 'review' },
    });

    expect(response.status).toBe(404);
  });

  it('PATCH returns no-change when status is unchanged', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([{ id: 'tpl_1', status: 'draft', title: 'Template A' }]);

    const response = await PATCH(new NextRequest('http://localhost/api/content/templates/tpl_1/status', { method: 'PATCH' }), {
      organizationId: 'org_1', userId: 'u1', params: { id: 'tpl_1' }, body: { status: 'draft' },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toContain('No change needed');
  });

  it('PATCH rejects invalid transition', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([{ id: 'tpl_1', status: 'draft', title: 'Template A' }]);

    const response = await PATCH(new NextRequest('http://localhost/api/content/templates/tpl_1/status', { method: 'PATCH' }), {
      organizationId: 'org_1', userId: 'u1', params: { id: 'tpl_1' }, body: { status: 'published' },
    });

    expect(response.status).toBe(400);
  });

  it('PATCH transitions draft to review', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([{ id: 'tpl_1', status: 'draft', title: 'Template A' }], []);

    const response = await PATCH(new NextRequest('http://localhost/api/content/templates/tpl_1/status', { method: 'PATCH' }), {
      organizationId: 'org_1', userId: 'u1', params: { id: 'tpl_1' }, body: { status: 'review' },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.previousStatus).toBe('draft');
    expect(json.status).toBe('review');
  });

  it('PATCH transitions review to published', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([{ id: 'tpl_1', status: 'review', title: 'Template A' }], []);

    const response = await PATCH(new NextRequest('http://localhost/api/content/templates/tpl_1/status', { method: 'PATCH' }), {
      organizationId: 'org_1', userId: 'u1', params: { id: 'tpl_1' }, body: { status: 'published' },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.status).toBe('published');
  });
});
