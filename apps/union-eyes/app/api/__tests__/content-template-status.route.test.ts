import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  executeQueue: [] as unknown[][],
  audit: vi.fn(),
  hasMinRole: vi.fn(),
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
      forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
      conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
    },
  };
});
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));

async function loadRoute() {
  return import('../content/templates/[id]/status/route');
}

const request = () => new NextRequest('http://localhost/api/content/templates/tpl_1/status', { method: 'PATCH' });
const ctx = (status: string, organizationId: string | null = 'org_1') => ({
  organizationId, userId: 'u1', params: { id: 'tpl_1' }, body: { status },
});

describe('content/templates/[id]/status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.executeQueue = [];
    m.audit.mockResolvedValue(undefined);
    m.hasMinRole.mockResolvedValue(true);
    m.withRLSContext.mockImplementation(async (_scope: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));
    m.withApi.mockImplementation(
      (_cfg: unknown, handler: (ctx: any) => Promise<unknown>) =>
        async (_request: NextRequest, ctx: any) => {
          try {
            const data = await handler(ctx);
            return new Response(JSON.stringify(data), { status: 200 });
          } catch (err) {
            return new Response(JSON.stringify({ error: (err as Error).message }), { status: (err as any).status ?? 500 });
          }
        },
    );
  });

  it('PATCH returns 404 with no audit when the content item is missing or in another organization', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([]);

    const response = await PATCH(request(), ctx('review'));

    expect(response.status).toBe(404);
    expect(m.audit).not.toHaveBeenCalled();
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
  });

  it('PATCH returns no-change when status is unchanged and audits nothing', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([{ id: 'tpl_1', status: 'draft', title: 'Template A' }]);

    const response = await PATCH(request(), ctx('draft'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.message).toContain('No change needed');
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('PATCH rejects invalid transition', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([{ id: 'tpl_1', status: 'draft', title: 'Template A' }]);

    const response = await PATCH(request(), ctx('published'));

    expect(response.status).toBe(400);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('PATCH transitions draft to review and audits on the same transaction', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([{ id: 'tpl_1', status: 'draft', title: 'Template A' }], [{ id: 'tpl_1' }]);

    const response = await PATCH(request(), ctx('review'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.previousStatus).toBe('draft');
    expect(json.status).toBe('review');
    expect(m.hasMinRole).toHaveBeenCalledWith('content_manager');
    expect(m.audit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'u1',
        action: 'content.status.transition',
        resourceId: 'tpl_1',
        details: { fromStatus: 'draft', toStatus: 'review' },
      }),
    );
  });

  it('PATCH transitions review to published when the caller holds the admin role', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([{ id: 'tpl_1', status: 'review', title: 'Template A' }], [{ id: 'tpl_1' }]);

    const response = await PATCH(request(), ctx('published'));

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('published');
    expect(m.hasMinRole).toHaveBeenCalledWith('admin');
  });

  it('PATCH refuses publication by a caller below the role the transition requires', async () => {
    const { PATCH } = await loadRoute();
    m.hasMinRole.mockResolvedValue(false);
    m.executeQueue.push([{ id: 'tpl_1', status: 'review', title: 'Template A' }], [{ id: 'tpl_1' }]);

    const response = await PATCH(request(), ctx('published'));

    expect(response.status).toBe(403);
    expect(m.audit).not.toHaveBeenCalled();
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });

  it('PATCH is a conflict, not a success, when the status changed under it', async () => {
    const { PATCH } = await loadRoute();
    m.executeQueue.push([{ id: 'tpl_1', status: 'draft', title: 'Template A' }], []);

    const response = await PATCH(request(), ctx('review'));

    expect(response.status).toBe(409);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('PATCH fails the transition when its audit record cannot be written', async () => {
    const { PATCH } = await loadRoute();
    m.audit.mockRejectedValueOnce(new Error('audit down'));
    m.executeQueue.push([{ id: 'tpl_1', status: 'draft', title: 'Template A' }], [{ id: 'tpl_1' }]);

    const response = await PATCH(request(), ctx('review'));

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('audit down');
  });
});
