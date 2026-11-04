import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B9-ML-OPERATIONAL-METRICS-COUNT-EVERY-ORGANIZATIONS-CLAIMS-FOR-ANY-SIGNED-IN-CALLER-OR-THE-SERVICE-KEY

const m = vi.hoisted(() => ({
  requireApiAuth: vi.fn(),
  isPlatformAdminUser: vi.fn(),
  queueStats: vi.fn(),
  rows: [] as Array<Array<Record<string, number>>>,
  selects: 0,
  systemContexts: 0,
}));

vi.mock('@/lib/api-auth-guard', () => ({ requireApiAuth: m.requireApiAuth, isPlatformAdminUser: m.isPlatformAdminUser }));
vi.mock('@/lib/job-queue', () => ({ getAllQueueStats: m.queueStats }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/db/schema', () => ({ claims: { status: 's', updatedAt: 'u' }, claimUpdates: { updateType: 't', createdAt: 'c', message: 'm' } }));
// The counters span every organization: they are read through the system context's transaction, never the ambient handle.
vi.mock('@/db/db', () => ({
  db: new Proxy({}, { get: () => { throw new Error('the ambient db handle must not be used'); } }),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (work: (tx: unknown) => Promise<unknown>) => {
    m.systemContexts += 1;
    return work({
      select: () => ({
        from: () => ({
          where: async () => {
            m.selects += 1;
            const next = m.rows.shift();
            if (!next) throw new Error('db down');
            return next;
          },
        }),
      }),
    });
  },
}));

const KEY = 'service-key-value-0123456789';
const request = (headers: Record<string, string> = {}) => new Request('http://localhost/api/metrics/operational', { headers });

describe('GET /api/metrics/operational', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selects = 0;
    m.systemContexts = 0;
    // One scan of the last day's claim updates (transitions and failure-like together), then the SLA count of claims.
    m.rows = [[{ transitions: 7, failureLike: 1 }], [{ count: 2 }]];
    m.queueStats.mockResolvedValue([{ active: 1, reserved: 2, scheduled: 3 }]);
    m.isPlatformAdminUser.mockResolvedValue(false);
    process.env.AI_SERVICE_KEY = KEY;
  });

  it('refuses an anonymous caller (401) and an ordinary signed-in user of any organization (403), reading nothing', async () => {
    const { GET } = await import('../metrics/operational/route');
    m.requireApiAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    expect((await GET(request())).status).toBe(401);
    m.requireApiAuth.mockResolvedValueOnce({ userId: 'member-of-org-a' });
    expect((await GET(request())).status).toBe(403);
    expect(m.selects).toBe(0);
    expect(m.systemContexts).toBe(0);
  });

  it('refuses a wrong, truncated, extended or empty service key', async () => {
    const { GET } = await import('../metrics/operational/route');
    for (const key of [`${KEY}x`, KEY.slice(0, -1), 'wrong', '']) {
      m.requireApiAuth.mockRejectedValueOnce(new Error('Unauthorized'));
      expect((await GET(request({ 'x-service-key': key }))).status, key).toBe(401);
    }
    expect(m.selects).toBe(0);
  });

  it('never accepts an empty key when none is configured', async () => {
    delete process.env.AI_SERVICE_KEY;
    const { GET } = await import('../metrics/operational/route');
    m.requireApiAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    expect((await GET(request({ 'x-service-key': '' }))).status).toBe(401);
  });

  it('gives the platform counters to the service key and to a platform administrator', async () => {
    const { GET } = await import('../metrics/operational/route');
    const byKey = await GET(request({ 'x-service-key': KEY }));
    expect(byKey.status).toBe(200);
    expect(await byKey.json()).toMatchObject({ scope: 'platform', workflow_transition_rate: 7, sla_violations: 2, failure_like_updates: 1, queue_depth: 6 });
    // The counters are one system-context transaction, opened only after the operator check: one aggregate over the claim updates and one count of claims.
    expect(m.systemContexts).toBe(1);
    expect(m.selects).toBe(2);

    m.rows = [[{ transitions: 1, failureLike: 1 }], [{ count: 1 }]];
    m.requireApiAuth.mockResolvedValueOnce({ userId: 'platform-1' });
    m.isPlatformAdminUser.mockResolvedValueOnce(true);
    expect((await GET(request())).status).toBe(200);
  });

  it('does not report proxies as request or error rates', async () => {
    const { GET } = await import('../metrics/operational/route');
    const body = await (await GET(request({ 'x-service-key': KEY }))).json();
    expect(body.request_count).toBeNull();
    expect(body.error_rate).toBeNull();
  });

  it('answers a failed read as an error, not zero, and leaks no detail', async () => {
    const { GET } = await import('../metrics/operational/route');
    m.rows = [];
    const response = await GET(request({ 'x-service-key': KEY }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('db down');
  });
});
