import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  updated: [] as unknown[],
  existing: [] as unknown[],
  sets: [] as Array<Record<string, unknown>>,
  deletes: 0,
  audit: vi.fn(),
}));
const err = (code: string, message: string) => Object.assign(new Error(message), { code });

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => handler,
  ApiError: {
    badRequest: (msg: string) => err('VALIDATION_ERROR', msg),
    notFound: (what: string) => err('NOT_FOUND', what),
    conflict: (msg: string) => err('CONFLICT', msg),
  },
}));
vi.mock('@/lib/pension/pension-authority', () => ({ PENSION_ADMIN_ROLES: ['financial_officer'] }));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({ pensionPlans: { id: 'id', organizationId: 'organization_id', status: 'status' } }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_c: unknown, op: (tx: unknown) => Promise<unknown>) => op({
    update: () => ({ set: (values: Record<string, unknown>) => { m.sets.push(values); return { where: () => ({ returning: async () => m.updated }) }; } }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => m.existing }) }) }),
    delete: () => { m.deletes += 1; return { where: () => ({ returning: async () => [] }) }; },
  }),
}));

const call = async () => {
  const { DELETE } = await import('../pension/plans/[id]/route');
  return (DELETE as any)({ params: { id: 'p1' }, organizationId: 'org-1', userId: 'u1' });
};

describe('pension plan DELETE', () => {
  beforeEach(() => { vi.clearAllMocks(); m.sets.length = 0; m.deletes = 0; m.updated = [{ id: 'p1', planName: 'Plan' }]; m.existing = []; });

  // DEF-0B10-PEN-PLAN-DELETE-REMOVES-THE-PLAN-ROW-WITH-NO-DEPENDENT-CHECK-OR-SNAPSHOT
  it('terminates the plan instead of deleting the row, and audits it in the same transaction', async () => {
    await call();
    expect(m.sets[0]).toMatchObject({ status: 'terminated' });
    expect(m.deletes).toBe(0);
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'pension.plan.terminate', resourceId: 'p1' }));
  });

  it('answers 409 for a plan already terminated and 404 for one that is not the organization\'s', async () => {
    m.updated = [];
    m.existing = [{ id: 'p1' }];
    await expect(call()).rejects.toMatchObject({ code: 'CONFLICT' });
    m.existing = [];
    await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.audit).not.toHaveBeenCalled();
  });
});
