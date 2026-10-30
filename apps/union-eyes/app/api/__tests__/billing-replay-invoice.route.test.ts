import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  replayInvoiceDeterministically: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => new Error(msg) }, z: require('zod'), RATE_LIMITS: { FINANCIAL_READ: 'FINANCIAL_READ' } }));
vi.mock('@/services/platform-economics', () => ({ replayInvoiceDeterministically: m.replayInvoiceDeterministically }));
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.auditLog, AuditEventType: { DATA_ACCESS: 'DATA_ACCESS' }, AuditSeverity: { MEDIUM: 'MEDIUM' } }));

async function loadRoute() {
  return import('../billing/replay-invoice/route');
}

describe('billing/replay-invoice route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.replayInvoiceDeterministically.mockResolvedValue({ recomputed: { isMatch: true }, pricingRuleVersion: 'v1' });
    m.auditLog.mockResolvedValue(undefined);
  });

  it('returns not found when replay is unavailable', async () => {
    m.replayInvoiceDeterministically.mockResolvedValueOnce(null);
    const { POST } = await loadRoute();
    const result = await POST({ body: { invoiceId: '550e8400-e29b-41d4-a716-446655440000' }, organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ found: false, invoiceId: '550e8400-e29b-41d4-a716-446655440000' });
  });

  it('refuses missing organization context before invoice lookup', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ body: { invoiceId: '550e8400-e29b-41d4-a716-446655440000' }, userId: 'u1' })).rejects.toThrow('Organization context required');
    expect(m.replayInvoiceDeterministically).not.toHaveBeenCalled();
  });

  it('returns replay data and logs access', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ body: { invoiceId: '550e8400-e29b-41d4-a716-446655440000' }, organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ found: true, replay: { recomputed: { isMatch: true }, pricingRuleVersion: 'v1' } });
    expect(m.auditLog).toHaveBeenCalled();
    expect(m.replayInvoiceDeterministically).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', 'org_1');
  });
});