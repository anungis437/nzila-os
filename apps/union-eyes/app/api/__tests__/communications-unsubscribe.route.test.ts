import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  logger: { warn: vi.fn() },
  selectQueue: [] as unknown[][],
  updateReturnQueue: [] as unknown[][],
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
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => (m.updateReturnQueue.shift() ?? []) as unknown[]),
      })),
    })),
  })),
  insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/db/schema', () => ({
  campaigns: { id: 'id', organizationId: 'organizationId', stats: 'stats' },
  communicationPreferences: { id: 'id', organizationId: 'organizationId', userId: 'userId' },
  consentRecords: {},
  messageLog: { campaignId: 'campaignId', recipientId: 'recipientId', channelType: 'channelType', status: 'status' },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), eq: vi.fn(() => 'eq'), ne: vi.fn(() => 'ne') };
});

async function loadRoute() {
  return import('../communications/unsubscribe/[recipientId]/route');
}

function token(secret: string, payload: string) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

describe('communications/unsubscribe/[recipientId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateReturnQueue = [];
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    delete process.env.COMMUNICATIONS_TRACKING_SECRET;
  });

  it('returns 401 for invalid tracking token', async () => {
    const { GET } = await loadRoute();
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';

    const response = await GET(new NextRequest('http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=bad'), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(401);
  });

  it('handles campaign-linked unsubscribe and returns html confirmation', async () => {
    const { GET } = await loadRoute();
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const t = token('secret', 'c1:r1:unsubscribe');

    m.selectQueue.push([{ id: 'c1', organizationId: 'org_1', stats: {} }], [{ id: 'p1' }]);
    m.updateReturnQueue.push([{ id: 'm1' }]);

    const response = await GET(new NextRequest(`http://localhost/api/communications/unsubscribe/r1?campaignId=c1&token=${t}&locale=en-CA`), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('renders the French confirmation copy when locale is fr-CA', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/communications/unsubscribe/r1?reason=manual&locale=fr-CA'), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Désabonnement confirmé');
  });

  it('creates subscription records when no existing preference is found', async () => {
    const { GET } = await loadRoute();
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret';
    const t = token('secret', 'c2:r2:unsubscribe');

    m.selectQueue.push([{ id: 'c2', organizationId: 'org_2', stats: {} }], []);
    m.updateReturnQueue.push([{ id: 'm2' }]);

    const response = await GET(new NextRequest(`http://localhost/api/communications/unsubscribe/r2?campaignId=c2&token=${t}&reason=manual`), {
      params: Promise.resolve({ recipientId: 'r2' }),
    });

    expect(response.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('handles fallback unsubscribe when no campaign id is provided', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/communications/unsubscribe/r1?reason=manual'), {
      params: Promise.resolve({ recipientId: 'r1' }),
    });

    expect(response.status).toBe(200);
  });
});
