import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  requireUser: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/api-auth-guard', () => ({ requireUser: m.requireUser }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../whop/create-checkout/route');
}

describe('whop/create-checkout route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireUser.mockResolvedValue({ userId: 'user_1' });
    process.env.WHOP_API_KEY = 'whop_key_1';
    process.env.WHOP_PLAN_ID_MONTHLY = 'plan_monthly';
    process.env.WHOP_PLAN_ID_YEARLY = 'plan_yearly';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'session_1', purchase_url: 'https://whop.com/checkout/1' }),
    })));
  });

  it('returns 401 when user is not authenticated', async () => {
    const { POST } = await loadRoute();
    m.requireUser.mockResolvedValueOnce({ userId: null });

    const response = await POST(new Request('http://localhost/api/whop/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'plan_monthly' }),
    }));

    expect(response.status).toBe(401);
  });

  it('returns 400 when planId is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/whop/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 500 when WHOP_API_KEY is missing', async () => {
    const { POST } = await loadRoute();
    delete process.env.WHOP_API_KEY;

    const response = await POST(new Request('http://localhost/api/whop/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'plan_monthly' }),
    }));

    expect(response.status).toBe(500);
  });

  it('returns upstream error status when Whop API fails', async () => {
    const { POST } = await loadRoute();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ error: { message: 'invalid plan' } }),
    })));

    const response = await POST(new Request('http://localhost/api/whop/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'bad-plan' }),
    }));

    expect(response.status).toBe(422);
  });

  it('creates checkout successfully and returns session metadata', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/whop/create-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'plan_yearly', redirectUrl: '/success' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      checkoutUrl: 'https://whop.com/checkout/1',
      sessionId: 'session_1',
      planDuration: 'yearly',
    });
  });
});
