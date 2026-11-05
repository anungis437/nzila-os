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
// Tripwires: the route must read no tenant table, through the ambient handle or a system context (#1116).
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

  it('gives the platform operator the queue depth only: no tenant table is read, the claim aggregates are null (#1116)', async () => {
    const { GET } = await import('../metrics/operational/route');
    const byKey = await GET(request({ 'x-service-key': KEY }));
    expect(byKey.status).toBe(200);
    expect(await byKey.json()).toMatchObject({
      scope: 'platform', queue_depth: 6, workflow_transition_rate: null, sla_violations: null, failure_like_updates: null,
    });
    // A platform title confers no tenant content: no system transaction is opened and neither claims nor claim updates are read.
    expect(m.systemContexts).toBe(0);
    expect(m.selects).toBe(0);

    m.requireApiAuth.mockResolvedValueOnce({ userId: 'platform-1' });
    m.isPlatformAdminUser.mockResolvedValueOnce(true);
    const byAdmin = await GET(request());
    expect(byAdmin.status).toBe(200);
    expect((await byAdmin.json()).sla_violations).toBeNull();
    expect(m.systemContexts).toBe(0);
  });

  it('does not report proxies as request or error rates', async () => {
    const { GET } = await import('../metrics/operational/route');
    const body = await (await GET(request({ 'x-service-key': KEY }))).json();
    expect(body.request_count).toBeNull();
    expect(body.error_rate).toBeNull();
  });

  it('answers a failed read as an error, not zero, and leaks no detail', async () => {
    const { GET } = await import('../metrics/operational/route');
    m.queueStats.mockRejectedValueOnce(new Error('queue down'));
    const response = await GET(request({ 'x-service-key': KEY }));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('queue down');
  });
});
