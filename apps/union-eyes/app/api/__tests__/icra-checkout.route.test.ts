import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/db/schema/icra-schema', () => ({ icraAssessments: { id: 'id', reportTierId: 'reportTierId' } }));
vi.mock('@nzila/payments-stripe', () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: m.stripeCreate } } }),
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

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
    const response = await POST(new NextRequest('http://localhost/api/icra/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad-json',
    }));
    expect(response.status).toBe(400);
  });

  it('returns 422 for schema validation errors', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assessmentId: 'bad', tierId: 'x' }),
    }));
    expect(response.status).toBe(422);
  });

  it('returns 404 when assessment does not exist', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/icra/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assessmentId: '11111111-1111-1111-1111-111111111111', tierId: 'executive_continuity_brief' }),
    }));

    expect(response.status).toBe(404);
  });

  it('returns 409 when tier is already unlocked', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'institutional_continuity_diagnostic' }]);

    const response = await POST(new NextRequest('http://localhost/api/icra/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assessmentId: '11111111-1111-1111-1111-111111111111', tierId: 'executive_continuity_brief' }),
    }));

    expect(response.status).toBe(409);
  });

  it('returns checkout url on successful session creation', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'continuity_reflection' }]);

    const response = await POST(new NextRequest('http://localhost/api/icra/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assessmentId: '11111111-1111-1111-1111-111111111111', tierId: 'executive_continuity_brief' }),
    }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.url).toContain('checkout.stripe.com');
  });

  it('returns 500 when stripe session creation fails', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ reportTierId: 'continuity_reflection' }]);
    m.stripeCreate.mockRejectedValueOnce(new Error('stripe down'));

    const response = await POST(new NextRequest('http://localhost/api/icra/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assessmentId: '11111111-1111-1111-1111-111111111111', tierId: 'executive_continuity_brief' }),
    }));

    expect(response.status).toBe(500);
  });
});
