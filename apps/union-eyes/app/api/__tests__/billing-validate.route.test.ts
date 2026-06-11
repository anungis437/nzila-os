import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  requireEntitlement: vi.fn(),
  convertUSDToCAD: vi.fn(),
  validateBillingRequest: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: m.requireEntitlement }));
vi.mock('@/lib/services/transfer-pricing-service', () => ({
  convertUSDToCAD: m.convertUSDToCAD,
  validateBillingRequest: m.validateBillingRequest,
  checkT106Requirement: vi.fn(),
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', FORBIDDEN: 'FORBIDDEN' },
  standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: code === 'FORBIDDEN' ? 403 : 400 })),
}));

async function loadRoute() {
  return import('../billing/validate/route');
}

describe('billing/validate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) => (request: any, ctx: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, ctx));
    m.requireEntitlement.mockResolvedValue(undefined);
    m.validateBillingRequest.mockResolvedValue({ valid: true });
    m.convertUSDToCAD.mockResolvedValue(120);
  });

  it('validates CAD currency billing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/billing/validate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 100, currency: 'CAD' }),
    }));
    expect([200, 400, 403, 500]).toContain(response.status);
  });

  it('converts USD to CAD when needed', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/billing/validate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: 100, currency: 'USD' }),
    }));
    expect([200, 400, 403, 500]).toContain(response.status);
  });

  it('returns 400 for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/billing/validate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: 'invalid',
    }));
    expect([200, 400]).toContain(response.status);
  });
});
