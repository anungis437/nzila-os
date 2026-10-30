import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  processAnniversaryAwards: vi.fn(),
  processScheduledAwards: vi.fn(),
  sendBatchExpirationWarnings: vi.fn(),
  db: { query: { organizations: { findMany: vi.fn() } } },
}));

vi.mock('@/lib/services/rewards/automation-service', () => ({
  processAnniversaryAwards: m.processAnniversaryAwards,
  processScheduledAwards: m.processScheduledAwards,
}));
vi.mock('@/lib/services/rewards/notification-service', () => ({
  sendBatchExpirationWarnings: m.sendBatchExpirationWarnings,
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('crypto', () => ({ timingSafeEqual: (a: Buffer, b: Buffer) => a.length === b.length && a.compare(b) === 0 }));

async function loadRoute() {
  return import('../rewards/cron/route');
}

describe('rewards/cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    m.db.query.organizations.findMany.mockResolvedValue([
      { id: 'org_1', status: 'active' },
      { id: 'org_2', status: 'active' },
    ]);
    m.processAnniversaryAwards.mockResolvedValue({ processed: 5 });
    m.processScheduledAwards.mockResolvedValue({ processed: 3 });
    m.sendBatchExpirationWarnings.mockResolvedValue({ sent: 10 });
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
    expect(payload.data.executed).toEqual([{ task: 'expirations', result: { sent: 10 } }]);
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
});
