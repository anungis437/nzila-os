import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withMinRole: vi.fn(),
  requireEntitlement: vi.fn(),
  getInvoiceWithLineItems: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withMinRole: m.withMinRole }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({ getInvoiceWithLineItems: m.getInvoiceWithLineItems }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), { status: code === 'INTERNAL_ERROR' ? 500 : code === 'AUTH_REQUIRED' ? 401 : code === 'NOT_FOUND' ? 404 : 400 }),
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

async function loadRoute() {
  return import('../finance/invoices/[id]/route');
}

describe('finance/invoices/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withMinRole.mockImplementation((_role: string, handler: (request: Request, context: any) => Promise<Response>) =>
      (request: Request, context: any = {}) => handler(request, context));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getInvoiceWithLineItems.mockResolvedValue({ id: 'inv_1', lineItems: [] });
  });

  it('returns validation error when invoice id is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/finance/invoices/inv_1'), {
      organizationId: 'org_1',
      userId: 'u1',
      params: Promise.resolve({ id: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns invoice detail when the invoice exists', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/finance/invoices/inv_1'), {
      organizationId: 'org_1',
      userId: 'u1',
      params: Promise.resolve({ id: 'inv_1' }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'financial_intelligence_suite', 'u1');
    expect(m.getInvoiceWithLineItems).toHaveBeenCalledWith('inv_1');
    expect(json).toEqual({ id: 'inv_1', lineItems: [] });
  });
});