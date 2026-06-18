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
  return import('../communications/track/open/[campaignId]/[recipientId]/route');
}

describe('communications/track/open/[campaignId]/[recipientId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    delete process.env.COMMUNICATIONS_TRACKING_SECRET;
    delete process.env.RESEND_TRACKING_SECRET;
    m.withSystemContext.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  it('returns the tracking pixel even when token verification fails', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_1';
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/communications/track/open/c1/r1?token=bad'), {
      params: Promise.resolve({ campaignId: 'c1', recipientId: 'r1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/gif');
    expect(m.logger.warn).toHaveBeenCalled();
  });

  it('updates message and campaign rows when the token is valid', async () => {
    process.env.COMMUNICATIONS_TRACKING_SECRET = 'secret_2';
    const { GET } = await loadRoute();
    const token = crypto.createHmac('sha256', 'secret_2').update('c2:r2:msg_2').digest('hex');

    m.queueSelect(
      [{ id: 'msg_2', openedAt: null, status: 'sent' }],
      [{ stats: { opened: 2 } }],
    );

    const response = await GET(new NextRequest(`http://localhost/api/communications/track/open/c2/r2?messageId=msg_2&token=${token}`), {
      params: Promise.resolve({ campaignId: 'c2', recipientId: 'r2' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/gif');
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it('allows open tracking without a configured secret', async () => {
    const { GET } = await loadRoute();

    m.queueSelect([{ id: 'msg_3', openedAt: null, status: 'sent' }], [{ stats: {} }]);

    const response = await GET(new NextRequest('http://localhost/api/communications/track/open/c3/r3'), {
      params: Promise.resolve({ campaignId: 'c3', recipientId: 'r3' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/gif');
    expect(m.logger.warn).not.toHaveBeenCalled();
  });
});