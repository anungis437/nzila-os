import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  forecastRemittances: vi.fn(),
  logApiAuditEvent: vi.fn(),
  standardErrorResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/services/clc/compliance-reports', () => ({ forecastRemittances: m.forecastRemittances }));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
}));

async function loadRoute() {
  return import('../admin/clc/analytics/forecast/route');
}

describe('admin/clc/analytics/forecast route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation((_role: string, handler: any) =>
      (request: NextRequest, context: any = { userId: 'u1' }) => handler(request, context));
    m.forecastRemittances.mockResolvedValue({ monthsAhead: 12, points: [] });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'VALIDATION_ERROR' ? 400 : 500 }));
  });

  it('returns 400 for invalid months range', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/forecast?months=0'));

    expect(response.status).toBe(400);
  });

  it('returns forecast for valid months', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/forecast?months=6'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ monthsAhead: 12, points: [] });
    expect(m.forecastRemittances).toHaveBeenCalledWith(6);
  });

  it('returns 500 when forecast generation throws', async () => {
    const { GET } = await loadRoute();
    m.forecastRemittances.mockRejectedValueOnce(new Error('service failure'));

    const response = await GET(new NextRequest('http://localhost/api/admin/clc/analytics/forecast?months=6'));

    expect(response.status).toBe(500);
  });
});