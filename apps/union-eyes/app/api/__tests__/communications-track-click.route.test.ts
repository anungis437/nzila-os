import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  return {
    state,
    withSystemContext: vi.fn(),
    logger: {
      warn: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    queueSelect: (...rows: unknown[][]) => state.selectQueue.push(...rows),
    resetQueues: () => {
      state.selectQueue = [];
    },
    createSelectChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
  })),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../communications/track/click/route');
}

describe('communications/track/click route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    delete process.env.COMMUNICATIONS_TRACKING_SECRET;
    delete process.env.RESEND_TRACKING_SECRET;
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  it('returns 400 when url is missing or invalid', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/communications/track/click?campaignId=c1&recipientId=r1'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Missing or invalid url parameter' });
  });

  it('redirects immediately when campaignId or recipientId is absent', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/communications/track/click?url=https://example.com'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://example.com/');
  });

  it('redirects when token is invalid under configured secret', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_1';
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/communications/track/click?campaignId=c1&recipientId=r1&url=https://example.com&token=bad'));

    expect(response.status).toBe(302);
    expect(m.logger.warn).toHaveBeenCalled();
  });

  it('updates message/campaign stats and redirects when token is valid', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_2';
    const { GET } = await loadRoute();
    const redirect = 'https://example.com/resource';
    const token = crypto.createHmac('sha256', 'secret_2').update(`c2:r2:${redirect}`).digest('hex');

    m.queueSelect(
      [{ id: 'msg_1', clickedAt: null, openedAt: null, status: 'sent' }],
      [{ stats: { delivered: 3 } }],
    );

    const response = await GET(new NextRequest(`http://localhost/api/communications/track/click?campaignId=c2&recipientId=r2&url=${encodeURIComponent(redirect)}&token=${token}`));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(redirect);
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it('allows click-through when no secret is configured', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([{ id: 'msg_2', clickedAt: null, openedAt: null, status: 'sent' }], [{ stats: {} }]);

    const response = await GET(new NextRequest('http://localhost/api/communications/track/click?campaignId=c3&recipientId=r3&url=https://example.org'));

    expect(response.status).toBe(302);
    expect(m.logger.warn).not.toHaveBeenCalled();
  });

  it('accepts messageId-specific tracking tokens', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_3';
    const { GET } = await loadRoute();
    const redirect = 'https://example.com/resource-2';
    const token = crypto.createHmac('sha256', 'secret_3').update(`c4:r4:msg_4:${redirect}`).digest('hex');

    m.queueSelect(
      [{ id: 'msg_4', clickedAt: null, openedAt: null, status: 'sent' }],
      [{ stats: {} }],
    );

    const response = await GET(new NextRequest(`http://localhost/api/communications/track/click?campaignId=c4&recipientId=r4&messageId=msg_4&url=${encodeURIComponent(redirect)}&token=${token}`));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(redirect);
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it('skips db writes when the message was already clicked', async () => {
    const { GET } = await loadRoute();

    m.queueSelect([
      {
        id: 'msg_5',
        clickedAt: new Date('2026-01-01T00:00:00.000Z'),
        openedAt: new Date('2026-01-01T00:00:00.000Z'),
        status: 'clicked',
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/communications/track/click?campaignId=c5&recipientId=r5&url=https://example.net'));

    expect(response.status).toBe(302);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
