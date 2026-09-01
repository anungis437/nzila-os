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

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (fn: (tx: any) => Promise<unknown>) => {
    const tx = { select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])) };
    return fn(tx);
  },
}));
vi.mock('@/db/schema/icra-schema', () => ({ icraAssessments: { id: 'id', reportTierId: 'reportTierId' } }));
vi.mock('@nzila/payments-stripe', () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: m.stripeCreate } } }),
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
    m.selectQueue.push([{ reportTierId: 'continuity_reflection', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);

    const response = await POST(req(body(), false));

    expect(response.status).toBe(401);
  });

  it('returns 409 when tier is already unlocked', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'institutional_continuity_diagnostic', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);

    const response = await POST(req(body()));

    expect(response.status).toBe(409);
  });

  it('returns checkout url on successful session creation', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'continuity_reflection', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);

    const response = await POST(req(body()));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.url).toContain('checkout.stripe.com');
  });

  it('returns 500 when stripe session creation fails', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'continuity_reflection', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }]);
    m.stripeCreate.mockRejectedValueOnce(new Error('stripe down'));

    const response = await POST(req(body()));

    expect(response.status).toBe(500);
  });
});
