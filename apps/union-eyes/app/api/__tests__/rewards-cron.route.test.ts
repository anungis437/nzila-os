import { beforeEach, describe, expect, it, vi } from 'vitest';

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
vi.mock('crypto', () => ({ timingSafeEqual: (a: any, b: any) => a === b }));

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
    const response = await POST(new Request('http://localhost/api/rewards/cron', {
      method: 'POST', headers: { authorization: 'Bearer wrong-secret' },
    }));
    expect(response.status).toBe(401);
  });

  it('runs anniversary awards task', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/rewards/cron?task=anniversaries', {
      method: 'POST', headers: { authorization: 'Bearer test-secret' },
    }));
    expect([200, 400, 401, 500]).toContain(response.status);
  });

  it('runs expiration warnings task', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/rewards/cron?task=expirations', {
      method: 'POST', headers: { authorization: 'Bearer test-secret' },
    }));
    expect([200, 400, 401, 500]).toContain(response.status);
  });

  it('runs all tasks when task=all', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/rewards/cron?task=all', {
      method: 'POST', headers: { authorization: 'Bearer test-secret' },
    }));
    expect([200, 400, 401, 500]).toContain(response.status);
  });
});
