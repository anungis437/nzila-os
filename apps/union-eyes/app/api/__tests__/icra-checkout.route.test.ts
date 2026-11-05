import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);
const ASSESSMENT_ID = '11111111-1111-1111-1111-111111111111';

const m = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  stripeCreate: vi.fn(),
  stripeRetrieve: vi.fn(),
  logger: { error: vi.fn(), info: vi.fn() },
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

// The rate limiter and body cap are proven in lib/public-intake; here the guard passes the request through.
vi.mock('@/lib/public-intake/guard', () => ({
  guardPublicIntake: async (request: Request, options?: { readBody?: boolean }) => {
    if (options?.readBody === false) return { ok: true, json: undefined };
    const text = await request.text();
    try {
      return { ok: true, json: text ? JSON.parse(text) : undefined };
    } catch {
      return { ok: false, response: new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 }) };
    }
  },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (fn: (tx: any) => Promise<unknown>) => {
    const tx = { select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])) };
    return fn(tx);
  },
}));
vi.mock('@/db/schema/icra-schema', () => ({ icraAssessments: { id: 'id', reportTierId: 'reportTierId', status: 'status' } }));
vi.mock('@nzila/payments-stripe', () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: m.stripeCreate } }, prices: { retrieve: m.stripeRetrieve } }),
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

function body(tierId = 'executive_continuity_brief') {
  return JSON.stringify({ assessmentId: ASSESSMENT_ID, tierId });
}

function req(bodyStr: string, authorized = true) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authorized) headers.authorization = `Bearer ${TOKEN}`;
  return new NextRequest('http://localhost/api/icra/checkout', { method: 'POST', headers, body: bodyStr });
}

async function loadRoute() {
  return import('../icra/checkout/route');
}

