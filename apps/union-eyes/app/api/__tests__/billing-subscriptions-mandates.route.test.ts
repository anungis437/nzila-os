import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = { selected: [] as unknown[][], updated: [] as unknown[][] };
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => {
        const query: any = {
          where: vi.fn(() => query),
          for: vi.fn(async () => state.selected.shift() ?? []),
          // A normal GET awaits the query without acquiring a row lock.
          then: (resolve: (rows: unknown[]) => unknown, reject: (error: unknown) => unknown) =>
            Promise.resolve(state.selected.shift() ?? []).then(resolve, reject),
        };
        return query;
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn(async () => state.updated.shift() ?? []) })),
      })),
    })),
  };
  return {
    state, tx,
    withApi: vi.fn(),
    withRLSContext: vi.fn(async (_scope: unknown, callback: (tx: typeof tx) => Promise<unknown>) => callback(tx)),
    requireLiveFinancialMandate: vi.fn(async () => ({ ledgerWide: true, resourceIds: [] })),
    persistAtomicAudit: vi.fn(async () => undefined),
    eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
  };
});
vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => new Error(msg),
    notFound: (msg: string) => new Error(msg),
    conflict: (msg: string) => new Error(msg),
  },
  z: require('zod'),
}));
vi.mock('@/db/schema', () => ({
  orgSubscriptions: { id: 'id', organizationId: 'organizationId', updatedAt: 'updatedAt', status: 'status' },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({
  requireLiveFinancialMandate: m.requireLiveFinancialMandate,
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn() } }));
vi.mock('drizzle-orm', async (original) => {
  const actual = await original<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq, and: vi.fn((...args: unknown[]) => args) };
});

const id = '11111111-1111-1111-1111-111111111111';
const base = { organizationId: 'org-1', userId: 'treasurer', params: { id } };
const request = (metadata: Record<string, unknown>) => ({ json: async () => ({ metadata }) });

describe('subscription detail: mandate-bound reads, metadata and cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.state.selected = [];
    m.state.updated = [];
    m.withApi.mockImplementation((_config: unknown, callback: (ctx: any) => Promise<unknown>) =>
      (ctx: any) => callback(ctx));
    m.withRLSContext.mockImplementation(async (_scope: unknown, callback: (tx: typeof m.tx) => Promise<unknown>) =>
      callback(m.tx));
    m.requireLiveFinancialMandate.mockResolvedValue({ ledgerWide: true, resourceIds: [] });
  });

  it('GET refuses missing or unrelated view mandates before reading a subscription', async () => {
    const { GET } = await import('../billing/subscriptions/[id]/route');
    m.requireLiveFinancialMandate.mockRejectedValueOnce(new Error('DUTY_NOT_HELD'));
    await expect(GET(base)).rejects.toThrow('DUTY_NOT_HELD');
    expect(m.tx.select).not.toHaveBeenCalled();
    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(m.tx, {
      organizationId: 'org-1', userId: 'treasurer', action: 'finance:view', resourceId: id,
    });
  });

  it('GET performs its tenant-bound read only after the live mandate succeeds', async () => {
    const { GET } = await import('../billing/subscriptions/[id]/route');
    m.state.selected.push([{ id, organizationId: 'org-1' }]);
    expect(await GET(base)).toMatchObject({ data: { id } });
    expect(m.withRLSContext).toHaveBeenCalledWith(
      { organizationId: 'org-1', userId: 'treasurer' }, expect.any(Function));
    expect(m.eq).toHaveBeenCalledWith('organizationId', 'org-1');
  });

  it('PATCH cannot read, mutate or audit without a resource-specific prepare mandate', async () => {
    const { PATCH } = await import('../billing/subscriptions/[id]/route');
    m.requireLiveFinancialMandate.mockRejectedValueOnce(new Error('DUTY_NOT_HELD'));
    await expect(PATCH({ ...base, request: request({ label: 'new' }) })).rejects.toThrow('DUTY_NOT_HELD');
    expect(m.tx.select).not.toHaveBeenCalled();
    expect(m.tx.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(m.tx, {
      organizationId: 'org-1', userId: 'treasurer', action: 'finance:prepare', resourceId: id,
    });
  });

  it('PATCH preserves server-owned provenance from the transaction row and audits the mutation', async () => {
    const { PATCH } = await import('../billing/subscriptions/[id]/route');
    m.state.selected.push([{ id, organizationId: 'org-1', updatedAt: new Date('2026-10-01'), metadata: {
      commercialTermsSnapshot: { approved: true }, commercialTermsFingerprint: 'trusted', note: 'old',
    } }]);
    m.state.updated.push([{ id, metadata: { note: 'new', commercialTermsFingerprint: 'trusted' } }]);
    const result = await PATCH({ ...base, request: request({
      note: 'new', commercialTermsSnapshot: { approved: false }, commercialTermsFingerprint: 'forged',
    }) });
    expect(result).toMatchObject({ data: { id } });
    const set = m.tx.update.mock.results.at(-1)?.value.set;
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { note: 'new', commercialTermsSnapshot: { approved: true }, commercialTermsFingerprint: 'trusted' },
    }));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      organizationId: 'org-1', action: 'billing.subscription.metadata_update', resourceId: id,
    }));
    const query = m.tx.select.mock.results.at(-1)?.value.from.mock.results.at(-1)?.value;
    expect(query.for).toHaveBeenCalledWith('update');
  });

  it('DELETE refuses cancellation before lookup when the execute mandate is absent', async () => {
    const { DELETE } = await import('../billing/subscriptions/[id]/route');
    m.requireLiveFinancialMandate.mockRejectedValueOnce(new Error('FINANCIAL_MANDATES_NOT_ISSUED'));
    await expect(DELETE(base)).rejects.toThrow('FINANCIAL_MANDATES_NOT_ISSUED');
    expect(m.tx.select).not.toHaveBeenCalled();
    expect(m.tx.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(m.tx, {
      organizationId: 'org-1', userId: 'treasurer', action: 'finance:execute', resourceId: id,
    });
  });

  it('DELETE cancels and audits inside the same organization transaction', async () => {
    const { DELETE } = await import('../billing/subscriptions/[id]/route');
    m.state.selected.push([{ id, organizationId: 'org-1', status: 'active' }]);
    m.state.updated.push([{ id, status: 'cancelled' }]);
    expect(await DELETE(base)).toMatchObject({ data: { status: 'cancelled' } });
    expect(m.eq).toHaveBeenCalledWith('organizationId', 'org-1');
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      organizationId: 'org-1', action: 'billing.subscription.cancel', resourceId: id,
    }));
  });
});
