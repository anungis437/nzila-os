import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  existing: [] as Array<{ id: string; status: string | null }>,
  updated: [] as Array<Record<string, unknown>>,
  sets: [] as Array<Record<string, unknown>>,
  audit: vi.fn(),
}));

const err = (code: string, message: string) => Object.assign(new Error(message), { code });

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: () => ({ GET: vi.fn() }) }));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    z,
    withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => handler,
    ApiError: {
      badRequest: (msg: string) => err('VALIDATION_ERROR', msg),
      notFound: (what: string) => err('NOT_FOUND', what),
      conflict: (msg: string) => err('CONFLICT', msg),
      notImplemented: (msg: string) => err('NOT_IMPLEMENTED', msg),
    },
  };
});
vi.mock('@/db/schema', () => ({ insightRecommendations: { id: 'id', organizationId: 'organization_id', status: 'status' } }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, op: (tx: unknown) => Promise<unknown>) => op({
    select: () => ({ from: () => ({ where: () => ({ for: () => ({ limit: async () => m.existing }) }) }) }),
    update: () => ({ set: (values: Record<string, unknown>) => { m.sets.push(values); return { where: () => ({ returning: async () => m.updated }) }; } }),
  }),
}));

const ID = '11111111-1111-4111-8111-111111111111';
const patch = async (body: Record<string, unknown>) => {
  const { PATCH } = await import('../analytics/insights/route');
  return (PATCH as any)({ body, organizationId: 'org-1', userId: 'u1' });
};

describe('analytics/insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.sets.length = 0;
    m.existing = [{ id: ID, status: 'new' }];
    m.updated = [{ id: ID, status: 'acknowledged' }];
  });

  // DEF-0B3-ANALYTICS-ROWS-FORGE-AI-PROVENANCE
  it('answers 501 to a create, so no AI reference id or confidence can be typed into a row', async () => {
    const { POST } = await import('../analytics/insights/route');
    await expect((POST as any)({})).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
  });

  it('acknowledges an insight with the caller\'s identity and the server clock, audited in the same transaction', async () => {
    const result = await patch({ insightId: ID, status: 'acknowledged' });
    expect(result).toMatchObject({ success: true });
    expect(m.sets[0]).toMatchObject({ status: 'acknowledged', acknowledgedBy: 'u1', acknowledgedAt: expect.any(Date) });
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'insight.triage', details: { from: 'new', to: 'acknowledged' } }));
  });

  it('needs a reason to dismiss, and records who dismissed it', async () => {
    await expect(patch({ insightId: ID, status: 'dismissed' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await patch({ insightId: ID, status: 'dismissed', dismissalReason: 'duplicate of an open review' });
    expect(m.sets.at(-1)).toMatchObject({ status: 'dismissed', dismissedBy: 'u1', dismissalReason: 'duplicate of an open review' });
  });

  it('refuses to reopen a finished insight and reports a missing one', async () => {
    m.existing = [{ id: ID, status: 'completed' }];
    await expect(patch({ insightId: ID, status: 'acknowledged' })).rejects.toMatchObject({ code: 'CONFLICT' });
    m.existing = [];
    await expect(patch({ insightId: ID, status: 'acknowledged' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('reports a concurrent change as a conflict and audits nothing', async () => {
    m.updated = [];
    await expect(patch({ insightId: ID, status: 'completed' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(m.audit).not.toHaveBeenCalled();
  });
});
