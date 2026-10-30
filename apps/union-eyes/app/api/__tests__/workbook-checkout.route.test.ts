import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { opaqueRef } from '@/lib/icra/opaque-ref';

const WORKBOOK = '11111111-1111-4111-8111-111111111111';

const m = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  create: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  rows: [] as Array<{ reportTierId: string | null }>,
}));

vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/db/schema/workbook-schema', () => ({ workbooks: { id: 'id', reportTierId: 'report_tier_id' } }));
vi.mock('@/lib/icra/tiers', () => ({ WORKBOOK_TIERS: { workbook_self_guided: { name: 'Self-guided', selfServe: true, amountCents: 240000 } } }));
vi.mock('@nzila/payments-stripe', () => ({ getStripeClient: () => ({ checkout: { sessions: { create: m.create } } }) }));
vi.mock('@/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => m.rows }) }) }) },
}));

function post() {
  return new NextRequest('http://localhost/api/workbook/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workbookId: WORKBOOK }),
  });
}

describe('workbook/checkout route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 60 });
    m.rows = [{ reportTierId: null }];
    m.create.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.example.test/s' });
  });

  // DEF-0B12-WBK-CHECKOUT-REDIRECT-BASE-FALLS-BACK-TO-LOCALHOST-AND-EVERY-CALL-OPENS-A-NEW-SESSION
  it('refuses in production when no public base URL is configured, opening no session', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    const { POST } = await import('../workbook/checkout/route');
    const response = await POST(post());
    expect(response.status).toBe(503);
    expect(m.create).not.toHaveBeenCalled();
  });

  it('opens the session with an idempotency key so a repeat in the window reuses it', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.test');
    const { POST } = await import('../workbook/checkout/route');
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(m.create.mock.calls[0][1]).toEqual({ idempotencyKey: expect.stringContaining(`workbook-checkout:${WORKBOOK}:workbook_self_guided:`) });
    expect(m.create.mock.calls[0][0].success_url).toMatch(/^https:\/\/app\.example\.test\//);
  });

  // DEF-0B12-WBK-ROUTES-LOG-THE-BEARER-WORKBOOK-ID
  it('logs an opaque reference, never the workbook identifier', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.test');
    const { POST } = await import('../workbook/checkout/route');
    await POST(post());
    const logged = JSON.stringify(m.logger.info.mock.calls);
    expect(logged).not.toContain(WORKBOOK);
    expect(logged).toContain(opaqueRef(WORKBOOK));
  });
});
