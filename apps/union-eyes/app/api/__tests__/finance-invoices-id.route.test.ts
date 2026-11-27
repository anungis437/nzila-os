import { beforeEach, describe, expect, it, vi } from 'vitest';
import { declaredOptions } from './with-api-double';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = 'Finance and dues persistence are not available in this release.';

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

  it('asks the wrapper for a secretary-treasurer and declares no entitlement and no ambient tenant transaction', async () => {
    const { GET } = await loadRoute();
    const options = declaredOptions(GET);
    expect(options).toMatchObject({
      auth: { minRole: 'secretary_treasurer' },
      rlsOrgContext: false,
      registry: { audience: 'officer', evidenceRequired: true },
    });
    expect(options.entitlement).toBeUndefined();
  });

  it('returns validation error when invoice id is missing or is not a uuid', async () => {
    const { GET } = await loadRoute();
    expect((await GET(request(), as(''))).status).toBe(400);
    expect((await GET(request(), as('inv_1'))).status).toBe(400);
    expect(m.getInvoiceWithLineItems).not.toHaveBeenCalled();
  });

  it.each([
    ['an invoice that exists', () => m.getInvoiceWithLineItems.mockResolvedValue({ id: INVOICE, lineItems: [] })],
    ['an invoice the organization does not have', () => m.getInvoiceWithLineItems.mockResolvedValue(null)],
    ['a read that fails', () => m.getInvoiceWithLineItems.mockRejectedValue(new Error('db down'))],
  ])('refuses a valid invoice id with 501 NOT_IMPLEMENTED and reads nothing: %s', async (_label, arrange) => {
    arrange();
    const { GET } = await loadRoute();
    const response = await GET(request(), as(INVOICE));

    expect(response.status).toBe(501);
    expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    expect(m.getInvoiceWithLineItems).not.toHaveBeenCalled();
  });

  it('refuses with 501 whether or not the organization holds the module: no entitlement check or read runs', async () => {
    const { GET } = await loadRoute();
    for (const entitled of [true, false]) {
      m.requireEntitlement.mockReset();
      if (entitled) m.requireEntitlement.mockResolvedValue(undefined);
      else m.requireEntitlement.mockRejectedValue(new Error('no module'));
      const response = await GET(request(), as(INVOICE));

      expect(response.status).toBe(501);
      expect(await response.json()).toMatchObject({ code: ErrorCode.NOT_IMPLEMENTED, message: REFUSAL });
    }
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.getInvoiceWithLineItems).not.toHaveBeenCalled();
  });
});
