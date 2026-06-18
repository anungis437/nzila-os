import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  hasMinRole: vi.fn(),
  manualTriggerRetry: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser, hasMinRole: m.hasMinRole }));
vi.mock('@/lib/jobs/failed-payment-retry', () => ({ manualTriggerRetry: m.manualTriggerRetry }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', FORBIDDEN: 'FORBIDDEN', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'FORBIDDEN' ? 403 : 500 })),
  standardSuccessResponse: vi.fn((data: any) => new Response(JSON.stringify(data), { status: 200 })),
}));

async function loadRoute() {
  return import('../admin/payments/retry-failed/route');
}

describe('admin/payments/retry-failed route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => (request: NextRequest) => handler(request));
    m.getCurrentUser.mockResolvedValue({ id: 'u1' });
    m.hasMinRole.mockResolvedValue(true);
    m.manualTriggerRetry.mockResolvedValue({ totalProcessed: 10, retriesAttempted: 8, retriesSucceeded: 5, retriesFailed: 3, markedForAdmin: 2 });
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/admin/payments/retry-failed', { method: 'POST' }));

    expect(response.status).toBe(401);
  });

  it('returns 403 when caller lacks platform lead role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/admin/payments/retry-failed', { method: 'POST' }));

    expect(response.status).toBe(403);
  });

  it('returns retry summary on success', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/admin/payments/retry-failed', { method: 'POST' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ totalProcessed: 10, retriesAttempted: 8, retriesSucceeded: 5 });
  });

  it('returns 500 when retry job throws', async () => {
    const { POST } = await loadRoute();
    m.manualTriggerRetry.mockRejectedValueOnce(new Error('job failed'));

    const response = await POST(new NextRequest('http://localhost/api/admin/payments/retry-failed', { method: 'POST' }));

    expect(response.status).toBe(500);
  });
});