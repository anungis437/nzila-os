import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  processAnniversaryAwards: vi.fn(),
  processScheduledAwards: vi.fn(),
  sendBatchExpirationWarnings: vi.fn(),
  db: { query: { organizations: { findMany: vi.fn() } } },
  persistAtomicAudit: vi.fn(),
  rlsContexts: [] as unknown[],
}));

vi.mock('@/lib/services/rewards/automation-service', () => ({
  processAnniversaryAwards: m.processAnniversaryAwards,
  processScheduledAwards: m.processScheduledAwards,
}));
vi.mock('@/lib/services/rewards/notification-service', () => ({
  sendBatchExpirationWarnings: m.sendBatchExpirationWarnings,
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  withRLSContext: async (ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => { m.rlsContexts.push(ctx); return fn({ tx: true }); },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('crypto', () => ({ timingSafeEqual: (a: Buffer, b: Buffer) => a.length === b.length && a.compare(b) === 0 }));

async function loadRoute() {
  return import('../rewards/cron/route');
}

describe('rewards/cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rlsContexts = [];
    m.persistAtomicAudit.mockResolvedValue(undefined);
    process.env.CRON_SECRET = 'test-secret';
    m.db.query.organizations.findMany.mockResolvedValue([
      { id: 'org_1', status: 'active' },
      { id: 'org_2', status: 'active' },
    ]);
    m.processAnniversaryAwards.mockResolvedValue({ success: true, processed: 5, failed: 0 });
    m.processScheduledAwards.mockResolvedValue({ success: true, processed: 0, skipped: 3 });
    m.sendBatchExpirationWarnings.mockResolvedValue({ success: true, sent: 10, byOrganization: { org_1: { sent: 6, failed: 0 }, org_2: { sent: 4, failed: 0 } } });
  });

  it('returns 401 when cron secret missing', async () => {
    const { POST } = await loadRoute();
    delete process.env.CRON_SECRET;
    const response = await POST(new NextRequest('http://localhost/api/rewards/cron', {
      method: 'POST', headers: { authorization: 'Bearer wrong-secret' },
    }));
    expect(response.status).toBe(401);
  });

  it('returns 401 when cron secret is invalid', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/rewards/cron', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret' },
    }));

    expect(response.status).toBe(401);
  });

  it('runs anniversary awards task', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/rewards/cron?task=anniversaries', {
      method: 'POST', headers: { authorization: 'Bearer test-secret' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.task).toBe('anniversaries');
    expect(m.processAnniversaryAwards).toHaveBeenCalledTimes(2);
    expect(m.processScheduledAwards).not.toHaveBeenCalled();
  });

  it('runs expiration warnings task', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/rewards/cron?task=expirations', {
      method: 'POST', headers: { authorization: 'Bearer test-secret' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.executed).toEqual([{ task: 'expirations', result: expect.objectContaining({ sent: 10 }) }]);
    expect(m.sendBatchExpirationWarnings).toHaveBeenCalledTimes(1);
  });

  it('runs all tasks when task=all', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/rewards/cron?task=all', {
      method: 'POST', headers: { authorization: 'Bearer test-secret' },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.executed.map((item: any) => item.task)).toEqual(['anniversaries', 'expirations', 'scheduled']);
    expect(m.processAnniversaryAwards).toHaveBeenCalledTimes(2);
    expect(m.sendBatchExpirationWarnings).toHaveBeenCalledTimes(1);
    expect(m.processScheduledAwards).toHaveBeenCalledTimes(2);
  });

  // Gate 0 F01a: the GET reachability probe is removed; a scheduler posts, and a GET cannot reach the route's behaviour.
  it('exports no GET handler', async () => {
    const route = await loadRoute() as { GET?: unknown };
    expect(route.GET).toBeUndefined();
  });

  it('accepts the secret in x-cron-secret (the header the scheduler sends) as well as a bearer token, and rejects a wrong or missing one', async () => {
    const { POST } = await loadRoute();
    const url = 'http://localhost/api/rewards/cron?task=scheduled';
    expect((await POST(new NextRequest(url, { method: 'POST' }))).status).toBe(401);
    expect((await POST(new NextRequest(url, { method: 'POST', headers: { 'x-cron-secret': 'wrong' } }))).status).toBe(401);
    const viaHeader = await POST(new NextRequest(url, { method: 'POST', headers: { 'x-cron-secret': process.env.CRON_SECRET! } }));
    const viaBearer = await POST(new NextRequest(url, { method: 'POST', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    expect(viaHeader.status).not.toBe(401);
    expect(viaBearer.status).not.toBe(401);
  });

  // Gate 0 F01 (DEF-0B11-PRP-REWARDS-CRON-REPORTS-SUCCESS-FOR-UNKNOWN-TASKS-AND-FAILED-ORGANIZATIONS)
  it('refuses an unknown task with 400 and runs nothing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/rewards/cron?task=bogus', { method: 'POST', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('UNKNOWN_TASK');
    expect(m.processAnniversaryAwards).not.toHaveBeenCalled();
    expect(m.db.query.organizations.findMany).not.toHaveBeenCalled();
  });

  it('answers 500, naming the failing organizations and keeping the counts, when any organization task is rejected', async () => {
    const orgs = await m.db.query.organizations.findMany();
    m.processAnniversaryAwards.mockImplementation(async (id: string) => { if (id === orgs[0].id) throw new Error('boom'); return { processed: 1 }; });
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/rewards/cron?task=anniversaries', { method: 'POST', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, failed: 1, succeeded: orgs.length - 1, failures: [{ scope: `anniversaries:${orgs[0].id}` }] });
  });

  const post = async (query: string) => {
    const { POST } = await loadRoute();
    return POST(new NextRequest(`http://localhost/api/rewards/cron${query}`, { method: 'POST', headers: { 'x-cron-secret': 'test-secret' } }));
  };

  it('runs each organization\'s task inside that organization\'s own context and audits the run under it', async () => {
    const response = await post('?task=anniversaries');
    expect(response.status).toBe(200);
    expect(m.rlsContexts).toEqual([
      { organizationId: 'org_1', userId: 'system:rewards' },
      { organizationId: 'org_2', userId: 'system:rewards' },
    ]);
    expect(m.persistAtomicAudit.mock.calls.map((call) => [call[1].organizationId, call[1].action, call[1].details.processed])).toEqual([
      ['org_1', 'rewards.cron.anniversaries', 5],
      ['org_2', 'rewards.cron.anniversaries', 5],
    ]);
  });

  it('answers 500 naming the organization when members could not be awarded, even though the task returned', async () => {
    m.processAnniversaryAwards.mockImplementation(async (id: string) => (id === 'org_1' ? { success: false, processed: 1, failed: 2 } : { success: true, processed: 1, failed: 0 }));
    const response = await post('?task=anniversaries');
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ success: false, failures: [{ scope: 'anniversaries:org_1' }] });
  });

  it('audits the expiration e-mails under each organization whose members were mailed', async () => {
    await post('?task=expirations');
    expect(m.persistAtomicAudit.mock.calls.map((call) => [call[1].organizationId, call[1].action, call[1].details])).toEqual([
      ['org_1', 'rewards.cron.expiration_warnings', { sent: 6, failed: 0 }],
      ['org_2', 'rewards.cron.expiration_warnings', { sent: 4, failed: 0 }],
    ]);
  });

  it('fails the run, naming the organization, when a run audit cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));
    const response = await post('?task=expirations');
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ failures: [{ scope: 'expirations:org_1' }] });
  });

  it('never reports skipped scheduled rules as processed', async () => {
    const body = await (await post('?task=scheduled')).json();
    expect(JSON.stringify(body)).toContain('"skipped":3');
    expect(JSON.stringify(body)).not.toContain('"processed":3');
  });
});
