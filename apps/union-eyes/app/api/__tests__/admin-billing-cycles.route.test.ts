import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  hasMinRole: vi.fn(),
  BillingCycleService: { calculatePeriodDates: vi.fn(), generateBillingCycle: vi.fn() },
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser, hasMinRole: m.hasMinRole }));
vi.mock('@/lib/services/billing-cycle-service', () => ({ BillingCycleService: m.BillingCycleService }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
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
    m.BillingCycleService.calculatePeriodDates.mockReturnValue({ periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31') });
    m.BillingCycleService.generateBillingCycle.mockResolvedValue({ cycleId: 'bc_1', transactionsCreated: 5, totalAmount: 1000 });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-1111-1111-111111111111', frequency: 'monthly' }),
    }));
    expect(response.status).toBe(401);
  });

  it('returns 403 when lacking platform_lead role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-1111-1111-111111111111', frequency: 'monthly' }),
    }));
    expect(response.status).toBe(403);
  });

  it('generates billing cycle', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-1111-1111-111111111111', frequency: 'monthly' }),
    }));
    expect(response.status).toBe(200);
    expect(m.BillingCycleService.generateBillingCycle).toHaveBeenCalled();
  });

  it('performs dry-run when specified', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ organizationId: '11111111-1111-1111-1111-111111111111', frequency: 'monthly', dryRun: true }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preview).toBe(true);
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

    const response = await GET(new NextRequest('http://localhost/api/admin/billing-cycles?organizationId=11111111-1111-1111-1111-111111111111'));

    expect(response.status).toBe(401);
  });

  it('returns 403 when GET lacks platform_lead role', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/admin/billing-cycles?organizationId=11111111-1111-1111-1111-111111111111'));

    expect(response.status).toBe(403);
  });

  it('returns 400 when GET is missing organizationId query parameter', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/billing-cycles'));

    expect(response.status).toBe(400);
  });

  it('returns billing history payload from GET', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/billing-cycles?organizationId=11111111-1111-1111-1111-111111111111'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ cycles: [], total: 0 });
  });
});
