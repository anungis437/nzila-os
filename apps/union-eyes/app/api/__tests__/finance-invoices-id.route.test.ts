import { beforeEach, describe, expect, it, vi } from 'vitest';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  getInvoiceWithLineItems: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/services/platform-economics', () => ({ getInvoiceWithLineItems: m.getInvoiceWithLineItems }));

async function loadRoute() {
  return import('../finance/invoices/[id]/route');
}

const INVOICE = '550e8400-e29b-41d4-a716-446655440040';
const request = () => new Request(`http://localhost/api/finance/invoices/${INVOICE}`);
const as = (id: string) => ({ organizationId: 'org_1', userId: 'u1', params: { id } });

describe('finance/invoices/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getInvoiceWithLineItems.mockResolvedValue({ id: INVOICE, lineItems: [] });
  });

  it('asks the wrapper for a secretary-treasurer, the entitlement and the organization\'s own tenant transaction', async () => {
    const { GET } = await loadRoute();
    expect(declaredOptions(GET)).toMatchObject({
      auth: { minRole: 'secretary_treasurer' },
      entitlement: 'financial_intelligence_suite',
      rlsOrgContext: true,
      registry: { audience: 'officer', evidenceRequired: true },
    });
  });

  it('returns validation error when invoice id is missing or is not a uuid', async () => {
    const { GET } = await loadRoute();
    expect((await GET(request(), as(''))).status).toBe(400);
    expect((await GET(request(), as('inv_1'))).status).toBe(400);
    expect(m.getInvoiceWithLineItems).not.toHaveBeenCalled();
  });

  it('returns the caller organization\'s invoice when it exists', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request(), as(INVOICE));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(m.getInvoiceWithLineItems).toHaveBeenCalledWith(INVOICE, 'org_1');
    expect(json.data).toEqual({ id: INVOICE, lineItems: [] });
  });

  it('returns 404 for an invoice the organization does not have', async () => {
    const { GET } = await loadRoute();
    m.getInvoiceWithLineItems.mockResolvedValueOnce(null);
    expect((await GET(request(), as(INVOICE))).status).toBe(404);
  });

  it('is refused without the entitlement, and reads nothing', async () => {
    const { GET } = await loadRoute();
    m.requireEntitlement.mockRejectedValueOnce(new Error('no module'));
    const response = await GET(request(), as(INVOICE));

    expect(response.status).toBe(403);
    expect(m.requireEntitlement).toHaveBeenCalledWith('org_1', 'financial_intelligence_suite', 'u1');
    expect(m.getInvoiceWithLineItems).not.toHaveBeenCalled();
  });

  it('reports a read that failed as a 500, never as a missing invoice', async () => {
    const { GET } = await loadRoute();
    m.getInvoiceWithLineItems.mockRejectedValueOnce(new Error('db down'));
    expect((await GET(request(), as(INVOICE))).status).toBe(500);
  });
});
