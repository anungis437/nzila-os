import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  hasMinRole: vi.fn(),
  BillingScheduler: { manualTrigger: vi.fn() },
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser, hasMinRole: m.hasMinRole }));
vi.mock('@/lib/jobs/billing-scheduler', () => ({ BillingScheduler: m.BillingScheduler }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : code === 'INTERNAL_ERROR' ? 500 : 400 })),
  standardSuccessResponse: vi.fn((data: any) => new Response(JSON.stringify(data), { status: 200 })),
}));

async function loadRoute() {
  return import('../admin/billing-cycles/trigger-scheduled/route');
}

describe('admin/billing-cycles/trigger-scheduled route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => (request: NextRequest) => handler(request));
    m.getCurrentUser.mockResolvedValue({ id: 'u1' });
    m.hasMinRole.mockResolvedValue(true);
    m.BillingScheduler.manualTrigger.mockResolvedValue({ totalOrganizations: 3, successful: 2, failed: 1 });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/trigger-scheduled', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frequency: 'monthly' }),
    }));

    expect(response.status).toBe(401);
  });

  it('returns 403 without platform lead role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/trigger-scheduled', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frequency: 'monthly' }),
    }));

    expect(response.status).toBe(403);
  });

  it('runs manual trigger for valid requests', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/trigger-scheduled', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frequency: 'weekly' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ totalOrganizations: 3, successful: 2, failed: 1 });
    expect(m.BillingScheduler.manualTrigger).toHaveBeenCalledWith('weekly');
  });

  it('returns 500 when manual trigger fails', async () => {
    const { POST } = await loadRoute();
    m.BillingScheduler.manualTrigger.mockRejectedValueOnce(new Error('scheduler failed'));

    const response = await POST(new NextRequest('http://localhost/api/admin/billing-cycles/trigger-scheduled', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ frequency: 'weekly' }),
    }));

    expect(response.status).toBe(500);
  });
});