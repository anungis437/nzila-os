import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({
  requireBillingCycleAuthority: vi.fn(),
  BillingCycleService: { calculatePeriodDates: vi.fn(), generateBillingCycle: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/finance/billing-cycle-authority', () => ({ requireBillingCycleAuthority: m.requireBillingCycleAuthority }));
vi.mock('@/lib/services/billing-cycle-service', () => ({ BillingCycleService: m.BillingCycleService }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'INTERNAL_ERROR' ? 500 : 400 })),
  standardSuccessResponse: vi.fn((data: any) => new Response(JSON.stringify(data), { status: 200 })),
}));

async function loadRoute() {
  return import('../admin/billing-cycles/preview/route');
}

describe('admin/billing-cycles/preview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireBillingCycleAuthority.mockResolvedValue(undefined);
    m.BillingCycleService.calculatePeriodDates.mockReturnValue({ periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31') });
    m.BillingCycleService.generateBillingCycle.mockResolvedValue({ success: true, cycleId: 'bc_1', transactionsCreated: 5, totalAmount: 1000 });
  });

  it('asks the wrapper for a platform lead who need not belong to an organization, and for no tenant transaction (the target organization is opened by the service)', async () => {
    const { POST } = await loadRoute();
    const options = declaredOptions(POST);
    expect(options.auth).toEqual({ minRole: 'platform_lead' });
    expect(options.requireOrg).toBe(false);
    expect(options.rlsOrgContext).toBeUndefined();
  });

  it('returns 401 when the wrapper hands over no user', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }), { userId: null, organizationId: null });

    expect(response.status).toBe(401);
    expect(m.BillingCycleService.generateBillingCycle).not.toHaveBeenCalled();
  });

  it('refuses a target organization without a live financial mandate before touching member billing', async () => {
    const { POST } = await loadRoute();
    m.requireBillingCycleAuthority.mockRejectedValueOnce(new Error('DUTY_NOT_HELD'));
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }));
    expect(response.status).toBe(403);
    expect(m.requireBillingCycleAuthority).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'u1');
    expect(m.BillingCycleService.generateBillingCycle).not.toHaveBeenCalled();
    
  });

  it('returns preview result using calculated dates and dry run', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preview).toBe(true);
    expect(m.BillingCycleService.generateBillingCycle).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true, executedBy: 'u1' }));
  });

  it('returns 500 when preview generation fails', async () => {
    const { POST } = await loadRoute();
    m.BillingCycleService.generateBillingCycle.mockRejectedValueOnce(new Error('fail'));

    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }));

    expect(response.status).toBe(500);
  });
  it('returns 422 and explicit failure when a preview cannot calculate every member', async () => {
    const { POST } = await loadRoute();
    m.BillingCycleService.generateBillingCycle.mockResolvedValueOnce({
      success: false, transactionsCreated: 0, totalAmount: 0,
      members: { processed: 1, success: 0, failed: 1, skipped: 0 },
      errors: [{ memberId: 'member-1', error: 'missing wage data' }],
    });
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly' }),
    }));
    const payload = await response.json();
    expect(response.status).toBe(422);
    expect(payload).toMatchObject({ preview: true, success: false });
    expect(payload.errors).toHaveLength(1);
    expect(m.BillingCycleService.generateBillingCycle).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
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
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly', ...period }),
    }));
    expect(response.status).toBe(400);
    expect(m.BillingCycleService.generateBillingCycle).not.toHaveBeenCalled();
    
  });

  it('accepts a real leap day and preserves exact supplied period boundaries', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-4111-8111-111111111111', frequency: 'monthly', periodStart: '2028-02-29', periodEnd: '2028-03-01',  }),
    }));
    expect(response.status).toBe(200);
    expect(m.BillingCycleService.generateBillingCycle).toHaveBeenCalledWith(expect.objectContaining({
      periodStart: new Date('2028-02-29T00:00:00.000Z'),
      periodEnd: new Date('2028-03-01T00:00:00.000Z'),
    }));
  });

  it('returns validation failure for malformed JSON without billing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/preview', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    }));
    expect(response.status).toBe(400);
    expect(m.BillingCycleService.generateBillingCycle).not.toHaveBeenCalled();
  });

});