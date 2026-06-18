import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withAdminAuth: vi.fn(),
  pauseQueue: vi.fn(),
  resumeQueue: vi.fn(),
  cleanCompletedJobs: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withAdminAuth: m.withAdminAuth,
}));

vi.mock('@/lib/job-queue', () => ({
  pauseQueue: m.pauseQueue,
  resumeQueue: m.resumeQueue,
  cleanCompletedJobs: m.cleanCompletedJobs,
}));

vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  standardErrorResponse: (code: string, message: string, details?: unknown) => {
    const status =
      code === 'INTERNAL_ERROR' ? 500 :
      code === 'MISSING_REQUIRED_FIELD' ? 400 :
      400;
    return new Response(JSON.stringify({ code, message, details }), { status });
  },
}));

async function loadRoute() {
  return import('../admin/jobs/[action]/route');
}

describe('admin/jobs/[action] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withAdminAuth.mockImplementation(
      (handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = {}) => handler(request, context),
    );
    m.pauseQueue.mockResolvedValue(undefined);
    m.resumeQueue.mockResolvedValue(undefined);
    m.cleanCompletedJobs.mockResolvedValue(undefined);
  });

  it('returns validation error when queue is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/admin/jobs/pause', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: { action: 'pause' } },
    );
    expect(response.status).toBe(400);
  });

  it('pauses a queue for action pause', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/admin/jobs/pause', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queue: 'critical' }),
      }),
      { params: { action: 'pause' } },
    );
    expect(response.status).toBe(200);
    expect(m.pauseQueue).toHaveBeenCalledWith('critical');
  });

  it('resumes a queue for action resume', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/admin/jobs/resume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queue: 'critical' }),
      }),
      { params: { action: 'resume' } },
    );
    expect(response.status).toBe(200);
    expect(m.resumeQueue).toHaveBeenCalledWith('critical');
  });

  it('cleans completed jobs with default olderThanMs', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/admin/jobs/clean', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queue: 'default' }),
      }),
      { params: { action: 'clean' } },
    );
    expect(response.status).toBe(200);
    expect(m.cleanCompletedJobs).toHaveBeenCalledWith('default', 24 * 60 * 60 * 1000);
  });

  it('returns validation error for unknown action', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/admin/jobs/unknown', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queue: 'default' }),
      }),
      { params: { action: 'unknown' } },
    );
    expect(response.status).toBe(400);
  });

  it('returns internal error when queue operation throws', async () => {
    const { POST } = await loadRoute();
    m.pauseQueue.mockRejectedValueOnce(new Error('queue down'));
    const response = await POST(
      new NextRequest('http://localhost/api/admin/jobs/pause', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ queue: 'critical' }),
      }),
      { params: { action: 'pause' } },
    );
    expect(response.status).toBe(500);
  });
});