describe('icra/checkout route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    delete process.env.STRIPE_PRICE_ICRA_BRIEF;
    delete process.env.STRIPE_PRICE_ICRA_DIAGNOSTIC;
    process.env.STRIPE_DEFAULT_CURRENCY = 'CAD';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    m.stripeCreate.mockResolvedValue({ id: 'cs_1', url: 'https://checkout.stripe.com/cs_1' });
  });

  it('returns 400 for invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(req('{bad-json'));
    expect(response.status).toBe(400);
  });

  it('returns 422 for schema validation errors', async () => {
    const { POST } = await loadRoute();
    const response = await POST(req(JSON.stringify({ assessmentId: 'bad', tierId: 'x' })));
    expect(response.status).toBe(422);
  });

  it('returns 404 when assessment does not exist', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(req(body()));

    expect(response.status).toBe(404);
  });

  it('returns 401 when no capability token is presented', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);

    const response = await POST(req(body(), false));

    expect(response.status).toBe(401);
  });

  it('returns 409 when tier is already unlocked', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'institutional_continuity_diagnostic', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);

    const response = await POST(req(body()));

    expect(response.status).toBe(409);
  });

  // DEF-0B8-ICRA-CHECKOUT-SELLS-A-TIER-WITHOUT-REQUIRING-A-SUBMITTED-ASSESSMENT
  it('returns 409 and creates no checkout session for an assessment that has not been submitted', async () => {
    const { POST } = await loadRoute();
    for (const status of ['draft', 'in_progress', 'abandoned']) {
      m.selectQueue.push([{ reportTierId: 'continuity_reflection', status, capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
      const response = await POST(req(body()));
      expect(response.status, status).toBe(409);
      expect((await response.json()).error).toContain('submitted');
    }
    expect(m.stripeCreate).not.toHaveBeenCalled();
  });

  // DEF-0B8-ICRA-CHECKOUT-REDIRECT-DEFAULTS-TO-LOCALHOST-AND-PRICE-MAY-DIFFER-FROM-DISPLAYED
  it('refuses, creating no checkout session, when production has no application URL configured', async () => {
    const { POST } = await loadRoute();
    const previousUrl = process.env.NEXT_PUBLIC_APP_URL;
    const previousEnv = process.env.NODE_ENV;
    delete process.env.NEXT_PUBLIC_APP_URL;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
      const response = await POST(req(body()));
      expect(response.status).toBe(503);
      expect(m.stripeCreate).not.toHaveBeenCalled();
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = previousUrl;
      (process.env as Record<string, string>).NODE_ENV = previousEnv as string;
    }
  });

  it.each([
    'http://external.example',
    'https://external.example/redirect',
    'https://user:password@external.example',
    'https://external.example/?next=other',
  ])('refuses unsafe production checkout return URL %s before creating a paid session', async (configured) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', configured);
    try {
      const { POST } = await loadRoute();
      m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
      const response = await POST(req(body()));
      expect(response.status).toBe(503);
      expect(m.stripeCreate).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('uses the configured canonical HTTPS origin for Stripe return URLs', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://union-eyes.example/');
    try {
      const { POST } = await loadRoute();
      m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
      const response = await POST(req(body()));
      expect(response.status).toBe(200);
      const params = m.stripeCreate.mock.calls[0][0];
      expect(params.success_url).toMatch(/^https:\/\/union-eyes\.example\//);
      expect(params.cancel_url).toMatch(/^https:\/\/union-eyes\.example\//);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('returns checkout url on successful session creation', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);

    const response = await POST(req(body()));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.url).toContain('checkout.stripe.com');
  });

  // A configured Stripe Price is a reference, not permission to override the
  // CAD price advertised by the report gate. No payable session on mismatch.
  it.each([
    ['wrong amount', { unit_amount: 119900 }],
    ['wrong currency', { currency: 'usd' }],
    ['inactive', { active: false }],
    ['recurring', { type: 'recurring', recurring: { interval: 'month' } }],
    ['wrong identifier', { id: 'price_other' }],
    ['unknown amount', { unit_amount: null }],
  ])('refuses configured Stripe Price with %s', async (_case, override) => {
    vi.stubEnv('STRIPE_PRICE_ICRA_BRIEF', 'price_brief');
    try {
      const { POST } = await loadRoute();
      m.stripeRetrieve.mockResolvedValue({
        id: 'price_brief', active: true, currency: 'cad',
        unit_amount: 120000, type: 'one_time', recurring: null, ...override,
      });
      m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
      const response = await POST(req(body()));
      expect(response.status).toBe(503);
      expect(m.stripeRetrieve).toHaveBeenCalledWith('price_brief');
      expect(m.stripeCreate).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('refuses checkout when the configured Price cannot be verified', async () => {
    vi.stubEnv('STRIPE_PRICE_ICRA_BRIEF', 'price_brief');
    try {
      const { POST } = await loadRoute();
      m.stripeRetrieve.mockRejectedValueOnce(new Error('Stripe unavailable'));
      m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
      const response = await POST(req(body()));
      expect(response.status).toBe(503);
      expect(m.stripeCreate).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('accepts only a verified CAD 6,500 one-time diagnostic Price', async () => {
    vi.stubEnv('STRIPE_PRICE_ICRA_DIAGNOSTIC', 'price_diagnostic');
    try {
      const { POST } = await loadRoute();
      m.stripeRetrieve.mockResolvedValueOnce({
        id: 'price_diagnostic', active: true, currency: 'cad',
        unit_amount: 650000, type: 'one_time', recurring: null,
      });
      m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
      const response = await POST(req(body('institutional_continuity_diagnostic')));
      expect(response.status).toBe(200);
      expect(m.stripeCreate.mock.calls[0][0].line_items).toEqual([{ price: 'price_diagnostic', quantity: 1 }]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('uses published CAD amount when no configured Price exists, and refuses a non-CAD default currency', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
    expect((await POST(req(body()))).status).toBe(200);
    expect(m.stripeCreate.mock.calls[0][0].line_items[0].price_data).toMatchObject({ currency: 'cad', unit_amount: 120000 });
    expect(m.stripeRetrieve).not.toHaveBeenCalled();
    vi.stubEnv('STRIPE_DEFAULT_CURRENCY', 'USD');
    try {
      m.stripeCreate.mockClear();
      m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
      expect((await POST(req(body()))).status).toBe(503);
      expect(m.stripeCreate).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('returns 500 when stripe session creation fails', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'continuity_reflection', status: 'submitted', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
    m.stripeCreate.mockRejectedValueOnce(new Error('stripe down'));

    const response = await POST(req(body()));

    expect(response.status).toBe(500);
  });
});
