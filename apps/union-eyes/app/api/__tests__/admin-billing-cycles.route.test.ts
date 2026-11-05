import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  hasMinRole: vi.fn(),
  requireBillingCycleAuthority: vi.fn(),
  BillingCycleService: { calculatePeriodDates: vi.fn(), generateBillingCycle: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  performAuditedOperation: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser, hasMinRole: m.hasMinRole }));
vi.mock('@/lib/finance/billing-cycle-authority', () => ({ requireBillingCycleAuthority: m.requireBillingCycleAuthority }));
vi.mock('@/lib/services/billing-cycle-service', () => ({ BillingCycleService: m.BillingCycleService }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: m.performAuditedOperation,
  operationAuditResponse: () => null,
}));

vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : 400 })),
  standardSuccessResponse: vi.fn((data: any) => new Response(JSON.stringify(data), { status: 200 })),
}));

async function loadRoute() {
  return import('../admin/billing-cycles/route');
}

describe('admin/billing-cycles route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => (request: NextRequest) => handler(request));
    m.getCurrentUser.mockResolvedValue({ id: 'u1' });
    m.hasMinRole.mockResolvedValue(true);
    m.requireBillingCycleAuthority.mockResolvedValue(undefined);
    m.performAuditedOperation.mockImplementation((_op: unknown, run: () => unknown) => run());
    m.BillingCycleService.calculatePeriodDates.mockReturnValue({ periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31') });
    m.BillingCycleService.generateBillingCycle.mockResolvedValue({ success: true, cycleId: 'bc_1', transactionsCreated: 5, totalAmount: 1000 });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }));
    expect(response.status).toBe(401);
  });

  it('returns 403 when lacking platform_lead role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }));
    expect(response.status).toBe(403);
  });

  it('refuses a target organization without a live financial mandate before touching member billing', async () => {
    const { POST } = await loadRoute();
    m.requireBillingCycleAuthority.mockRejectedValueOnce(new Error('DUTY_NOT_HELD'));
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }));
    expect(response.status).toBe(403);
    expect(m.requireBillingCycleAuthority).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'u1');
    expect(m.BillingCycleService.generateBillingCycle).not.toHaveBeenCalled();
    expect(m.performAuditedOperation).not.toHaveBeenCalled();
  });

  it('generates billing cycle', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }));
    expect(response.status).toBe(200);
    expect(m.BillingCycleService.generateBillingCycle).toHaveBeenCalled();
    expect(m.performAuditedOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: '11111111-1111-4111-8111-111111111111',
        userId: 'u1',
        scope: 'system',
        action: 'platform.billing_cycle.generate',
      }),
      expect.any(Function),
    );
  });

  it('creates nothing when the intent cannot be recorded', async () => {
    const { POST } = await loadRoute();
    m.performAuditedOperation.mockRejectedValueOnce(new Error('audit down'));
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(m.BillingCycleService.generateBillingCycle).not.toHaveBeenCalled();
  });

  it('performs dry-run when specified', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly', dryRun: true }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preview).toBe(true);
    expect(m.performAuditedOperation).not.toHaveBeenCalled();
  });

  it('returns 400 when POST payload is invalid', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: 'not-a-uuid', frequency: 'monthly' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 401 when GET is unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest('http://localhost/api/admin/billing-cycles?organizationId=11111111-1111-4111-8111-111111111111'));

    expect(response.status).toBe(401);
  });

  it('returns 403 when GET lacks platform_lead role', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/admin/billing-cycles?organizationId=11111111-1111-4111-8111-111111111111'));

    expect(response.status).toBe(403);
  });

  it('returns 400 when GET is missing organizationId query parameter', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/billing-cycles'));

    expect(response.status).toBe(400);
  });

  it('returns an honest 501 rather than a fabricated empty billing history', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/billing-cycles?organizationId=11111111-1111-4111-8111-111111111111'));
    const payload = await response.json();

    expect(response.status).toBe(501);
    expect(payload).toMatchObject({
      success: false,
      capabilityState: 'NOT_IMPLEMENTED',
      error: { code: 'NOT_IMPLEMENTED' },
    });
    expect(payload).not.toHaveProperty('cycles');
    expect(m.BillingCycleService.generateBillingCycle).not.toHaveBeenCalled();
  });
  it('does not present a partial dry-run as a successful financial preview', async () => {
    const { POST } = await loadRoute();
    m.BillingCycleService.generateBillingCycle.mockResolvedValueOnce({
      success: false, transactionsCreated: 0, totalAmount: 0,
      members: { processed: 1, success: 0, failed: 1, skipped: 0 },
      errors: [{ memberId: 'member-1', error: 'calculation unavailable' }],
    });
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly', dryRun: true }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(422);
    expect(payload).toMatchObject({ preview: true, success: false });
    expect(payload.errors).toHaveLength(1);
    expect(m.performAuditedOperation).not.toHaveBeenCalled();
  });

  it.each([
    [
        "impossible calendar date",
        {
            "periodStart": "2026-02-30",
            "periodEnd": "2026-03-01"
        }
    ],
    [
        "reversed period",
        {
            "periodStart": "2026-03-02",
            "periodEnd": "2026-03-01"
        }
    ],
    [
        "partial period",
        {
            "periodStart": "2026-03-01"
        }
    ],
    [
        "ambiguous local timestamp",
        {
            "periodStart": "2026-03-01T00:00:00",
            "periodEnd": "2026-03-31T00:00:00"
        }
    ],
    [
        "invalid timezone",
        {
            "periodStart": "2026-03-01T00:00:00+15:00",
            "periodEnd": "2026-03-31"
        }
    ]
])('rejects %s without generating a financial cycle', async (_label, period) => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly', ...period }),
    }));
    expect(response.status).toBe(400);
    expect(m.BillingCycleService.generateBillingCycle).not.toHaveBeenCalled();
    expect(m.performAuditedOperation).not.toHaveBeenCalled();
  });

  it('accepts a real leap day and preserves exact supplied period boundaries', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly', periodStart: '2028-02-29', periodEnd: '2028-03-01', dryRun: true }),
    }));
    expect(response.status).toBe(200);
    expect(m.BillingCycleService.generateBillingCycle).toHaveBeenCalledWith(expect.objectContaining({
      periodStart: new Date('2028-02-29T00:00:00.000Z'),
      periodEnd: new Date('2028-03-01T00:00:00.000Z'),
    }));
  });

  it('returns validation failure for malformed JSON without billing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    }));
    expect(response.status).toBe(400);
    expect(m.BillingCycleService.generateBillingCycle).not.toHaveBeenCalled();
  });

});
