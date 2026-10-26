import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  db: { insert: vi.fn(), select: vi.fn(), update: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  requireLiveFinancialMandate: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  z,
  ApiError: {
    badRequest: (msg: string) => new Error(msg),
    notFound: (msg: string) => new Error(msg),
  },
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn(), desc: vi.fn() }));
vi.mock('@/db/schema/dues-finance-schema', () => ({ employerRemittances: { id: 'id', organizationId: 'o', createdAt: 'c' } }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => (args[args.length - 1] as (tx: unknown) => Promise<unknown>)(m.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn(() => Promise.resolve()) }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({
  requireLiveFinancialMandate: m.requireLiveFinancialMandate,
}));

const EMPLOYER_ID = '11111111-1111-4111-8111-111111111111';

const jsonRequest = (body: unknown) =>
  new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(body) });

describe('employer remittance records cannot be reconciled or file-bound by the caller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.insertValues.mockImplementation((values: Record<string, unknown>) => ({
      returning: async () => [{ id: 'rem_1', ...values }],
    }));
    m.db.insert.mockReturnValue({ values: m.insertValues });
    m.updateSet.mockReturnValue({ where: () => ({ returning: async () => [{ id: 'rem_1' }] }) });
    m.db.update.mockReturnValue({ set: m.updateSet });
    m.db.select.mockReturnValue({ from: () => ({ where: async () => [{ id: 'rem_1' }] }) });
    m.requireLiveFinancialMandate.mockResolvedValue(undefined);
  });

  it('PATCH rejects reconciliation, completion and result-counter fields', async () => {
    const { PATCH } = await import('../dues/remittances/[id]/route');
    const call = (body: unknown) =>
      (PATCH as any)({ organizationId: 'org_1', userId: 'u1', params: Promise.resolve({ id: 'rem_1' }), request: jsonRequest(body) });

    await expect(call({ isReconciled: true })).rejects.toThrow();
    await expect(call({ reconciledAt: '2026-01-01', reconciledBy: 'u1' })).rejects.toThrow();
    await expect(call({ processingStatus: 'completed' })).rejects.toThrow();
    await expect(call({ variance: '0', expectedAmount: '0' })).rejects.toThrow();
    await expect(call({ recordsMatched: 10 })).rejects.toThrow();
    expect(m.db.update).not.toHaveBeenCalled();
  });

  it('PATCH still allows notes and a review/failed flag', async () => {
    const { PATCH } = await import('../dues/remittances/[id]/route');
    await (PATCH as any)({
      organizationId: 'org_1',
      userId: 'u1',
      params: Promise.resolve({ id: 'rem_1' }),
      request: jsonRequest({ notes: 'check totals', processingStatus: 'requires_review' }),
    });
    expect(m.updateSet).toHaveBeenCalledWith(expect.objectContaining({ notes: 'check totals', processingStatus: 'requires_review' }));
  });

  it('POST ignores caller-supplied file bindings and always records pending / unreconciled', async () => {
    const { POST } = await import('../dues/remittances/route');
    await (POST as any)({
      organizationId: 'org_1',
      userId: 'u1',
      request: jsonRequest({
        employerId: EMPLOYER_ID,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        fiscalYear: 2026,
        fiscalMonth: 1,
        remittanceDate: '2026-02-01',
        totalAmount: '100.00',
        memberCount: 3,
        fileUrl: 'https://attacker.example/evidence.csv',
        fileName: 'fake.csv',
        isReconciled: true,
        processingStatus: 'completed',
      }),
    });
    const values = m.insertValues.mock.calls[0][0];
    expect(values.fileUrl).toBeUndefined();
    expect(values.fileName).toBeUndefined();
    expect(values.processingStatus).toBe('pending');
    expect(values.isReconciled).toBe(false);
    expect(values.organizationId).toBe('org_1');
    expect(m.requireLiveFinancialMandate).toHaveBeenCalled();
  });

  it('POST writes nothing when no financial mandate has been issued', async () => {
    m.requireLiveFinancialMandate.mockRejectedValue(Object.assign(new Error('No financial mandate has been issued in this organization.'), { status: 403 }));
    const { POST } = await import('../dues/remittances/route');
    await expect((POST as any)({
      organizationId: 'org_1',
      userId: 'u1',
      request: jsonRequest({
        employerId: EMPLOYER_ID,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        fiscalYear: 2026,
        fiscalMonth: 1,
        remittanceDate: '2026-02-01',
        totalAmount: '100.00',
        memberCount: 3,
      }),
    })).rejects.toThrow(/financial mandate/);
    expect(m.db.insert).not.toHaveBeenCalled();
  });
});
