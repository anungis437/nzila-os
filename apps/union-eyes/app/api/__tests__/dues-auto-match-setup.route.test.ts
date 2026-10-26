import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  audit: vi.fn(),
  op: vi.fn(async (_o: unknown, fn: () => Promise<unknown>) => fn()),
  pending: [] as Array<{ id: string; employeeNumber: string | null }>,
  membersByNumber: {} as Record<string, Array<{ user_id: string }>>,
  updates: [] as Record<string, unknown>[],
  stripeCreate: vi.fn(),
  tx: { select: vi.fn(), execute: vi.fn(), update: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  z: require('zod').z,
  RATE_LIMITS: { FINANCIAL_WRITE: {} },
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    conflict: (msg: string) => Object.assign(new Error(msg), { status: 409 }),
  },
}));
vi.mock('@/lib/finance/financial-authority', () => ({ FINANCIAL_MEMBER_DATA_ROLES: ['secretary_treasurer'] }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => (args[args.length - 1] as (tx: unknown) => Promise<unknown>)(m.tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: m.op, operationAuditResponse: () => null }));
vi.mock('@/lib/stripe', () => ({ stripe: { setupIntents: { create: m.stripeCreate } } }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/db', () => ({ db: {} }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  remittanceLineItems: { id: 'id', organizationId: 'o', lineStatus: 's', userId: 'u' },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  eq: vi.fn(),
  isNull: vi.fn(),
  sql: Object.assign((strings: TemplateStringsArray, ...vals: unknown[]) => ({ vals }), {}),
}));

describe('dues/reconciliation/auto-match', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.updates = [];
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.audit.mockResolvedValue(undefined);
    m.tx.select.mockReturnValue({ from: () => ({ where: async () => m.pending }) });
    m.tx.execute.mockImplementation(async (q: { vals: unknown[] }) => m.membersByNumber[String(q.vals[1])] ?? []);
    m.tx.update.mockImplementation(() => ({
      set: (v: Record<string, unknown>) => ({ where: async () => { m.updates.push(v); } }),
    }));
  });

  const run = async () => {
    const { POST } = await import('../dues/reconciliation/auto-match/route');
    return (POST as any)({ organizationId: 'org_1', userId: 'treasurer' });
  };

  it('matches a unique employee number, sends the rest to manual review, and audits on the same transaction', async () => {
    m.pending = [{ id: 'l1', employeeNumber: 'E1' }, { id: 'l2', employeeNumber: 'E404' }];
    m.membersByNumber = { E1: [{ user_id: 'member-1' }] };
    await expect(run()).resolves.toEqual({ matched: 1, unmatched: 1 });
    expect(m.updates.map((u) => u.lineStatus)).toEqual(['matched', 'manual_review']);
    expect(m.audit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ action: 'dues.reconciliation.auto_match', userId: 'treasurer', details: { matched: 1, unmatched: 1, ambiguous: 0 } }),
    );
  });

  it('never attributes a payroll line to a member when the number names more than one', async () => {
    m.pending = [{ id: 'l1', employeeNumber: 'DUP' }];
    m.membersByNumber = { DUP: [{ user_id: 'a' }, { user_id: 'b' }] };
    await expect(run()).resolves.toEqual({ matched: 0, unmatched: 1 });
    expect(m.updates.every((u) => u.lineStatus !== 'matched')).toBe(true);
    expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ details: { matched: 0, unmatched: 1, ambiguous: 1 } }));
  });

  it('writes no audit when there is nothing to match', async () => {
    m.pending = [];
    await run();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('fails the whole run when the audit cannot be written', async () => {
    m.pending = [{ id: 'l1', employeeNumber: 'E1' }];
    m.membersByNumber = { E1: [{ user_id: 'member-1' }] };
    m.audit.mockRejectedValue(new Error('audit down'));
    await expect(run()).rejects.toThrow('audit down');
  });
});

describe('dues/setup-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.op.mockImplementation(async (_o: unknown, fn: () => Promise<unknown>) => fn());
    m.stripeCreate.mockResolvedValue({ id: 'seti_1', client_secret: 'secret' });
  });

  it('never attaches the intent to a customer the caller names, and records the operation', async () => {
    const { POST } = await import('../dues/setup-intent/route');
    await (POST as any)({ organizationId: 'org_1', userId: 'treasurer', body: { customerId: 'cus_victim' } });
    expect(m.stripeCreate).toHaveBeenCalledWith({ metadata: { organization_id: 'org_1', source: 'union-eyes-dues' } });
    expect(m.op).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dues.setup_intent.create', organizationId: 'org_1', userId: 'treasurer' }),
      expect.any(Function),
    );
  });

  it('is restricted to the financial authority', async () => {
    vi.resetModules();
    await import('../dues/setup-intent/route');
    const config = m.withApi.mock.calls[0][0] as { auth: { roles?: string[]; minRole?: string } };
    expect(config.auth.roles).toEqual(['secretary_treasurer']);
    expect(config.auth.minRole).toBeUndefined();
  });
});
