import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withAdminAuth: vi.fn(),
  retryJob: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withAdminAuth: m.withAdminAuth }));
vi.mock('@/lib/job-queue', () => ({ retryJob: m.retryJob }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), {
      status: code === 'INTERNAL_ERROR' ? 500 : 400,
    }),
}));

async function loadRoute() {
  return import('../admin/jobs/retry/route');
}

describe('admin/jobs/retry route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withAdminAuth.mockImplementation(
      (handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = {}) => handler(request, context),
    );
    m.retryJob.mockResolvedValue(undefined);
  });

  it('returns validation error when jobId is invalid', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/admin/jobs/retry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queue: 'default', jobId: 'bad-id' }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );

    expect(response.status).toBe(400);
    expect(m.retryJob).not.toHaveBeenCalled();
  });

  it('retries a job when the request is valid', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/admin/jobs/retry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queue: 'critical', jobId: '550e8400-e29b-41d4-a716-446655440000' }),
      }),
      { organizationId: 'org_1', userId: 'u1' },
    );

    expect(response.status).toBe(200);
    expect(m.retryJob).toHaveBeenCalledWith('critical', '550e8400-e29b-41d4-a716-446655440000');
  });
});