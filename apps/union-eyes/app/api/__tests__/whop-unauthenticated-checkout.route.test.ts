import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../whop/webhooks/utils/constants', () => ({
  DEFAULT_REDIRECT_URL: 'https://example.com/post-payment',
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../whop/unauthenticated-checkout/route');
}

describe('whop/unauthenticated-checkout route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHOP_API_KEY = 'whop_key_123';
    process.env.WHOP_PLAN_ID_MONTHLY = 'plan_monthly';
    process.env.WHOP_PLAN_ID_YEARLY = 'plan_yearly';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ id: 'session_1', purchase_url: 'https://whop.com/checkout/1' }),
    })));
  });

  it('returns 400 when planId is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/whop/unauthenticated-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/whop/unauthenticated-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'plan_monthly' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/whop/unauthenticated-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'plan_monthly', email: 'not-an-email' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns 500 when WHOP_API_KEY is not configured', async () => {
    const { POST } = await loadRoute();
    delete process.env.WHOP_API_KEY;

    const response = await POST(new Request('http://localhost/api/whop/unauthenticated-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'plan_monthly', email: 'user@example.com' }),
    }));

    expect(response.status).toBe(500);
  });

  it('returns upstream status when Whop API fails', async () => {
    const { POST } = await loadRoute();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ error: { message: 'invalid plan' } }),
    })));

    const response = await POST(new Request('http://localhost/api/whop/unauthenticated-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'bad_plan', email: 'user@example.com' }),
    }));

    expect(response.status).toBe(422);
  });

  it('creates checkout successfully and returns tokenized payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/whop/unauthenticated-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: 'plan_yearly', email: 'user@example.com' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      checkoutUrl: 'https://whop.com/checkout/1',
      sessionId: 'session_1',
      planDuration: 'yearly',
    });
    expect(typeof payload.token).toBe('string');
    expect(m.logger.info).toHaveBeenCalled();
  });

  it('returns 500 when request JSON parsing throws', async () => {
    const { POST } = await loadRoute();

    const badRequest = {
      json: async () => {
        throw new Error('bad json');
      },
    } as unknown as Request;

    const response = await POST(badRequest);
    expect(response.status).toBe(500);
  });
});
