import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ORG = '11111111-1111-4111-8111-111111111111';
const m = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  requireApiAuth: vi.fn(),
  requireSystemAdmin: vi.fn(),
  getAllQueueStats: vi.fn(),
  getFailedJobs: vi.fn(),
  orgContexts: [] as unknown[],
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: (...a: unknown[]) => unknown) => handler,
  requireApiAuth: m.requireApiAuth,
  requireSystemAdmin: m.requireSystemAdmin,
}));
vi.mock('@/lib/org-id-from-context', () => ({ resolveOrgIdFromContext: async (c: { organizationId?: string }) => c.organizationId ?? null }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    m.orgContexts.push(ctx);
    return fn({ select: () => ({ from: () => ({ where: () => ({ limit: async () => (m.row ? [m.row] : []) }) }) }) });
  },
}));
vi.mock('@/db/schema-organizations', () => ({ organizations: { id: 'id', name: 'name', slug: 'slug', subscriptionTier: 'tier', featuresEnabled: 'features' } }));
vi.mock('@/lib/job-queue', () => ({ getAllQueueStats: m.getAllQueueStats, getFailedJobs: m.getFailedJobs }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', NOT_FOUND: 'NOT_FOUND', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: (code: string, message: string) => new Response(JSON.stringify({ code, message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'NOT_FOUND' ? 404 : 500 }),
}));

describe('GET /api/org/current', () => {
  beforeEach(() => { m.row = { name: 'CAPE Local 7', slug: 'cape-7', subscriptionTier: 'pro', featuresEnabled: ['grievances'] }; m.orgContexts = []; });

  it('returns the organization\'s own name, slug, tier and features, read inside its context', async () => {
    const { GET } = await import('../org/current/route');
    const response = await (GET as any)(new NextRequest('http://localhost/api/org/current'), { userId: 'u1', organizationId: ORG });
    const body = await response.json();
    expect(body.org).toEqual({ organizationId: ORG, name: 'CAPE Local 7', slug: 'cape-7', subscriptionTier: 'pro', features: ['grievances'] });
    expect(m.orgContexts).toEqual([{ organizationId: ORG }]);
  });

  it('answers 404 for an organization with no row instead of a success with empty details', async () => {
    m.row = null;
    const { GET } = await import('../org/current/route');
    expect((await (GET as any)(new NextRequest('http://localhost/api/org/current'), { userId: 'u1', organizationId: ORG })).status).toBe(404);
  });

  it('answers 401 without a user and 404 without an organization', async () => {
    const { GET } = await import('../org/current/route');
    expect((await (GET as any)(new NextRequest('http://localhost/api/org/current'), {})).status).toBe(401);
    expect((await (GET as any)(new NextRequest('http://localhost/api/org/current'), { userId: 'u1' })).status).toBe(404);
  });
});

describe('GET /api/tenant/current', () => {
  it('is gone (410) and names the canonical route, instead of answering 200 with null details', async () => {
    const { GET } = await import('../tenant/current/route');
    const response = GET();
    expect(response.status).toBe(410);
    expect(JSON.stringify(await response.json())).toContain('/api/org/current');
  });
});

describe('GET /api/union-eyes/queue-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_SERVICE_KEY = 'svc-key';
    process.env.DJANGO_API_URL = 'http://django.internal';
    m.requireApiAuth.mockResolvedValue({});
    m.requireSystemAdmin.mockResolvedValue(undefined);
    m.getAllQueueStats.mockResolvedValue([{ name: 'celery', active: 1, reserved: 2, scheduled: 3 }]);
    m.getFailedJobs.mockResolvedValue([{ task_id: 't1', task_name: 'send', status: 'RETRY', date_done: 'x' }]);
  });
  const call = async (headers: Record<string, string> = {}) => {
    const { GET } = await import('../union-eyes/queue-status/route');
    return GET(new Request('http://localhost/api/union-eyes/queue-status', { headers }));
  };

  it('refuses a signed-in member who is not a platform administrator, and reads no queue data', async () => {
    m.requireSystemAdmin.mockRejectedValue(new Error('System administrator privileges required'));
    const response = await call();
    expect(response.status).toBe(403);
    expect(m.getAllQueueStats).not.toHaveBeenCalled();
  });

  it('answers 401, not 503, when there is no session', async () => {
    m.requireApiAuth.mockRejectedValue(new Error('unauthenticated'));
    expect((await call()).status).toBe(401);
  });

  it('serves the control plane (service key) and a platform administrator', async () => {
    m.requireApiAuth.mockRejectedValue(new Error('no session'));
    expect((await call({ 'x-service-key': 'svc-key' })).status).toBe(200);
    m.requireApiAuth.mockResolvedValue({});
    const admin = await call();
    expect(admin.status).toBe(200);
    expect((await admin.json()).queue).toMatchObject({ pending: 5, active: 1, failed: 1, retry_count: 1 });
  });

  it('does not return the cause of a backend failure', async () => {
    m.getAllQueueStats.mockRejectedValue(new Error('connect ECONNREFUSED redis://user:secret@10.0.0.5:6379'));
    const response = await call({ 'x-service-key': 'svc-key' });
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toMatch(/secret|10\.0\.0\.5|ECONNREFUSED/);
  });
});
