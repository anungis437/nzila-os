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
    audit: vi.fn(),
    updateReturns: [] as unknown[][],
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
      where: vi.fn(() => ({ returning: vi.fn(async () => (m.updateReturns.shift() ?? [{ id: 'row' }]) as unknown[]) })),
    })),
  })),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));

async function loadRoute() {
  return import('../communications/track/click/route');
}

describe('communications/track/click route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.updateReturns = [];
    delete process.env.COMMUNICATIONS_TRACKING_SECRET;
    delete process.env.RESEND_TRACKING_SECRET;
    // The click writes run on the transaction handed to the callback (B87); the mock db stands in for it.
    m.withSystemContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb));
  });

  it('returns 400 when url is missing or invalid', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/communications/track/click?campaignId=c1&recipientId=r1'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Missing or invalid url parameter' });
  });

  it('rejects (no redirect) when campaignId or recipientId is absent', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/communications/track/click?url=https://example.com'));

    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('rejects (no redirect) when token is invalid under configured secret', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_1';
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/communications/track/click?campaignId=c1&recipientId=r1&url=https://example.com&token=bad'));

    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
    expect(mockDb.update).not.toHaveBeenCalled();
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
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'campaign.message.clicked', details: expect.objectContaining({ impliedOpen: true }) }));
  });

  it('counts nothing and audits nothing when another request already claimed the click, and still redirects', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_race';
    const { GET } = await loadRoute();
    const redirect = 'https://example.com/race';
    const token = crypto.createHmac('sha256', 'secret_race').update(`c6:r6:${redirect}`).digest('hex');
    m.queueSelect([{ id: 'msg_6', clickedAt: null, openedAt: new Date(), status: 'opened' }]);
    m.updateReturns.push([]);

    const response = await GET(new NextRequest(`http://localhost/api/communications/track/click?campaignId=c6&recipientId=r6&url=${encodeURIComponent(redirect)}&token=${token}`));

    expect(response.status).toBe(302);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('redirects a verified link even when the analytics transaction fails', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_fail';
    const { GET } = await loadRoute();
    const redirect = 'https://example.com/fail';
    const token = crypto.createHmac('sha256', 'secret_fail').update(`c7:r7:${redirect}`).digest('hex');
    m.queueSelect([{ id: 'msg_7', clickedAt: null, openedAt: null, status: 'sent' }]);
    m.audit.mockRejectedValueOnce(new Error('audit down'));

    const response = await GET(new NextRequest(`http://localhost/api/communications/track/click?campaignId=c7&recipientId=r7&url=${encodeURIComponent(redirect)}&token=${token}`));

    expect(response.status).toBe(302);
    expect(m.logger.error).toHaveBeenCalled();
  });

  it('fails closed with no configured secret: no redirect, no record', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/communications/track/click?campaignId=c3&recipientId=r3&url=https://example.org&token=whatever'));

    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
    expect(mockDb.update).not.toHaveBeenCalled();
    expect(m.logger.warn).toHaveBeenCalled();
  });

  it('does not honor a token signed for a different destination (no open redirect)', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_x';
    const { GET } = await loadRoute();
    const signedFor = 'https://trusted.example.com/a';
    const attackerUrl = 'https://evil.example.com/';
    // Token is validly signed, but bound to a DIFFERENT destination.
    const token = crypto.createHmac('sha256', 'secret_x').update(`c9:r9:${signedFor}`).digest('hex');

    const response = await GET(new NextRequest(`http://localhost/api/communications/track/click?campaignId=c9&recipientId=r9&url=${encodeURIComponent(attackerUrl)}&token=${token}`));

    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
    expect(mockDb.update).not.toHaveBeenCalled();
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
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'campaign.message.clicked', details: expect.objectContaining({ impliedOpen: true }) }));
  });

  it('skips db writes when the message was already clicked', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_click';
    const { GET } = await loadRoute();
    const redirect = 'https://example.net/welcome';
    const token = crypto.createHmac('sha256', 'secret_click').update(`c5:r5:${redirect}`).digest('hex');

    m.queueSelect([
      {
        id: 'msg_5',
        clickedAt: new Date('2026-01-01T00:00:00.000Z'),
        openedAt: new Date('2026-01-01T00:00:00.000Z'),
        status: 'clicked',
      },
    ]);

    const response = await GET(new NextRequest(`http://localhost/api/communications/track/click?campaignId=c5&recipientId=r5&url=${encodeURIComponent(redirect)}&token=${token}`));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(redirect);
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
