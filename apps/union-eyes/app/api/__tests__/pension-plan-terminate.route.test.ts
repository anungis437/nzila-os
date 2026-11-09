import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  updated: [] as unknown[],
  existing: [] as unknown[],
  sets: [] as Array<Record<string, unknown>>,
  deletes: 0,
  audit: vi.fn(),
  // The options each route declared to the wrapper, in load order
  declared: [] as Array<{ auth?: { required?: boolean; roles?: string[] }; openapi?: { summary?: string } }>,
}));
const err = (code: string, message: string) => Object.assign(new Error(message), { code });

vi.mock('@/lib/api/framework', () => ({
  withApi: (cfg: (typeof m.declared)[number], handler: (ctx: unknown) => Promise<unknown>) => {
    m.declared.push(cfg);
    return handler;
  },
  RATE_LIMITS: { FINANCIAL_WRITE: {} },
  ApiError: {
    badRequest: (msg: string) => err('VALIDATION_ERROR', msg),
    notFound: (what: string) => err('NOT_FOUND', what),
    conflict: (msg: string) => err('CONFLICT', msg),
  },
}));
vi.mock('@/lib/pension/pension-authority', () => ({ requirePensionTrusteeMandate: vi.fn(async () => ({ id: 'mandate-1' })), PENSION_ADMIN_ROLES: ['financial_officer'] }));
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

// The route refuses an id that is not a GUID before touching the database
const PLAN = '33333333-3333-4333-8333-333333333333';

const call = async (id = PLAN) => {
  const { DELETE } = await import('../pension/plans/[id]/route');
  return (DELETE as any)({ params: { id }, organizationId: 'org-1', userId: 'u1' });
};

describe('pension plan DELETE', () => {
  beforeEach(() => { vi.clearAllMocks(); m.sets.length = 0; m.deletes = 0; m.updated = [{ id: PLAN, planName: 'Plan' }]; m.existing = []; });

  it('is for the pension administrators only', async () => {
    await import('../pension/plans/[id]/route');
    const terminate = m.declared.find((cfg) => cfg.openapi?.summary === 'Terminate pension plan');
    expect(terminate?.auth).toEqual({ required: true, roles: ['financial_officer'] });
  });

  // DEF-0B10-PEN-PLAN-DELETE-REMOVES-THE-PLAN-ROW-WITH-NO-DEPENDENT-CHECK-OR-SNAPSHOT
  it('terminates the plan instead of deleting the row, and audits it in the same transaction', async () => {
    await call();
    expect(m.sets[0]).toMatchObject({ status: 'terminated' });
    expect(m.deletes).toBe(0);
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'pension.plan.terminate', resourceId: PLAN }));
  });

  it('answers 409 for a plan already terminated and 404 for one that is not the organization\'s', async () => {
    m.updated = [];
    m.existing = [{ id: PLAN }];
    await expect(call()).rejects.toMatchObject({ code: 'CONFLICT' });
    m.existing = [];
    await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('answers a client error for an id that is not a GUID, before reading, writing or auditing anything', async () => {
    for (const id of ['p1', '123', 'not-a-uuid']) {
      await expect(call(id)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: 'id must be a valid identifier' });
    }
    expect(m.sets).toHaveLength(0);
    expect(m.deletes).toBe(0);
    expect(m.audit).not.toHaveBeenCalled();
  });
});
