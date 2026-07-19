import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  generateInvoice: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: (message: string) => new Error(message) },
  RATE_LIMITS: { FINANCIAL_WRITE: { requests: 20, window: 60 } },
  z: require('zod'),
}));
vi.mock('@/services/platform-economics', () => ({ generateInvoice: m.generateInvoice }));

async function loadRoute() {
  return import('../billing/send-invoice/route');
}

describe('billing/send-invoice route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.generateInvoice.mockResolvedValue({ id: 'inv_1', total: '100.00' });
  });

  it('throws when organization context is missing', async () => {
    const { POST } = await loadRoute();

    await expect(POST({ body: { billingPeriodId: '11111111-1111-1111-1111-111111111111' }, userId: 'u1' })).rejects.toThrow('Organization context required');
  });

  it('generates invoice for organization and billing period', async () => {
    const { POST } = await loadRoute();

    const result = await POST({
      organizationId: 'org_1',
      userId: 'u1',
      body: { billingPeriodId: '11111111-1111-1111-1111-111111111111' },
    });

    expect(result).toMatchObject({ id: 'inv_1', total: '100.00' });
    expect(m.generateInvoice).toHaveBeenCalledWith({
      organizationId: 'org_1',
      billingPeriodId: '11111111-1111-1111-1111-111111111111',
      createdBy: 'u1',
    });
  });
});