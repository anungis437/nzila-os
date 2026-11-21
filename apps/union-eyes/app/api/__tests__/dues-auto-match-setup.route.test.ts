import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = {
  status: 501,
  code: ErrorCode.NOT_IMPLEMENTED,
  message: 'Finance and dues persistence are not available in this release.',
};

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  audit: vi.fn(),
  op: vi.fn(async (_o: unknown, fn: () => Promise<unknown>) => fn()),
  pending: [] as Array<{ id: string; employeeNumber: string | null }>,
  membersByNumber: {} as Record<string, Array<{ user_id: string }>>,
  updates: [] as Record<string, unknown>[],
  stripeCreate: vi.fn(),
  tx: { select: vi.fn(), execute: vi.fn(), update: vi.fn() },
  mandate: vi.fn(),
}));

vi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: m.mandate }));

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
    m.mandate.mockResolvedValue({});
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

  it.each([
    ['a unique employee number', [{ id: 'l1', employeeNumber: 'E1' }], { E1: [{ user_id: 'member-1' }] }],
    ['an ambiguous employee number', [{ id: 'l1', employeeNumber: 'DUP' }], { DUP: [{ user_id: 'a' }, { user_id: 'b' }] }],
    ['no pending items', [], {}],
  ])('refuses with 501 before the mandate, any read, write or audit (%s)', async (_label, pending, members) => {
    m.pending = pending;
    m.membersByNumber = members;
    await expect(run()).rejects.toMatchObject(REFUSAL);
    expect(m.mandate).not.toHaveBeenCalled();
    expect(m.tx.select).not.toHaveBeenCalled();
    expect(m.tx.execute).not.toHaveBeenCalled();
    expect(m.tx.update).not.toHaveBeenCalled();
    expect(m.updates).toEqual([]);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('is not unlocked by the caller holding a reconcile mandate: the refusal is the same 501', async () => {
    m.pending = [{ id: 'l1', employeeNumber: 'E1' }];
    m.membersByNumber = { E1: [{ user_id: 'member-1' }] };
    m.mandate.mockResolvedValue({ mandateId: 'live', ledgerWide: true });
    await expect(run()).rejects.toMatchObject(REFUSAL);
    expect(m.mandate).not.toHaveBeenCalled();
    expect(m.updates).toEqual([]);
    expect(m.audit).not.toHaveBeenCalled();
  });
});

describe('dues/setup-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.op.mockImplementation(async (_o: unknown, fn: () => Promise<unknown>) => fn());
    m.stripeCreate.mockResolvedValue({ id: 'seti_1', client_secret: 'secret' });
  });

  it.each([
    ['with no body', undefined],
    ['naming a customer', { customerId: 'cus_victim' }],
  ])('refuses %s with 501 and creates no provider intent or audited operation', async (_label, body) => {
    const { POST } = await import('../dues/setup-intent/route');
    await expect((POST as any)({ organizationId: 'org_1', userId: 'treasurer', body })).rejects.toMatchObject(REFUSAL);
    expect(m.stripeCreate).not.toHaveBeenCalled();
    expect(m.op).not.toHaveBeenCalled();
  });

  it('is restricted to the financial authority', async () => {
    vi.resetModules();
    await import('../dues/setup-intent/route');
    const config = m.withApi.mock.calls[0][0] as { auth: { roles?: string[]; minRole?: string } };
    expect(config.auth.roles).toEqual(['secretary_treasurer']);
    expect(config.auth.minRole).toBeUndefined();
  });
});
