import { beforeEach, describe, expect, it, vi } from 'vitest';

// The route's own contract. The kernel decisions and the atomic ledger are proven against PostgreSQL in
// lib/finance/finance-duties.pglite.test.ts.
const m = vi.hoisted(() => ({ perform: vi.fn(), read: vi.fn(), tx: { marker: 'tx' } }));

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    withApi: (_cfg: unknown, handler: (ctx: unknown) => unknown) => handler,
    ApiError: { badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }) },
    RATE_LIMITS: { FINANCIAL_WRITE: {} },
    z,
  };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_context: unknown, fn: (tx: unknown) => unknown) => fn(m.tx),
}));
vi.mock('@/lib/audit-logger', () => ({ auditLog: vi.fn(), AuditEventType: {}, AuditSeverity: {} }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/authority/store/finance-route-adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/authority/store/finance-route-adapter')>()),
  performFinancialDuty: m.perform,
  readFinancialTransaction: m.read,
}));

import { FinancialDutyError } from '@/lib/authority/store/finance-route-adapter';

const PAYMENT = '00000000-0000-4000-8000-0000000000aa';
const ACCOUNT = '00000000-0000-4000-8000-0000000000bb';
const ctx = (body?: unknown, over: Record<string, unknown> = {}) => ({
  request: { json: vi.fn().mockResolvedValue(body) },
  params: { id: PAYMENT },
  organizationId: 'org_1',
  userId: 'u1',
  ...over,
});
type Reply = { status: number; json: () => Promise<{ error: { code: string } }> } & Record<string, unknown>;
const route = async () => (await import('../payments/[id]/duties/route')) as unknown as Record<'GET' | 'POST', (c: unknown) => Promise<Reply>>;

describe('payments/[id]/duties', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers a payment into the workflow with an account and the required approvals', async () => {
    m.perform.mockResolvedValue({ stepId: 'step_1' });
    const { POST } = await route();
    const result = await POST(ctx({ step: 'registered', accountId: ACCOUNT, requiredApprovals: 2 }));
    expect(result).toEqual({ success: true, data: { transactionId: PAYMENT, step: 'registered', stepId: 'step_1' } });
    expect(m.perform).toHaveBeenCalledWith(
      m.tx,
      { userId: 'u1', organizationId: 'org_1', transactionId: PAYMENT, step: 'registered', accountId: ACCOUNT, requiredApprovals: 2 },
      undefined,
      expect.objectContaining({ action: 'finance.payment.register', resourceType: 'payments', resourceId: PAYMENT }),
    );
  });

  it.each([
    ['prepared', 'finance.payment.prepare'],
    ['approved', 'finance.payment.approve'],
    ['reconciled', 'finance.payment.reconcile'],
  ] as const)('records %s as one kernel-decided step with its own audit action', async (step, action) => {
    m.perform.mockResolvedValue({ stepId: 'step_2' });
    const { POST } = await route();
    await POST(ctx({ step }));
    expect(m.perform).toHaveBeenCalledWith(m.tx, expect.objectContaining({ step, accountId: undefined }), undefined, expect.objectContaining({ action }));
  });

  it('never executes a payment: executing is the money movement and lives only in the route that moves the money', async () => {
    const { POST } = await route();
    const response = await POST(ctx({ step: 'executed' }));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('STEP_NOT_AVAILABLE');
    expect(m.perform).not.toHaveBeenCalled();
  });

  it('rejects malformed requests before any decision', async () => {
    const { POST } = await route();
    for (const body of [
      { step: 'registered' },
      { step: 'registered', accountId: ACCOUNT },
      { step: 'prepared', accountId: ACCOUNT, requiredApprovals: 1 },
      { step: 'voided' },
      { step: 'prepared', extra: true },
      { step: 'registered', accountId: 'nope', requiredApprovals: 1 },
    ]) {
      await expect(POST(ctx(body)), JSON.stringify(body)).rejects.toMatchObject({ status: 400 });
    }
    await expect(POST(ctx({ step: 'prepared' }, { userId: null }))).rejects.toMatchObject({ status: 400 });
    expect(m.perform).not.toHaveBeenCalled();
  });

  it.each([
    ['FINANCE_SOURCE_UNAVAILABLE', 501],
    ['FINANCIAL_MANDATES_NOT_ISSUED', 403],
    ['NOT_FOUND', 404],
    ['DUTY_NOT_HELD', 403],
    ['STEP_REFUSED', 409],
  ] as const)('answers %s as HTTP %i on both verbs', async (code, status) => {
    m.perform.mockRejectedValue(new FinancialDutyError(code, 'refused'));
    m.read.mockRejectedValue(new FinancialDutyError(code, 'refused'));
    const { POST, GET } = await route();
    expect((await POST(ctx({ step: 'prepared' }))).status).toBe(status);
    expect((await GET(ctx())).status).toBe(status);
  });

  it('reads through the kernel view duty', async () => {
    m.read.mockResolvedValue({ transactionId: PAYMENT, state: 'approved' });
    const { GET } = await route();
    expect(await GET(ctx())).toEqual({ data: { transactionId: PAYMENT, state: 'approved' } });
    expect(m.read).toHaveBeenCalledWith(m.tx, { userId: 'u1', organizationId: 'org_1', transactionId: PAYMENT });
  });
});
