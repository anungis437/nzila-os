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

  it('returns healthy status on GET', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/rewards/cron'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.service).toBe('rewards-cron');
  });
});
