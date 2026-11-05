import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  audit: vi.fn(),
  requireLiveFinancialMandate: vi.fn(),
  rows: [] as unknown[],
  tx: { update: vi.fn() },
}));

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    withApi: m.withApi,
    z,
    ApiError: {
      badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
      notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    },
  };
});
vi.mock('@/lib/finance/financial-authority', () => ({ FINANCIAL_MEMBER_DATA_ROLES: ['admin'] }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: m.requireLiveFinancialMandate }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  remittanceLineItems: { remittanceId: 'remittanceId', organizationId: 'organizationId' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn() }));

const ID = '00000000-0000-0000-0000-000000000001';
const MEMBER = '00000000-0000-0000-0000-000000000002';

const call = (fn: any, body: unknown) =>
  fn({ request: { json: async () => body }, organizationId: 'org_1', userId: 'u1' });

describe.each([
  ['match', '../dues/reconciliation/match/route', { remittanceId: ID, memberId: MEMBER }, 'dues.reconciliation.manual_match'],
  ['reject', '../dues/reconciliation/reject/route', { remittanceId: ID, reason: 'duplicate' }, 'dues.reconciliation.reject'],
])('dues/reconciliation/%s', (_name, path, body, action) => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rows = [{ id: 'l1' }];
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.requireLiveFinancialMandate.mockResolvedValue({ mandateId: 'synthetic', ledgerWide: true, resourceIds: [], accountIds: [] });
    m.withRLSContext.mockImplementation(async (a: unknown, b?: unknown) => {
      const fn = (typeof a === 'function' ? a : b) as (tx: unknown) => Promise<unknown>;
      return fn(m.tx);
    });
    m.tx.update.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => m.rows) })) })),
    });
    m.audit.mockResolvedValue(undefined);
  });

  it('writes the change and its audit record on the same transaction', async () => {
    const { POST } = await import(/* @vite-ignore */ path);
    await expect(call(POST, body)).resolves.toMatchObject({ success: true });
    expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ organizationId: 'org_1', userId: 'u1', action }));
  });

  it('is a 404 with no audit when no line item matches', async () => {
    m.rows = [];
    const { POST } = await import(/* @vite-ignore */ path);
    await expect(call(POST, body)).rejects.toMatchObject({ status: 404 });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('fails the operation when the audit write fails', async () => {
    m.audit.mockRejectedValue(new Error('audit down'));
    const { POST } = await import(/* @vite-ignore */ path);
    await expect(call(POST, body)).rejects.toThrow('audit down');
  });
});
