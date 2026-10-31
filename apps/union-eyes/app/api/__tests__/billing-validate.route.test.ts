import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  convertUSDToCAD: vi.fn(),
  validateBillingRequest: vi.fn(),
  checkT106Requirement: vi.fn(),
  audit: vi.fn(),
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/services/transfer-pricing-service', () => ({
  convertUSDToCAD: m.convertUSDToCAD,
  validateBillingRequest: m.validateBillingRequest,
  checkT106Requirement: m.checkT106Requirement,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { FORBIDDEN: 'FORBIDDEN' },
  standardErrorResponse: (_code: string, message: string) =>
    new Response(JSON.stringify({ message }), { status: 403 }),
}));

async function loadRoute() { return import('../billing/validate/route'); }
const request = (body: unknown) => new Request('http://localhost/api/billing/validate', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('DEF-0B3 durable billing validation audit and truthful outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (req: Request, ctx = { userId: 'u1', organizationId: 'org_1' }) => handler(req, ctx));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.validateBillingRequest.mockResolvedValue({ valid: true });
    m.checkT106Requirement.mockResolvedValue({ requiresT106: false, reason: 'Not required' });
    m.convertUSDToCAD.mockResolvedValue(120);
    m.withRLSContext.mockImplementation(async (_ctx: unknown, callback: (tx: unknown) => Promise<unknown>) => callback({}));
    m.audit.mockResolvedValue(undefined);
  });

  it('validates CAD but does not falsely claim an invoice was approved', async () => {
    const { POST } = await loadRoute();
    const response = await POST(request({ amount: 100, currency: 'CAD' }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.valid).toBe(true);
    expect(body.message).toMatch(/no invoice has been approved or posted/);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      organizationId: 'org_1', action: 'billing.validation.accepted',
    }), 'success');
  });

  it('classifies an ordinary invalid currency as validation failure, not unauthorized access', async () => {
    const { POST } = await loadRoute();
    m.validateBillingRequest.mockResolvedValueOnce({ valid: false, error: 'Currency must be CAD' });
    const response = await POST(request({ amount: 100, currency: 'EUR' }));
    expect(response.status).toBe(400);
    expect(m.convertUSDToCAD).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'billing.validation.rejected',
      details: expect.objectContaining({ reason: 'invalid_billing_terms' }),
    }), 'failure');
  });

  it('converts only USD and never calls the result an approved invoice', async () => {
    const { POST } = await loadRoute();
    m.validateBillingRequest.mockResolvedValueOnce({ valid: false, error: 'Currency must be CAD' });
    const response = await POST(request({ amount: 100, currency: 'USD' }));
    expect(response.status).toBe(200);
    expect((await response.json()).valid).toBe(false);
    expect(m.convertUSDToCAD).toHaveBeenCalledTimes(1);
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'billing.validation.rejected',
    }), 'failure');
  });

  it('records malformed input as validation failure with no billing-service call', async () => {
    const { POST } = await loadRoute();
    const response = await POST(request('not-json'));
    expect(response.status).toBe(400);
    expect(m.validateBillingRequest).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'billing.validation.rejected',
      details: { reason: 'invalid_json' },
    }), 'failure');
  });

  it('refuses client-supplied organization identity rather than silently dropping it', async () => {
    const { POST } = await loadRoute();
    const response = await POST(request({ amount: 100, currency: 'CAD', organizationId: 'org_other' }));
    expect(response.status).toBe(400);
    expect(m.validateBillingRequest).not.toHaveBeenCalled();
  });

  it('fails closed when the audit store cannot commit, even for otherwise valid billing', async () => {
    const { POST } = await loadRoute();
    m.audit.mockRejectedValueOnce(new Error('database unavailable'));
    const response = await POST(request({ amount: 100, currency: 'CAD' }));
    expect(response.status).toBe(503);
    expect((await response.json()).valid).toBe(false);
  });

  it('does not relabel provider outages as unauthorized access', async () => {
    const { POST } = await loadRoute();
    m.validateBillingRequest.mockRejectedValueOnce(new Error('provider down'));
    const response = await POST(request({ amount: 100, currency: 'CAD' }));
    expect(response.status).toBe(503);
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'billing.validation.unavailable',
    }), 'failure');
  });
});
